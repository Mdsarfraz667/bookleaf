import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  addClient,
  ADMIN_CHANNEL,
  authorChannel,
  heartbeat,
  publish,
  publishTicketEvent,
} from "../lib/sse";
import { classifyTicket } from "../services/ai/classify";

export const ticketsRouter: Router = Router();

// Allow the SSE route to authenticate via ?token= (EventSource cannot set headers).
ticketsRouter.use((req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.token === "string") {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});
ticketsRouter.use(authenticate, requireRole("AUTHOR"));

// ---------- author-safe serialization ----------

const ticketInclude = {
  messages: {
    orderBy: { createdAt: "asc" },
    // Note: no adminId/internal fields — the author thread never exposes admin identity.
    select: { id: true, senderType: true, body: true, createdAt: true },
  },
  attachments: {
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  },
  book: { select: { id: true, externalId: true, title: true, status: true } },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

/** Author view of a ticket. NEVER includes internalNotes, aiReasoning, or aiDraft. */
function serializeTicketForAuthor(ticket: TicketWithRelations) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    category: ticket.category,
    priority: ticket.priority,
    bookId: ticket.bookId,
    book: ticket.book,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages: ticket.messages,
    attachments: ticket.attachments,
  };
}

// ---------- validation ----------

const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5_000),
  bookId: z.string().min(1).nullable().optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().max(100).optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
      })
    )
    .max(10)
    .optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });
const messageSchema = z.object({ body: z.string().trim().min(1).max(5_000) });

// ---------- routes ----------

/** POST /api/tickets — create a ticket. AI classification never blocks creation. */
ticketsRouter.post(
  "/",
  validate({ body: createTicketSchema }),
  asyncHandler(async (req, res) => {
    const authorId = req.user!.id;
    const { subject, description, bookId, attachments } = req.body as z.infer<
      typeof createTicketSchema
    >;

    // If a book is referenced, it must belong to this author.
    if (bookId) {
      const owned = await prisma.book.findFirst({
        where: { id: bookId, authorId },
        select: { id: true },
      });
      if (!owned) {
        throw new ApiError(400, "Invalid bookId: that book does not belong to you");
      }
    }

    // classifyTicket has its own fallback and never throws.
    const classification = await classifyTicket({ subject, description });

    const created = await prisma.ticket.create({
      data: {
        authorId,
        bookId: bookId ?? null,
        subject,
        description,
        category: classification.category,
        priority: classification.priority,
        aiClassified: classification.aiClassified,
        aiReasoning: classification.reasoning,
        attachments: attachments?.length
          ? {
              create: attachments.map((a) => ({
                fileName: a.fileName,
                mimeType: a.mimeType ?? null,
                sizeBytes: a.sizeBytes ?? null,
              })),
            }
          : undefined,
      },
      include: ticketInclude,
    });

    // Notify the admin dashboard that a new ticket arrived.
    publish(ADMIN_CHANNEL, "ticket:new", {
      id: created.id,
      subject: created.subject,
      status: created.status,
      category: created.category,
      priority: created.priority,
      authorId,
      bookId: created.bookId,
      createdAt: created.createdAt,
    });

    res.status(201).json({ ticket: serializeTicketForAuthor(created) });
  })
);

/** GET /api/tickets — the author's own tickets, newest first, with thread. */
ticketsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tickets = await prisma.ticket.findMany({
      where: { authorId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: ticketInclude,
    });
    res.json({ tickets: tickets.map(serializeTicketForAuthor) });
  })
);

/** GET /api/tickets/events/stream — SSE scoped to this author's channel. */
ticketsRouter.get(
  "/events/stream",
  asyncHandler(async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const remove = addClient([authorChannel(req.user!.id)], res);
    heartbeat(res);
    const timer = setInterval(() => heartbeat(res), 25_000);

    req.on("close", () => {
      clearInterval(timer);
      remove();
      res.end();
    });
  })
);

/** GET /api/tickets/:id — own ticket only; 404 if not theirs (never reveal existence). */
ticketsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const ticket = await prisma.ticket.findFirst({
      where: { id, authorId: req.user!.id },
      include: ticketInclude,
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    res.json({ ticket: serializeTicketForAuthor(ticket) });
  })
);

/** POST /api/tickets/:id/messages — author reply on their own ticket. */
ticketsRouter.post(
  "/:id/messages",
  validate({ params: idParamSchema, body: messageSchema }),
  asyncHandler(async (req, res) => {
    const authorId = req.user!.id;
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const { body } = req.body as z.infer<typeof messageSchema>;

    const owned = await prisma.ticket.findFirst({
      where: { id, authorId },
      select: { id: true },
    });
    if (!owned) throw new ApiError(404, "Ticket not found");

    await prisma.ticketMessage.create({
      data: { ticketId: owned.id, senderType: "AUTHOR", body },
    });
    // Bump updatedAt so the ticket re-sorts to the top of queues.
    await prisma.ticket.update({ where: { id: owned.id }, data: { updatedAt: new Date() } });

    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { id: owned.id, authorId },
      include: ticketInclude,
    });

    publishTicketEvent(ticket, "ticket:updated", {
      id: ticket.id,
      status: ticket.status,
      updatedAt: ticket.updatedAt,
    });

    res.status(201).json({ ticket: serializeTicketForAuthor(ticket) });
  })
);
