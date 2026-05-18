# Phase 3 Context — Observability & Operational UX

**Date:** 2026-05-18  
**Phase:** 03 — Observability & Operational UX  
**Goal:** Add error observability via Sentry (free tier), audit log access (endpoint + UI), and worker search/filter. Zero new services, zero new dependencies beyond Sentry SDK.

---

## Domain

This phase adds visibility into system behavior (errors, audited actions) and improves operator UX (search workers, track actions). User sees: audit trail (who did what when), error alerts via Sentry, faster worker lookup.

---

## Decisions (Locked)

### Sentry Integration (Free Tier, No Card)

**Decision:** Sentry free tier (5K errors/month, no card required). DSNs read from env vars (`SENTRY_DSN_BACKEND`, `NEXT_PUBLIC_SENTRY_DSN`). Silent (no-op) when DSN is empty (local dev doesn't require signup).

**Why:** Error observability without paid infrastructure. Free tier is sufficient for MVP (5K errors/month = ~160/day, well above MVP error rate).

**How to apply:**
- Backend: `@sentry/node` with `Sentry.init(dsn)`, request handler + error handler middleware
- Frontend: `@sentry/nextjs` with client + server config
- DSNs optional: when empty, Sentry is disabled (no-op)
- Log errors with structured context: `Sentry.captureException(error, { tags: { userId, agencyId }, extra: {...} })`

---

### Audit Log Endpoint (GET /api/audit-log)

**Decision:** Read-only endpoint returning agency-scoped, paginated audit log entries. Filterable by `action`, `entity`, `userId`, `dateFrom`, `dateTo`. Requires `OWNER` or `ADMIN` role.

**Why:** Compliance auditability. Existing AuditLog schema already exists (Phase 1 stores all actions). Endpoint wraps querying with pagination + filtering.

**How to apply:**
- `GET /api/audit-log?action=DOCUMENT_VERIFY&entity=ComplianceDocument&userId=clerk_xxxxx&dateFrom=2026-05-01&dateTo=2026-05-18&page=1&limit=50`
- Prisma: `prisma.auditLog.findMany({ where: { agencyId, action, entity, userId, createdAt: { gte, lte } }, orderBy: { createdAt: 'desc' }, take: limit, skip: (page-1)*limit })`
- Returns: `{ items: [...], total, page, limit, pages }`
- Requires RBAC middleware: `requireRole(['OWNER','ADMIN'])`
- No new schema changes (AuditLog table already exists)

---

### Audit Log UI (/dashboard/audit-log)

**Decision:** New Next.js page with paginated table, search filters, and metadata detail popover. Server-side pagination (not client-side).

**Why:** Operator visibility into system actions. Server-side pagination keeps large audit logs queryable without O(n) fetching.

**How to apply:**
- Route: `frontend/app/dashboard/audit-log/page.tsx`
- Components: filter bar (action dropdown, entity input, date pickers), paginated table (action, entity, actor, timestamp), detail popover (click row → show full metadata)
- Server action: fetch `/api/audit-log` with filters + page
- Schema: No new fields needed; render existing `action`, `entity`, `userId`, `metadata`, `createdAt`

---

### Worker Search & Filter

**Decision:** Extend existing `GET /api/workers` endpoint with:
- `?search=<q>` — case-insensitive match on firstName, lastName, email, jobTitle
- `?status=ACTIVE|INACTIVE|SUSPENDED` — filter by WorkerStatus

**Why:** Faster lookup for coordinators. Server-side search scales better than client-side (existing records, future-proof).

**How to apply:**
- Prisma: `prisma.worker.findMany({ where: { agencyId, status, OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { jobTitle: { contains: q, mode: 'insensitive' } }] }, ... })`
- Frontend: search input + status dropdown in worker list page, debounced query params (e.g., `?search=john&status=ACTIVE`)
- No new schema fields needed (search is on existing columns)

---

### Sentry Error Logging Pattern

**Decision:** Log structured errors with context tags (userId, agencyId, documentId, etc.) and extra metadata. Console.error for now; Sentry captures and aggregates.

**Why:** Debugging aid. Structured logging enables Sentry grouping and alerting.

**How to apply:**
- In error handlers: `Sentry.captureException(error, { tags: { userId: req.user?.id, agencyId: req.user?.agencyId }, extra: { documentId, context: 'ocr-analysis-failed' } })`
- GCM failures (Phase 1) already log structured metadata; Phase 3 routes them to Sentry
- CronService errors (Phase 1 alert dedup): log with document context
- Express error handler: auto-captures all uncaught exceptions + structured metadata

---

## Code Context

### Existing Assets

**AuditLog schema** (`backend/prisma/schema.prisma`):
- Already exists; fields: `id`, `agencyId`, `action`, `entity`, `entityId`, `userId`, `metadata`, `createdAt`, `updatedAt`
- Phase 1 writes to it transactionally with document operations
- No migration needed; just query it

**Worker schema** (`backend/prisma/schema.prisma`):
- Fields: `id`, `firstName`, `lastName`, `email`, `jobTitle`, `status` (enum ACTIVE|INACTIVE|SUSPENDED)
- Existing `GET /api/workers` endpoint in `backend/src/routes/workers.js`
- Just add filter logic; no schema changes

**Frontend worker list** (`frontend/app/dashboard/workers/page.tsx`):
- Already exists, lists workers
- Add search input + status dropdown, pass as query params
- Debounce on input change (e.g., 300ms) before fetching

**Sentry SDKs** (not yet installed):
- Backend: `@sentry/node` (ES module)
- Frontend: `@sentry/nextjs` (Next.js integration)
- Both zero-config if DSN is provided; silent when DSN is empty

---

## Canonical References

- `.planning/REQUIREMENTS.md` — OBS-01 through OBS-04, AUDIT-01-02, UX-01-03
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria
- `backend/prisma/schema.prisma` — AuditLog and Worker schemas (no changes needed)
- `backend/src/routes/workers.js` — existing GET /api/workers endpoint
- `backend/src/services/cronService.js` — uses Sentry for error logging (Phase 3)
- `frontend/app/dashboard/workers/page.tsx` — worker list page (add search input)

---

## Specifics / Notes

**Sentry setup:**
- Sign up for free tier (no card) → get Backend + Frontend DSNs
- Backend: `Sentry.init({ dsn: process.env.SENTRY_DSN_BACKEND, integrations: [...] })`
- Frontend: `Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, ... })` in `_app.tsx` or layout
- Environment: if DSN is empty, Sentry.captureException is a no-op (use a dummy integration that does nothing)

**Audit log performance:**
- AuditLog table may grow large over time; no indexes needed for MVP, but query should use `orderBy: { createdAt: 'desc' }` for pagination
- If queries become slow (100K+ rows), add index on `(agencyId, createdAt)` in Phase 4

**Worker search scope:**
- Search is case-insensitive (`mode: 'insensitive'`)
- Scoped by agencyId (query includes `agencyId` filter)
- Pagination: existing limit/offset pattern

**Frontend polling / real-time:**
- Audit log and worker list are not real-time (no WebSockets)
- User refreshes or uses pagination to view updates
- Future phase: WebSocket for real-time audit tail

---

## Deferred Ideas

- Real-time audit log streaming (WebSocket)
- Audit log retention policies (delete old entries after 90 days)
- Sentry alert rules and PagerDuty integration (Phase 4+)
- Worker bulk actions (bulk reassign, bulk deactivate) — separate phase
- Export audit log as CSV/JSON — deferred to audit pack phase

