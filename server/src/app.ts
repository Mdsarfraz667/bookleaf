import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { TicketStatus, TicketCategory, TicketPriority } from "@prisma/client";
import { authRouter } from "./routes/auth";
import { booksRouter } from "./routes/books";
import { ticketsRouter } from "./routes/tickets";
import { adminRouter } from "./routes/admin";
import { docsRouter } from "./openapi";
import { errorHandler, notFound } from "./middleware/errorHandler";

export function aiConfig(): { enabled: boolean; model: string } {
  return {
    enabled: process.env.AI_ENABLED !== "false",
    model: process.env.AI_MODEL ?? "claude-haiku-4-5",
  };
}

export function createApp(): Express {
  const app = express();

  const allowlist = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Docs are mounted before helmet so Swagger UI's inline assets aren't blocked
  // by the default Content-Security-Policy. The API routes below stay behind helmet.
  app.use("/api", docsRouter);

  app.use(helmet());
  app.use(
    cors({
      origin: allowlist,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ai: aiConfig() });
  });

  // Enum arrays for client-side dropdowns and filters.
  app.get("/api/meta", (_req, res) => {
    res.json({
      ticketStatuses: Object.values(TicketStatus),
      ticketCategories: Object.values(TicketCategory),
      ticketPriorities: Object.values(TicketPriority),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
