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
- [x] **Finish modal consolidation** — founder chose design-system canonical (2026-06-30 "use design-system, go"). Restyled `<Modal>` to design-system (rounded-xl, border `#DDE3EE`, shadow-2xl, `bg-black/40 backdrop-blur` overlay) and migrated the 5 remaining bespoke modals onto it (`WorkerDetailModal`, `AuditPackModal`, `BulkUploadModal`, `ShiftModal`, `EditWorkerModal`). All modals now share `<Modal>`. ⚠️ Needs a visual pass.
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
- [x] Continue `any` cleanup using `types/api.ts` — adopted shared types in `documents/page.tsx` (typed `workers`, `getComputedStatus`, `getComplianceScore`, the reduce/map callbacks; added `Worker.complianceDocuments`). Remaining app `any`s are mostly low-value `catch (err: any)`; shifts/compliance pages had ≤1 each.
- [x] `useMemo` heavy table rows — workers list rows are now `useMemo`'d over `[workers]` (with `getRAGStatus`/RAG colors hoisted to module scope for stable deps), so keystrokes in the local-state search box don't rebuild the table. Search was already debounced (300ms). Other tables (compliance/audit-log) can get the same treatment if they grow.
- [ ] Add a custom Helmet CSP to the backend — ⚠️ **risky blind:** a wrong enforcing CSP can white-screen the app by blocking Clerk/Sentry/Next scripts, and it only manifests at runtime in a browser (build/lint can't catch it). **Knight's recommendation:** ship it in **Report-Only** mode first (non-breaking, logs violations), enumerate the real origins (Clerk, Sentry, Supabase, fonts/images) from the reports, THEN flip to enforce. Needs a browser pass to confirm — greenlight with "do the CSP (report-only)".
- [x] Extend skeleton loaders to remaining full-page spinners — replaced the full-page spinners on `documents` + `audit-log` with layout-matching `<Skeleton>` loaders (role=status + sr-only). `audit-packs`, `compliance`, and the worker dashboard have **no full-page spinner** (inline/per-section loading), so nothing to change there.
- [x] Set `requestId` as a per-request Sentry scope tag (all events carry it) — **AND fixed a latent P0**: the Sentry setup used v7 APIs (`Sentry.Handlers.*`, `new Sentry.Integrations.*`) that are `undefined` in the installed `@sentry/node` v10, so enabling `SENTRY_DSN` would crash the backend on boot. Migrated to v8+/v10 (default integrations; dropped the dead requestHandler/errorHandler; manual `captureException` retained) + added a `Sentry.setTag('requestId', …)` middleware.
- [ ] Fix the buggy `should reject non-OWNER/ADMIN users` test in `shift-assignments.test.js` (auth mock always forces OWNER) and make backend integration suites (worker-*, security-pipeline) runnable without a live Postgres (test DB or mock)

## P5 — Ideated 2026-06-30 (autonomously buildable, verifiable; not decision-gated)
- [ ] **Manage Document Types** — Settings UI (+ backend route if missing) to CRUD an agency's required compliance document types (name, required?, hasExpiry, warning days). This is core compliance config and there's currently no UI for it. Verify whether a `/api/document-types` route exists; build/extend as needed.
- [ ] **Bulk worker CSV import** — mirror the existing shifts-bulk flow: a backend parse/validate endpoint + a frontend upload modal on the Workers page (download a template, upload CSV, show per-row results). Saves coordinators from manual entry.
- [ ] **GitHub Actions CI** — `.github/workflows/ci.yml` running frontend `npm run build` + `npm run lint` and backend route/unit tests (the mocked-prisma suites; exclude the live-Postgres integration suites). Catches regressions on every push.
- [ ] **Modal focus management (a11y)** — add a focus trap + focus-the-first-element-on-open + return-focus-on-close to the shared `<Modal>` (now that every modal uses it, this is high-leverage). Verifiable by build; improves keyboard/screen-reader UX.
- [ ] **Empty-state consistency** — audit dashboard pages for missing/blank empty states and add the design-system empty state (icon tile + message + optional CTA), matching the workers/documents pattern.
- [ ] **Harden startup env validation** — in `server.js`, validate critical env on boot and fail fast with a clear message (DATABASE_URL always; JWT_SECRET + CLERK_SECRET_KEY in production), instead of warning and crashing later on first use.
