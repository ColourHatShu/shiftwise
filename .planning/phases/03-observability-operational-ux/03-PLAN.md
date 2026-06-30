---
phase: 03-observability-operational-ux
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/package.json
  - backend/src/server.ts
  - backend/src/routes/workers.js
  - backend/src/routes/audit-log.ts
  - backend/src/services/cronService.js
  - backend/src/lib/encryption.js
  - frontend/package.json
  - frontend/app/layout.tsx
  - frontend/app/_app.tsx
  - frontend/app/dashboard/audit-log/page.tsx
  - frontend/app/dashboard/workers/page.tsx
  - frontend/lib/api/audit.ts
  - .env.example
autonomous: false
requirements:
  - OBS-01
  - OBS-02
  - OBS-03
  - OBS-04
  - AUDIT-01
  - AUDIT-02
  - UX-01
  - UX-02
  - UX-03

must_haves:
  truths:
    - "Sentry (free tier) is configured on backend and frontend; DSNs are read from env vars (SENTRY_DSN_BACKEND, NEXT_PUBLIC_SENTRY_DSN)"
    - "When DSN is empty, Sentry is silent (no-op); local dev does not require signup"
    - "GET /api/audit-log returns paginated, agency-scoped audit log entries with filters (action, entity, userId, dateFrom, dateTo)"
    - "/dashboard/audit-log page renders audit log as a searchable, paginated table with metadata detail popover"
    - "GET /api/workers accepts ?search=<q> and ?status=<status> and returns filtered results (case-insensitive search on firstName, lastName, email, jobTitle)"
    - "Worker list page has search input and status dropdown that update results via query parameters"
    - "GCM decryption errors, cron failures, and other Phase 1/2 errors are logged to Sentry with structured tags (userId, agencyId, documentId, context)"
---

# Phase 3 Plan — Observability & Operational UX

**Goal:** Add error observability (Sentry), audit log access (endpoint + UI), and worker search/filter. Zero new services beyond Sentry free tier. No schema changes.

**Requirements:** 9 (OBS-01-04, AUDIT-01-02, UX-01-03)

**Task Structure:** 8 tasks grouped into 3 categories, dependency-ordered

## Task Breakdown (execution order)

### A: Sentry Integration (3 tasks)
- **A1** (auto): Install `@sentry/node`, `@sentry/nextjs`. Configure backend Sentry init in `server.ts`, add request + error handler middleware
- **A2** (auto): Configure frontend Sentry in `_app.tsx` or layout.tsx with client + server config, silent when DSN empty
- **A3** (auto): Wire Sentry logging into existing error paths: GCM decrypt failures (Phase 1), cron errors (Phase 1), OCR failures (Phase 2)

### B: Audit Log (2 tasks)
- **B1** (TDD): Implement `GET /api/audit-log` endpoint with pagination (`page`, `limit`), filtering (`action`, `entity`, `userId`, `dateFrom`, `dateTo`), agency scoping, RBAC (`requireRole(['OWNER','ADMIN'])`)
- **B2** (auto): Create `/dashboard/audit-log` page with filter bar (action dropdown, entity input, date pickers), paginated table (action, entity, actor, timestamp), detail popover (metadata)

### C: Worker Search & Filter (2 tasks)
- **C1** (auto): Extend `GET /api/workers` endpoint to accept `?search=<q>` (case-insensitive match on firstName, lastName, email, jobTitle) and `?status=ACTIVE|INACTIVE|SUSPENDED`
- **C2** (auto): Update `/dashboard/workers` page with search input and status dropdown, debounced query parameter updates

### D: Documentation (1 task)
- **D1** (auto): Update `.env.example` with `SENTRY_DSN_BACKEND` and `NEXT_PUBLIC_SENTRY_DSN` placeholders, document Sentry setup in CLAUDE.md

## Dependency Graph

```
A1 → A2 → A3
     ↓
B1 → B2
C1 → C2
D1 (independent, can start anytime)
```

**Key blocking edges:**
- A2 must finish before A3 (Sentry must be initialized before logging to it)
- B1 must finish before B2 (endpoint must exist before UI calls it)
- C1 must finish before C2 (backend filter logic must exist before frontend uses it)

## Verification Gates (automated + manual)

