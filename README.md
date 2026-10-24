# BookLeaf — Author Support & Communication Portal

A full-stack support desk for a self-publishing company. **Authors** raise queries about their books
(royalties, ISBN/metadata, printing, distribution, production status) and chat with the support team.
**Admins** triage an incoming queue, where each ticket is auto-classified and a grounded reply is drafted
by an LLM. Admins edit and send the reply; the author sees it **live** without refreshing.

The AI is an assistant, never a gatekeeper: tickets are always created and admins can always respond
manually, even when AI is disabled or down.

---

## Architecture & decisions

Monorepo with two independently deployable apps:

```
/server   Express (TypeScript, ESM) + Prisma + PostgreSQL + Anthropic
/client   React + Vite + Tailwind + TanStack Query
```

| Area | Choice | Why |
| --- | --- | --- |
| Runtime | Node + **tsx** (no build step) | Run TS directly in dev *and* prod; one less toolchain to break. Imports need no `.js` suffixes. |
| Language | TypeScript (ESM, `strict`) | Catch contract drift between client/server at `tsc --noEmit`. |
| API | **Express 5** | Small, well-understood; easy to layer middleware (auth, validation, errors). |
| ORM / DB | **Prisma + PostgreSQL** | Typed queries, enums, relations, migrations. RBAC is enforced in every `where` clause. |
| Auth | **JWT (stateless)** + `bcryptjs` | No session store to run; role is derived from which table the login matched. |
| Validation | **Zod** | One schema per endpoint → typed input *and* a consistent `{ error, details? }` on failure. |
| Security | `helmet`, `express-rate-limit`, CORS allowlist | Standard hardening; login is rate-limited; only listed origins may call the API. |
| Real-time | **Server-Sent Events** | One-way server→client is all we need; works over plain HTTP, no socket infra. |
| AI | `@anthropic-ai/sdk`, model `claude-haiku-4-5` | Cheap, fast; tool-use gives structured classification; KB grounds the drafts. |
| Client data | **TanStack Query** | Caching, request dedupe, and cache invalidation driven by SSE events. |

**Layering is strict:** routes do HTTP only (parse → authorize → orchestrate → serialize); all AI logic lives in
`server/src/services/ai`; all data access goes through Prisma. No business logic leaks into route handlers.

**RBAC is enforced twice.** Middleware (`requireRole`) blocks the wrong *role* with **403**. Every query is also
scoped by `authorId`, so a resource you don't own returns **404** — we never reveal that it exists. Admin-only
fields (internal notes, AI reasoning, AI draft) live on separate serializers / a separate table and are never sent
to authors.

---

## How the AI integration works

Two distinct calls, each doing one job:

1. **Classification (tool-use).** On ticket creation we force a single tool call (`classify_ticket`) whose
   `input_schema` constrains the output to one of the 6 categories and 4 priorities plus a short reasoning string.
   Because the model must return valid tool input, we get structured, enum-safe results — no fragile text parsing.
   The system prompt carries only the **taxonomy + hints**, never the knowledge base.
2. **Drafting (KB-grounded).** When an admin opens a ticket we draft a reply grounded in the BookLeaf knowledge
   base (royalty cadence, ISBN policy, printing SLAs, etc.) plus **only the facts of the one relevant book** — not
   the author's whole history, not the whole KB catalog.

**Graceful degradation (hard requirement).**
- Classification never throws: on error/timeout it falls back to `General Inquiry / Medium` with `aiClassified=false`,
  which surfaces an **"AI needs review"** badge in the admin queue. The ticket is still created.
- Drafting returns `null` on failure; the draft endpoint responds **503** and the UI shows
  *"AI unavailable — write manually"* while still allowing a manual send.
- `AI_ENABLED=false` short-circuits **all** AI calls — the entire app works with zero LLM traffic.

**Cost control.**
- The large, static KB is sent as a cached system block (`cache_control: ephemeral`) so repeat drafts reuse it.
- Drafts are **generated once and cached** on the ticket; re-opening reuses the stored draft, and
  `?force=true` is required to regenerate.
