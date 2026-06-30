# 🛡️ Autonomous Knight — Backlog (priority-ordered)

> Top of the list = highest priority. The Knight ticks `[x]` when shipped,
> `[blocked] — reason` when it needs the human. **Verify each item isn't already
> implemented before building it** — the codebase moves between firings.
>
> Seeded from the 4-specialist Super-Ready Council audit (2026-05-27). Wave A
> (security/trust BLOCKERs) and several Wave B items already shipped in commit
> `ef91788`. This backlog is the remaining Wave B polish + Wave C features +
> quality work. The Knight may re-prioritise and add items as product owner.

## P1 — Robustness, trust & accessibility
- [x] **(discovered P0)** Fix production build-breaker: `worker/dashboard/shifts/page.tsx` read `localStorage` at render time → `next build` failed for all pages. Moved to a post-mount `useEffect`.
- [x] Add a responsive mobile sidebar drawer to `frontend/app/dashboard/layout.tsx` (app is currently desktop-only at a fixed 220px sidebar)
- [x] Add `aria-label`s to all icon-only buttons across `frontend/app/` (19 buttons across 12 files; close/download/edit/delete/pagination controls)
- [x] Build a reusable `<Skeleton />` primitive and replace full-page spinners with skeleton loaders on the main list pages (workers, reports, shifts)
- [x] Add request-ID middleware on the backend and attach it as a Sentry correlation tag + return it in error responses — **already implemented** in `server.js` (commit `ef91788`): `req.requestId` + `X-Request-Id` header, Sentry tag, and `requestId` in error responses
- [x] Fix the N+1 query in bulk shift assignment (`backend/src/routes/shift-assignments.js`) — batched `validateComplianceForWorkers()` (constant 4 queries vs ~5×N); shared `computeCompliance()` keeps single/bulk paths identical

## P2 — Maintainability (DRY) & dead code
- [x] Extract the repeated Clerk `getToken + fetch + headers` boilerplate into a shared `useApi`/`apiFetch` helper and adopt it in the highest-traffic pages first — created `lib/use-api.ts`; adopted on dashboard, workers, documents pages
- [x] Migrate the remaining `getToken + fetch` sites to `useApi` — 9 files, 26 fetch sites migrated; only legit `getToken` left is for `lib/api/*` helpers (downloadDocument/getDocumentStatus/pollDocumentStatus) in `workers/[id]` + `documents`
- [x] Extract duplicated status-badge color logic into a single shared badge component/util — created `components/ui/status-badge.tsx` (`<StatusBadge>` + `getStatusStyle`); adopted on workers list, documents table, WorkerDetailModal
- [x] Dedupe shift-confirmation badges into `components/ui/confirmation-badge.tsx` (`<ConfirmationBadge>`), adopted in `AssignmentList` + `assigned-shifts`. **Decided against** folding worker-portal doc badges + worker-list RAG into one component: vocabularies collide ("PENDING" = amber "Pending Review" for docs vs gray "Pending" for confirmation), the worker portal uses a deliberately different palette, and RAG is a numeric score→bucket, not a status string.
- [x] Make `<Modal>` reusable for full header/body/footer modals (added `padded` prop) and migrated `DeleteConfirmationModal` onto it as the first faithful adoption (zero visual change + gained ESC/click-outside close)
- [blocked] **Finish modal consolidation — needs the human's canonical-style decision.** Remaining modals split into two visual languages: generic Tailwind (`ShiftModal`, `BulkUploadModal`, `AuditPackModal`: `rounded-lg`/`shadow-lg`/`max-h-96`) vs design-system (`EditWorkerModal`, `WorkerDetailModal`: `rounded-xl`/`shadow-2xl`/`backdrop-blur`). A blind migration would change shadows/radius/max-height/blur — unverifiable visual churn. **Knight's recommendation:** make the **design-system style canonical** (the dashboard is the primary surface and uses hex tokens), restyle `<Modal>` to it, then migrate all modals. Tell the Knight "use design-system, go" to unblock — it's then mechanical.
- [x] Replace remaining native `window.confirm()` destructive actions with the styled `ConfirmDialog` — the last one (`AssignmentList` unassign-worker) now uses `<ConfirmDialog>`
- [x] Hide the dead `/dashboard/availability` route — removed the sidebar nav item (page was a non-persisting coordinator stub). Page kept as an unlinked placeholder for the P3 availability calendar.

