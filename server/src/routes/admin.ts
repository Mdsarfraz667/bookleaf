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
  heartbeat,
  publish,
  publishTicketEvent,
} from "../lib/sse";
import { aiAvailable } from "../services/ai/client";
import { generateDraft } from "../services/ai/draft";
import type { BookFacts } from "../services/ai/prompts";

export const adminRouter: Router = Router();

// Allow the SSE route to authenticate via ?token= (EventSource cannot set headers).
adminRouter.use((req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.token === "string") {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});
adminRouter.use(authenticate, requireRole("ADMIN"));

// ---------- serialization ----------

const adminTicketInclude = {
  messages: {
    orderBy: { createdAt: "asc" },
    select: { id: true, senderType: true, adminId: true, body: true, createdAt: true },
  },
  attachments: {
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  },
  notes: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      adminId: true,
      admin: { select: { id: true, name: true } },
    },
  },
  author: { select: { id: true, externalId: true, name: true, email: true, city: true } },
  book: {
    select: {
      id: true,
      externalId: true,
      title: true,
      status: true,
      isbn: true,
      genre: true,
      mrp: true,
      royaltyPaid: true,
      royaltyPending: true,
      lastPayoutDate: true,
      availableOn: true,
    },
  },
  assignedAdmin: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TicketInclude;

type AdminTicket = Prisma.TicketGetPayload<{ include: typeof adminTicketInclude }>;

/** Admin view — includes internal notes, aiReasoning, cached aiDraft, author/book/assignedAdmin. */
function serializeTicketForAdmin(ticket: AdminTicket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    category: ticket.category,
    priority: ticket.priority,
    categoryOverridden: ticket.categoryOverridden,
    priorityOverridden: ticket.priorityOverridden,
    aiClassified: ticket.aiClassified,
    aiReasoning: ticket.aiReasoning,
    aiDraft: ticket.aiDraft,
    aiDraftModel: ticket.aiDraftModel,
    assignedAdminId: ticket.assignedAdminId,
    assignedAdmin: ticket.assignedAdmin,
    author: ticket.author,
    book: ticket.book,
    bookId: ticket.bookId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages: ticket.messages,
    attachments: ticket.attachments,
    internalNotes: ticket.notes,
  };
}

// ---------- validation ----------

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const CATEGORIES = [
  "ROYALTY_PAYMENTS",
  "ISBN_METADATA",
  "PRINTING_QUALITY",
  "DISTRIBUTION_AVAILABILITY",
  "BOOK_STATUS_PRODUCTION",
  "GENERAL_INQUIRY",
] as const;
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(["urgent", "newest", "oldest"]).default("urgent"),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const respondSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
  status: z.enum(STATUSES).optional(),
});

const patchSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignToMe: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

const noteSchema = z.object({ body: z.string().trim().min(1).max(5_000) });

// Most-severe first. At scale, store a numeric priority column and sort in SQL instead of in JS.
const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// ---------- routes ----------

/** GET /api/admin/tickets — filterable, sortable queue of compact rows. */
adminRouter.get(
  "/tickets",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { status, category, priority, from, to, q, sort } = req.query as unknown as z.infer<
      typeof listQuerySchema
    >;

    const where: Prisma.TicketWhereInput = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    if (q) {
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        subject: true,
        status: true,
        category: true,
        priority: true,
        aiClassified: true,
        assignedAdminId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
        book: { select: { id: true, externalId: true, title: true } },
      },
    });

    // "urgent" = most severe priority first, then oldest. newest/oldest are by createdAt.
    const sorted = [...rows];
    if (sort === "urgent") {
      sorted.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.createdAt.getTime() - b.createdAt.getTime()
      );
    } else if (sort === "newest") {
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } // "oldest" is already createdAt ascending.

    const tickets = sorted.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      category: t.category,
      priority: t.priority,
      aiClassified: t.aiClassified,
      assignedAdminId: t.assignedAdminId,
      authorName: t.author.name,
      authorId: t.author.id,
      bookTitle: t.book?.title ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    res.json({ tickets });
  })
);

/** GET /api/admin/events/stream — SSE on the shared admin channel. */
adminRouter.get(
  "/events/stream",
  asyncHandler(async (_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const remove = addClient([ADMIN_CHANNEL], res);
    heartbeat(res);
    const timer = setInterval(() => heartbeat(res), 25_000);

    res.req.on("close", () => {
      clearInterval(timer);
      remove();
      res.end();
    });
  })
);

/** GET /api/admin/tickets/:id — full admin detail. */
adminRouter.get(
  "/tickets/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const ticket = await prisma.ticket.findUnique({ where: { id }, include: adminTicketInclude });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    res.json({ ticket: serializeTicketForAdmin(ticket) });
  })
);