- We never send the full knowledge base or full ticket history per call — classification gets the taxonomy only;
  drafting gets the KB + the single relevant book.
- Tight `max_tokens` (200 classify / 600 draft), a 15s timeout, and a single retry only on 429/5xx/timeout.

---

## API

Base URL: `http://localhost:4000`. All non-public routes need `Authorization: Bearer <jwt>`.
Interactive docs (Swagger UI): **`/api/docs`** · raw spec: **`/api/openapi.json`**.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | public | Liveness + `{ ai: { enabled, model } }`. |
| GET | `/api/meta` | public | Enum values (statuses, categories, priorities). |
| POST | `/api/auth/login` | public | Email + password → JWT (rate-limited). |
| GET | `/api/auth/me` | any | Current user + role. |
| GET | `/api/books` | author | The caller's own books. |
| POST | `/api/tickets` | author | Create a ticket (triggers classification). |
| GET | `/api/tickets` | author | The caller's tickets. |
| GET | `/api/tickets/{id}` | author | One ticket (404 if not theirs). |
| POST | `/api/tickets/{id}/messages` | author | Reply on their ticket. |
| GET | `/api/tickets/events/stream` | author | SSE: live updates for their tickets. |
| GET | `/api/admin/tickets` | admin | Queue with filters + sort. |
| GET | `/api/admin/tickets/{id}` | admin | Full ticket incl. notes + AI metadata. |
| PATCH | `/api/admin/tickets/{id}` | admin | Override category/priority, set status, assign-to-me. |
| POST | `/api/admin/tickets/{id}/draft` | admin | Get/generate AI draft (`?force=true` to regenerate; 503 if AI off). |
| POST | `/api/admin/tickets/{id}/respond` | admin | Send a reply to the author (optional status change). |
| POST | `/api/admin/tickets/{id}/notes` | admin | Add an internal note (never visible to authors). |
| GET | `/api/admin/events/stream` | admin | SSE: live queue updates. |

Every error has the shape `{ "error": string, "details"?: ... }` with a meaningful 4xx — no raw 500s or stack traces.

---

## Local setup

**Prerequisites:** Node 18+ and a running PostgreSQL 14+.

### 1. Server

```bash
cd server
npm install
cp .env.example .env            # then edit values (see below)
npm run prisma:generate
npm run prisma:migrate          # creates tables (dev); use `prisma migrate deploy` in prod
npm run db:seed                 # loads 10 authors, 18 books, 1 admin
npm run dev                     # http://localhost:4000
```

Key `.env` values:

| Var | Example | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/bookleaf?schema=public` | Prisma connection. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allowlist (comma-separate for more). |
| `JWT_SECRET` | *(long random string)* | Signs tokens. |
| `SEED_PASSWORD` | `Bookleaf@123` | Password given to every seeded user. |
| `ANTHROPIC_API_KEY` | *(empty ok)* | **Server-only.** Leave blank to run without AI. |
| `AI_MODEL` | `claude-haiku-4-5` | Must stay this value. |
| `AI_ENABLED` | `true` / `false` | `false` = zero AI calls, app fully usable. |

> **No key?** Set `AI_ENABLED=false` (or just leave `ANTHROPIC_API_KEY` blank). Tickets still get created
> (classified as *General Inquiry / Medium*, flagged "needs review") and admins respond manually.

### 2. Client

```bash
cd client
npm install
cp .env.example .env            # VITE_API_URL=http://localhost:4000
npm run dev                     # http://localhost:5173
```

### 3. Tests & docs

```bash
cd server
npm run typecheck               # tsc --noEmit
npm test                        # vitest integration suite (AI mocked, bookleaf_test DB)
# docs: start the server, then open http://localhost:4000/api/docs
```

---

## Test credentials

Password for **all** seeded accounts is `SEED_PASSWORD` (default **`Bookleaf@123`**).

| Role | Email | Password |
| --- | --- | --- |
| Admin | `ops@bookleaf.com` | `Bookleaf@123` |
| Author | `priya.sharma@email.com` | `Bookleaf@123` |

Other authors (same password): `rohit.kapoor@email.com`, `ananya.reddy@email.com`, `kavita.deshmukh@email.com`
(has an in-production book and a ₹0-paid book — good for demoing those edge cases), and more printed by the seed.

---

## Known limitations & future work

- **SSE is in-memory, single-instance.** The event hub holds client connections in process, so horizontal scaling
  needs **Redis pub/sub** (or similar) to fan events across instances. See `WRITEUP.md`.
- **Attachments are metadata-only.** Filenames/sizes are stored; no bytes are uploaded. Production needs real
  object storage (S3/GCS) with pre-signed URLs.
- **Priority sort is computed in JS** from an enum rank. A numeric priority column with a SQL `ORDER BY` would sort
  at the database and page cleanly.
- **Classification is synchronous** on ticket creation (with fallback). Under load this should move to a background
  job/queue so creation latency never depends on the LLM.
- **No refresh tokens / token revocation** — JWTs are stateless and simply expire (`JWT_EXPIRES_IN`).
- **Test coverage** focuses on API contracts, RBAC isolation, and AI fallback; more edge-case and client tests
  would follow. Observability (structured logs, request tracing, AI latency/cost metrics) is minimal.

---

## Deployment

Two domains: **API + Postgres on Railway** (or Render), **client on Vercel**. CORS and SSE work cross-domain as
long as `CLIENT_ORIGIN` (server) and `VITE_API_URL` (client) point at each other.

### A. Database + API — Railway

1. **Create project → Add PostgreSQL.** Railway gives you a `DATABASE_URL`.
2. **Add a service from the repo**, set **Root Directory = `server`**.
3. **Build command:** `npm install && npm run prisma:generate`
   **Start command:** `./node_modules/.bin/prisma migrate deploy && npm start`
4. **Environment variables** on the API service:

   | Var | Value |
   | --- | --- |
   | `DATABASE_URL` | *(reference the Postgres plugin's var)* |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | *(long random string)* |
   | `JWT_EXPIRES_IN` | `7d` |
   | `SEED_PASSWORD` | `Bookleaf@123` |
   | `AI_MODEL` | `claude-haiku-4-5` |
   | `AI_ENABLED` | `true` (or `false` to run without a key) |
   | `ANTHROPIC_API_KEY` | *(your key; omit + set `AI_ENABLED=false` to skip AI)* |
   | `CLIENT_ORIGIN` | *(your Vercel URL, e.g. `https://bookleaf.vercel.app`)* — set after step B |

5. **Migrate + seed the deployed DB.** Migrations run automatically via the start command
   (`prisma migrate deploy`). Seed **once** from the service shell:

   ```bash
   railway run npm run db:seed      # or run `npm run db:seed` in the service's shell
   ```

   (Re-running is safe — the seed is idempotent, but it resets demo data.)

Note the API's public URL, e.g. `https://bookleaf-api.up.railway.app`.

> **Render alternative:** this repo includes `render.yaml`. In Render, **New → Blueprint** provisions the Postgres
> DB and the API together with the same build/start commands; then set `ANTHROPIC_API_KEY` and `CLIENT_ORIGIN`
> in the dashboard and run `npm run db:seed` once from the service shell.

### B. Client — Vercel

1. **Import the repo**, set **Root Directory = `client`** (Vercel detects Vite; `client/vercel.json` adds the
   SPA rewrite so deep links like `/admin/tickets/:id` work).
2. **Environment variable:**

   | Var | Value |
   | --- | --- |
   | `VITE_API_URL` | your API URL from step A, e.g. `https://bookleaf-api.up.railway.app` |

3. **Deploy.** Note the Vercel URL.

### C. Wire the two together

1. Set the API's **`CLIENT_ORIGIN`** to the exact Vercel URL (scheme + host, no trailing slash) and redeploy the
   API. This authorizes CORS **and** the cross-domain `EventSource` SSE connections.
2. Confirm `VITE_API_URL` on Vercel points at the API; redeploy the client if you changed it.
3. Open the Vercel URL and sign in with the credentials above. Submit a query as an author; respond as the admin in
   another window — the author's view updates live across the two domains.

The deployed app is pre-seeded with the sample dataset and usable with the README credentials.