## P3 — Feature expansion (Wave C)
- [x] Cmd+K command palette (first slice) — `components/ui/command-palette.tsx`, mounted in the dashboard layout; ⌘K/Ctrl+K, client-side fuzzy filter over navigation + quick actions, full keyboard nav
- [x] Cmd+K follow-ups: added a visible "Search… ⌘K" sidebar affordance (opens the palette via a custom event) + live **worker** search in the palette (debounced, via `useApi` → `/api/workers?search=`), unified keyboard nav across pages + workers
- [x] Extend Cmd+K live search to **shifts** (parallel debounced fetch via `/api/shifts?facilityName=`, grouped results). **Documents deliberately not searched** — no document search endpoint or detail route; doc hits would have no deep-link target distinct from worker search. Revisit only if a `/api/documents?search=` endpoint + a doc target are added.
- [x] Worker availability calendar — revived `/dashboard/availability` as a real, light-themed coordinator page (worker picker + month calendar) that **persists** AVAILABLE/UNAVAILABLE/ON_LEAVE via the existing `/api/workers/:id/availability` API; re-added the sidebar nav item
- [x] Re-theme the worker detail page (`dashboard/workers/[id]/page.tsx`) from dark (slate/white) to the light design system — converted ~100 className lines (cards→white/`#DDE3EE`, text→`#0A1628`/`#5B6E8C`, translucent-on-dark accents→light `*-50/*-700`), logic untouched. ⚠️ Needs a human visual pass (re-themed blind; build + grep verified, but not eyeballed).
- [x] Shift templates — **entity + backend API** slice: `ShiftTemplate` model (pushed to Supabase), `routes/shift-templates.js` CRUD (list/create/delete, agency-scoped) mounted at `/api/shift-templates`, +7 passing tests
- [x] Shift templates — **frontend slice:** new `/dashboard/shifts/templates` page (list/create/delete via `useApi` → `/api/shift-templates`) + per-template "pick a date → Create shift" action (POST `/api/shifts`); linked from the Shifts page header
- [blocked] Shift templates — **recurring auto-poster:** needs the human's go-ahead + a scheduling design decision. It's a **side-effecting cron** (auto-creates shifts on a cadence) — risky to build blind. **Knight's recommendation:** add recurrence fields to `ShiftTemplate` (cadence, daysOfWeek, postHorizonDays, active) + a daily cron in `cronService` that generates the next shifts and dedups against existing ones. Tell the Knight "build the auto-poster" to greenlight (then I'd do it as a council-designed multi-slice effort).
- [x] Worker shifts summary (the "earnings dashboard" item) — added a read-only summary row (Assigned / Upcoming / Completed / Total hours) to `/worker/dashboard/assigned-shifts`, computed from real assignment data. **No £ earnings** — there is no pay-rate data in the schema; showing money would be fabricated. See follow-up below.
- [ ] (If wanted) £ earnings — add a pay-rate model (per-worker or per-role/shift hourly rate) so the worker summary can show actual pay. Needs the human (rates are business data).

## P4 — Code quality & performance
- [x] Introduce a shared `frontend/types/api.ts` (Worker, DocumentType, ComplianceDocument, DocSlot, AnalysisResult, Shift, ShiftAssignment, ShiftTemplate, Paginated) and adopted it in `workers/[id]/page.tsx` — replaced the 9 worst `any`s (state vars, modal props, analysis result, slot, params). Build clean.
- [ ] Continue `any` cleanup using `types/api.ts`: adopt the shared types in other high-`any` files (compliance, documents, shifts pages); leave low-value `catch (err: any)` as-is
- [ ] Add `useMemo`/`useCallback` + debounced search to heavy tables so they stop re-rendering on every keystroke
- [ ] Add a custom Helmet CSP to the backend (currently using Helmet defaults)
- [ ] Extend skeleton loaders (using the new `<Skeleton />`) to the remaining full-page spinners: audit-log, documents, audit-packs, compliance, worker dashboard pages
- [ ] Set `requestId` as a per-request Sentry scope tag (after the Sentry requestHandler) so ALL events in a request carry it, not just the manually-captured exception in the global error handler
- [ ] Fix the buggy `should reject non-OWNER/ADMIN users` test in `shift-assignments.test.js` (auth mock always forces OWNER) and make backend integration suites (worker-*, security-pipeline) runnable without a live Postgres (test DB or mock)