| Task | Gate Type | Command/How |
|------|-----------|------------|
| A1 | Automated | npm list @sentry/node → installed; grep "Sentry.init" backend/src/server.ts → found |
| A2 | Automated | npm list @sentry/nextjs → installed; grep "Sentry.init" frontend/app/_app.tsx → found |
| A3 | Integration test | Mock Sentry, trigger GCM error, cron error, OCR error; verify Sentry.captureException called with correct tags |
| B1 | Integration test | GET /api/audit-log?action=DOCUMENT_VERIFY&page=1 → 200, returns paginated items with correct shape; VIEWER role gets 403 |
| B2 | Manual | Navigate to /dashboard/audit-log, filter by action, verify table renders with metadata detail on row click |
| C1 | Integration test | GET /api/workers?search=john → returns workers with "john" in firstName/lastName/email/jobTitle; GET /api/workers?status=INACTIVE → returns inactive workers |
| C2 | Manual | Go to /dashboard/workers, type in search input, verify workers filtered; select status dropdown, verify filtered by status |
| D1 | Automated | grep "SENTRY_DSN_BACKEND\|NEXT_PUBLIC_SENTRY_DSN" .env.example → found |

## Atomic Commits (6 total)

1. `feat(obs-01,obs-02): install and configure Sentry backend + frontend` (A1+A2)
2. `feat(obs-03,obs-04): wire Sentry logging into error handlers` (A3)
3. `feat(audit-01): implement GET /api/audit-log endpoint` (B1)
4. `feat(audit-02): create /dashboard/audit-log page with filtering and detail view` (B2)
5. `feat(ux-01,ux-02): add search and status filter to worker list` (C1+C2)
6. `docs(03-observability-ux): document Sentry and audit log setup` (D1)

## Key Gotchas

- **Sentry DSN env vars:** If empty string or undefined, Sentry must be silent (no-op). Test with `SENTRY_DSN_BACKEND=""` locally.
- **Audit log performance:** No new indexes needed for MVP; query includes `agencyId` filter (scoped).
- **Worker search:** Must be case-insensitive (`mode: 'insensitive'` in Prisma). Test with mixed-case input (e.g., "JoHn").
- **Status filter:** Enum values are ACTIVE|INACTIVE|SUSPENDED. Validate input in route (enum check or whitelist).
- **Detail popover:** Audit log metadata can be nested JSON; render safely (escape HTML, truncate large objects).
- **Sentry config:** If `@sentry/nextjs` is used, ensure it's integrated with `next.config.js` (auto-done by SDK).
- **Middleware ordering:** Sentry request handler must be early in middleware chain; error handler must be last.

## Files Touched (by task)

| Task | Files |
|------|-------|
| A1 | backend/package.json, backend/src/server.ts, backend/src/middleware/sentry.ts (new) |
| A2 | frontend/package.json, frontend/app/_app.tsx or layout.tsx, frontend/sentry.server.ts (new) |
| A3 | backend/src/services/cronService.js, backend/src/lib/encryption.js, backend/src/routes/documents.js |
| B1 | backend/src/routes/audit-log.ts (new) |
| B2 | frontend/app/dashboard/audit-log/page.tsx (new), frontend/lib/api/audit.ts (new) |
| C1 | backend/src/routes/workers.js (extend existing endpoint) |
| C2 | frontend/app/dashboard/workers/page.tsx (add search + status filter) |
| D1 | .env.example, backend/CLAUDE.md or README |

## Success Criteria (End of Phase)

1. ✓ Sentry free tier is wired into backend and frontend; DSNs from env vars; silent when DSN empty
2. ✓ All errors from Phase 1/2 (GCM decrypt, cron, OCR) are logged to Sentry with structured tags
3. ✓ GET /api/audit-log endpoint returns paginated, filterable, agency-scoped audit log entries
4. ✓ /dashboard/audit-log page renders audit log with filters and metadata detail view
5. ✓ GET /api/workers accepts `?search=<q>` and `?status=<status>` for case-insensitive search and status filtering
6. ✓ Worker list page has search input and status dropdown that update results via query params
7. ✓ All 9 OBS/AUDIT/UX requirements (OBS-01-04, AUDIT-01-02, UX-01-03) delivered

All 9 REQs delivered. Milestone 1 complete (20 of 29 v1 REQs across 3 phases).

