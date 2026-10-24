# BookLeaf — Write-up

## What I prioritized

1. **Correct, enforced access control.** The brief treats RBAC as a graded, security-sensitive requirement, so I
   built it first and defended it twice: `requireRole` middleware returns **403** for the wrong role, and every
   Prisma query is scoped by `authorId` so a resource you don't own returns **404** — existence is never leaked.
   Admin-only data (internal notes, AI reasoning, drafts) is isolated by separate serializers and a separate
   `InternalNote` table, so it physically cannot reach an author response.

2. **AI that degrades gracefully.** The product must work when the LLM is slow, erroring, or switched off. So the
   AI layer is isolated behind `services/ai`, never throws into request flow, and has a global `AI_ENABLED=false`
   kill-switch. Ticket creation and manual admin replies never depend on an AI call succeeding.

3. **A consistent contract.** One Zod schema per endpoint yields typed input and a single error shape
   `{ error, details? }`; no raw 500s. That made the OpenAPI/Swagger docs and the integration tests straightforward.

4. **Live, believable UX.** Authors see admin replies without refreshing. I used SSE (one-way is all that's needed)
   with TanStack Query invalidation driven by events, which keeps the client cache authoritative and the code small.

## Trade-offs

- **tsx in prod, no build step.** Faster to run and reason about, one fewer toolchain; the cost is startup
  transpilation and no dead-code elimination. Fine at this scale.
- **Stateless JWT, no revocation.** No session store to operate; the trade-off is tokens can't be invalidated
  before expiry. Acceptable for the assignment; refresh/rotation is the production follow-up.
- **Synchronous classification on create** (with fallback) keeps the flow simple and the ticket is never lost — but
  it couples creation latency to the LLM. The fallback bounds the worst case; a queue is the real fix.
- **Generate-once draft caching** optimizes cost over freshness: an admin must click *Regenerate* (`?force=true`)
  to get a new draft after editing context. A deliberate choice to avoid paying per open.
- **Attachments stored as metadata only, priority sorted in JS.** Both were scoped down to keep the core loop
  tight; see below.

## Evolving to production

- **Multi-instance SSE → Redis pub/sub.** The event hub currently holds connections in one process. Publishing
  events through Redis (or NATS) lets any instance deliver to any connected client, so the API can scale
  horizontally behind a load balancer.
- **Real object storage for attachments.** Swap metadata-only records for S3/GCS with pre-signed upload/download
  URLs, size/type limits, and virus scanning.
- **Numeric priority column + SQL sort.** Replace the JS rank-sort with an integer `priorityRank` column and
  `ORDER BY`, so the queue sorts and paginates in the database.
- **Background classification.** Move the AI classify call to a job queue (BullMQ/SQS). Tickets are created
  instantly as "pending triage" and updated when the worker finishes — creation latency stops depending on the LLM.
- **Caching & observability.** Add response/result caching where safe; emit structured logs and traces, and track
  AI latency, token usage, cost, and fallback rate so the "graceful degradation" is measurable, not assumed.
- **More tests + CI.** Grow beyond API/RBAC/fallback coverage to client component tests and E2E, and run
  `typecheck` + tests on every PR.
