import { Router } from "express";
import swaggerUi from "swagger-ui-express";

/**
 * OpenAPI 3 description of the BookLeaf API. Hand-written so it stays readable and
 * close to the actual handlers. Served as Swagger UI at /api/docs and raw JSON at
 * /api/openapi.json.
 */
export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BookLeaf Author Support & Communication Portal API",
    version: "1.0.0",
    description:
      "Author-facing and admin-facing support portal. All errors share the shape { error, details? }.",
  },
  servers: [{ url: "/", description: "Current host" }],
  tags: [
    { name: "System" },
    { name: "Auth" },
    { name: "Author: Books" },
    { name: "Author: Tickets" },
    { name: "Admin" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: { path: { type: "string" }, message: { type: "string" } },
            },
          },
        },
      },
      Health: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          ai: {
            type: "object",
            properties: { enabled: { type: "boolean" }, model: { type: "string" } },
          },
        },
      },
      Meta: {
        type: "object",
        properties: {
          ticketStatuses: { type: "array", items: { type: "string" } },
          ticketCategories: { type: "array", items: { type: "string" } },
          ticketPriorities: { type: "array", items: { type: "string" } },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          role: { type: "string", enum: ["ADMIN", "AUTHOR"] },
        },
      },
      Book: {
        type: "object",
        properties: {
          id: { type: "string" },
          externalId: { type: "string" },
          title: { type: "string" },
          isbn: { type: "string", nullable: true },
          genre: { type: "string", nullable: true },
          publicationDate: { type: "string", format: "date", nullable: true },
          status: { type: "string" },
          mrp: { type: "integer", nullable: true },
          royaltyPerCopy: { type: "integer", nullable: true },
          totalCopiesSold: { type: "integer" },
          totalRoyaltyEarned: { type: "integer" },
          royaltyPaid: { type: "integer" },
          royaltyPending: { type: "integer" },
          lastPayoutDate: { type: "string", format: "date", nullable: true },
          printPartner: { type: "string", nullable: true },
          availableOn: { type: "array", items: { type: "string" } },
          inProduction: { type: "boolean" },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string" },
          senderType: { type: "string", enum: ["AUTHOR", "ADMIN"] },
          body: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateTicketRequest: {
        type: "object",
        required: ["subject", "description"],
        properties: {
          subject: { type: "string", maxLength: 200 },
          description: { type: "string", maxLength: 5000 },
          bookId: { type: "string", nullable: true },
          attachments: {
            type: "array",
            items: {
              type: "object",
              required: ["fileName"],
              properties: {
                fileName: { type: "string" },
                mimeType: { type: "string" },
                sizeBytes: { type: "integer" },
              },
            },
          },
        },
      },
      AuthorTicket: {
        type: "object",
        properties: {
          id: { type: "string" },
          subject: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] },
          category: { type: "string" },
          priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          bookId: { type: "string", nullable: true },
          book: { type: "object", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          messages: { type: "array", items: { $ref: "#/components/schemas/Message" } },
          attachments: { type: "array", items: { type: "object" } },
        },
      },
      AdminTicket: {
        allOf: [
          { $ref: "#/components/schemas/AuthorTicket" },
          {
            type: "object",
            properties: {
              categoryOverridden: { type: "boolean" },
              priorityOverridden: { type: "boolean" },
              aiClassified: { type: "boolean" },
              aiReasoning: { type: "string", nullable: true },
              aiDraft: { type: "string", nullable: true },
              aiDraftModel: { type: "string", nullable: true },
              assignedAdminId: { type: "string", nullable: true },
              assignedAdmin: { type: "object", nullable: true },
              author: { type: "object" },
              internalNotes: { type: "array", items: { type: "object" } },
            },
          },
        ],
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Liveness + AI config",
        security: [],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Health" } } },
          },
        },
      },
    },
    "/api/meta": {
      get: {
        tags: ["System"],
        summary: "Enum values for dropdowns",
        security: [],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Meta" } } },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login (role derived from the matched account table)",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          "200": {
            description: "Authenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { description: "Too many login attempts" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current authenticated account",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/books": {
      get: {
        tags: ["Author: Books"],
        summary: "The authenticated author's own books",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { books: { type: "array", items: { $ref: "#/components/schemas/Book" } } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/tickets": {
      get: {
        tags: ["Author: Tickets"],
        summary: "The author's own tickets (newest first)",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tickets: { type: "array", items: { $ref: "#/components/schemas/AuthorTicket" } },
                  },
                },
              },
            },
          },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Author: Tickets"],
        summary: "Create a ticket (AI auto-classifies; never blocks creation)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTicketRequest" } } },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ticket: { $ref: "#/components/schemas/AuthorTicket" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/tickets/{id}": {
      get: {
        tags: ["Author: Tickets"],
        summary: "One of the author's own tickets (404 if not theirs)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ticket: { $ref: "#/components/schemas/AuthorTicket" } },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/tickets/{id}/messages": {
      post: {
        tags: ["Author: Tickets"],
        summary: "Author reply on their own ticket",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["body"], properties: { body: { type: "string" } } },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/tickets/events/stream": {
      get: {
        tags: ["Author: Tickets"],
        summary: "SSE stream scoped to this author (auth via header or ?token=)",
        parameters: [{ name: "token", in: "query", required: false, schema: { type: "string" } }],
        responses: { "200": { description: "text/event-stream" } },
      },
    },
    "/api/admin/tickets": {
      get: {
        tags: ["Admin"],
        summary: "Ticket queue with filters and sort",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["urgent", "newest", "oldest"] } },
        ],
        responses: {
          "200": { description: "OK" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/tickets/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Full admin detail",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ticket: { $ref: "#/components/schemas/AdminTicket" } },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Admin"],
        summary: "Update status/category/priority or assign to self",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  category: { type: "string" },
                  priority: { type: "string" },
                  assignToMe: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/tickets/{id}/draft": {
      post: {
        tags: ["Admin"],
        summary: "Return cached AI draft or regenerate (?force=true). 503 if AI unavailable.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "force", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": {
            description: "Draft",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    draft: { type: "string" },
                    model: { type: "string", nullable: true },
                    cached: { type: "boolean" },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "503": { description: "AI unavailable; write manually" },
        },
      },
    },
    "/api/admin/tickets/{id}/respond": {
      post: {
        tags: ["Admin"],
        summary: "Send an author-visible reply (defaults OPEN → IN_PROGRESS)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["body"],
                properties: { body: { type: "string" }, status: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/tickets/{id}/notes": {
      post: {
        tags: ["Admin"],
        summary: "Add an internal note (never visible to authors)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["body"], properties: { body: { type: "string" } } },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/events/stream": {
      get: {
        tags: ["Admin"],
        summary: "SSE stream on the admin channel (auth via header or ?token=)",
        parameters: [{ name: "token", in: "query", required: false, schema: { type: "string" } }],
        responses: { "200": { description: "text/event-stream" } },
      },
    },
  },
} as const;

// Reusable error responses, attached after the fact to keep `paths` readable.
(openapiSpec.components as Record<string, unknown>).responses = {
  BadRequest: {
    description: "Validation failed",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  },
  Unauthorized: {
    description: "Authentication required or invalid",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  },
  Forbidden: {
    description: "Wrong role for this route",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  },
  NotFound: {
    description: "Resource not found (also returned for resources you do not own)",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  },
};

export const docsRouter: Router = Router();

// Raw spec for tooling (Postman/codegen).
docsRouter.get("/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});

// Interactive Swagger UI.
docsRouter.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec as object));
