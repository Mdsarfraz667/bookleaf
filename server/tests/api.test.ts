import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

// Mock the AI client so no real Anthropic calls happen, regardless of env.
// aiAvailable() = false → classifyTicket returns the safe fallback and
// generateDraft returns null (draft endpoint then responds 503).
vi.mock("../src/services/ai/client", () => ({
  aiAvailable: () => false,
  MODEL: "claude-haiku-4-5",
  createMessage: vi.fn(async () => {
    throw new Error("AI must not be called in tests");
  }),
  textOf: () => "",
}));

import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const app = createApp();

const PASSWORD = "Test@123";
let authorAId = "";
let authorBId = "";
let authorABookId = "";

// Memoize tokens so the whole suite stays under the login rate limit (10/min/IP).
const tokenCache = new Map<string, string>();
async function login(email: string): Promise<string> {
  const cached = tokenCache.get(email);
  if (cached) return cached;
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  const token = res.body.token as string;
  tokenCache.set(email, token);
  return token;
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Clean slate (children → parents).
  await prisma.$transaction([
    prisma.attachment.deleteMany(),
    prisma.internalNote.deleteMany(),
    prisma.ticketMessage.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.book.deleteMany(),
    prisma.author.deleteMany(),
    prisma.admin.deleteMany(),
  ]);

  const authorA = await prisma.author.create({
    data: {
      externalId: "AUTH_TEST_A",
      name: "Test Author A",
      email: "a@test.com",
      passwordHash,
      books: {
        create: {
          externalId: "BK_TEST_A1",
          title: "A's Book",
          status: "Published & Live",
          availableOn: ["Amazon India"],
        },
      },
    },
    include: { books: true },
  });
  const authorB = await prisma.author.create({
    data: {
      externalId: "AUTH_TEST_B",
      name: "Test Author B",
      email: "b@test.com",
      passwordHash,
    },
  });
  await prisma.admin.create({
    data: { name: "Test Admin", email: "admin@test.com", passwordHash },
  });

  authorAId = authorA.id;
  authorBId = authorB.id;
  authorABookId = authorA.books[0].id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("logs in an author with the AUTHOR role", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@test.com", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("AUTHOR");
  });

  it("logs in an admin with the ADMIN role", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("ADMIN");
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@test.com", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it("rejects a malformed body with 400 and field details", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});

describe("tickets + RBAC", () => {
  it("creates a ticket with deterministic fallback classification", async () => {
    const token = await login("a@test.com");
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "No royalty in 6 months", description: "Missing payments.", bookId: authorABookId });

    expect(res.status).toBe(201);
    expect(res.body.ticket.category).toBe("GENERAL_INQUIRY");
    expect(res.body.ticket.priority).toBe("MEDIUM");
    // Author serializer must never expose AI internals or notes.
    expect(res.body.ticket).not.toHaveProperty("aiReasoning");
    expect(res.body.ticket).not.toHaveProperty("aiDraft");
    expect(res.body.ticket).not.toHaveProperty("internalNotes");
  });

  it("returns 400 when creating a ticket for a book you do not own", async () => {
    const tokenB = await login("b@test.com");
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ subject: "x", description: "y", bookId: authorABookId });
    expect(res.status).toBe(400);
  });

  it("does not let author B read author A's ticket (404)", async () => {
    const tokenA = await login("a@test.com");
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "Private", description: "A's ticket" });
    const ticketId = created.body.ticket.id as string;

    const tokenB = await login("b@test.com");
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("blocks an author token on an admin route (403)", async () => {
    const tokenA = await login("a@test.com");
    const res = await request(app).get("/api/admin/tickets").set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
  });
});

describe("admin responses and isolation", () => {
  it("admin reply appears on the author's ticket; internal note does not", async () => {
    const tokenA = await login("a@test.com");
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "Need help", description: "Please respond." });
    const ticketId = created.body.ticket.id as string;

    const adminToken = await login("admin@test.com");

    // Admin sends an author-visible reply.
    const respond = await request(app)
      .post(`/api/admin/tickets/${ticketId}/respond`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ body: "We are on it. — The BookLeaf Team" });
    expect(respond.status).toBe(201);

    // Admin adds an internal note.
    const note = await request(app)
      .post(`/api/admin/tickets/${ticketId}/notes`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ body: "secret internal note" });
    expect(note.status).toBe(201);

    // Author sees the ADMIN message but never the note or AI internals.
    const authorView = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(authorView.status).toBe(200);
    const ticket = authorView.body.ticket;
    expect(ticket.status).toBe("IN_PROGRESS");
    expect(ticket.messages.some((m: { senderType: string }) => m.senderType === "ADMIN")).toBe(true);
    expect(ticket).not.toHaveProperty("internalNotes");
    expect(JSON.stringify(ticket)).not.toContain("secret internal note");
  });

  it("draft endpoint returns 503 when AI is disabled", async () => {
    const tokenA = await login("a@test.com");
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "Draft please", description: "Generate a draft." });
    const ticketId = created.body.ticket.id as string;

    const adminToken = await login("admin@test.com");
    const res = await request(app)
      .post(`/api/admin/tickets/${ticketId}/draft`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});