/**
 * POST /api/admin/tickets/:id/draft
 * Cost control: return the cached aiDraft if present; regenerate only on ?force=true.
 * 503 when AI is unavailable so the admin knows to write manually.
 */
adminRouter.post(
  "/tickets/:id/draft",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const force = req.query.force === "true";

    const ticket = await prisma.ticket.findUnique({ where: { id }, include: adminTicketInclude });
    if (!ticket) throw new ApiError(404, "Ticket not found");

    if (ticket.aiDraft && !force) {
      res.json({ draft: ticket.aiDraft, model: ticket.aiDraftModel, cached: true });
      return;
    }

    if (!aiAvailable()) {
      throw new ApiError(503, "AI drafting is unavailable right now. Please write a response manually.");
    }

    const book: BookFacts | null = ticket.book
      ? {
          title: ticket.book.title,
          status: ticket.book.status,
          isbn: ticket.book.isbn,
          genre: ticket.book.genre,
          mrp: ticket.book.mrp,
          royaltyPaid: ticket.book.royaltyPaid,
          royaltyPending: ticket.book.royaltyPending,
          lastPayoutDate: ticket.book.lastPayoutDate
            ? ticket.book.lastPayoutDate.toISOString().slice(0, 10)
            : null,
          availableOn: ticket.book.availableOn,
        }
      : null;

    const result = await generateDraft({
      author: { name: ticket.author.name },
      ticket: { subject: ticket.subject, description: ticket.description, category: ticket.category },
      book,
    });

    if (!result) {
      throw new ApiError(503, "AI drafting failed. Please write a response manually.");
    }

    await prisma.ticket.update({
      where: { id },
      data: { aiDraft: result.draft, aiDraftModel: result.model },
    });

    res.json({ draft: result.draft, model: result.model, cached: false });
  })
);

/**
 * POST /api/admin/tickets/:id/respond
 * Creates an author-visible ADMIN message. Defaults an OPEN ticket to IN_PROGRESS.
 */
adminRouter.post(
  "/tickets/:id/respond",
  validate({ params: idParamSchema, body: respondSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const { body, status } = req.body as z.infer<typeof respondSchema>;
    const adminId = req.user!.id;

    const existing = await prisma.ticket.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new ApiError(404, "Ticket not found");

    const nextStatus = status ?? (existing.status === "OPEN" ? "IN_PROGRESS" : existing.status);

    await prisma.ticketMessage.create({
      data: { ticketId: id, senderType: "ADMIN", adminId, body },
    });
    await prisma.ticket.update({
      where: { id },
      data: { status: nextStatus, updatedAt: new Date() },
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: adminTicketInclude,
    });

    // Author sees the reply live.
    publishTicketEvent(ticket, "ticket:updated", {
      id: ticket.id,
      status: ticket.status,
      updatedAt: ticket.updatedAt,
    });

    res.status(201).json({ ticket: serializeTicketForAdmin(ticket) });
  })
);

/** PATCH /api/admin/tickets/:id — status/category/priority/assignToMe. Overrides flip *Overridden. */
adminRouter.patch(
  "/tickets/:id",
  validate({ params: idParamSchema, body: patchSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const { status, category, priority, assignToMe } = req.body as z.infer<typeof patchSchema>;

    const existing = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new ApiError(404, "Ticket not found");

    const data: Prisma.TicketUpdateInput = {};
    if (status) data.status = status;
    if (category) {
      data.category = category;
      data.categoryOverridden = true;
    }
    if (priority) {
      data.priority = priority;
      data.priorityOverridden = true;
    }
    if (assignToMe) {
      data.assignedAdmin = { connect: { id: req.user!.id } };
    }

    await prisma.ticket.update({ where: { id }, data });
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: adminTicketInclude,
    });

    publishTicketEvent(ticket, "ticket:updated", {
      id: ticket.id,
      status: ticket.status,
      category: ticket.category,
      priority: ticket.priority,
      updatedAt: ticket.updatedAt,
    });

    res.json({ ticket: serializeTicketForAdmin(ticket) });
  })
);

/** POST /api/admin/tickets/:id/notes — internal note, never exposed to authors. */
adminRouter.post(
  "/tickets/:id/notes",
  validate({ params: idParamSchema, body: noteSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const { body } = req.body as z.infer<typeof noteSchema>;

    const existing = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new ApiError(404, "Ticket not found");

    const note = await prisma.internalNote.create({
      data: { ticketId: id, adminId: req.user!.id, body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        adminId: true,
        admin: { select: { id: true, name: true } },
      },
    });

    // Let other admins see the activity, but never the author.
    publish(ADMIN_CHANNEL, "ticket:updated", { id, note: "internal" });

    res.status(201).json({ note });
  })
);
