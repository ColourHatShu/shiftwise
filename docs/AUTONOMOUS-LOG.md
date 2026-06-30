# 🛡️ Autonomous Knight — Progress Log

> Newest entries on top. The Knight prepends one entry per firing. This is the
> file the human reads to see what shipped while they were away.

## 2026-06-30 09:44 — Migrate remaining getToken+fetch sites to useApi
- **Item:** Migrate the remaining getToken+fetch sites to the shared useApi() hook
- **Outcome:** shipped
- **Changes:** 9 files, **26 fetch sites** migrated to `apiFetch`: `workers/[id]/page.tsx` (7, 3 components), `compliance/page.tsx` (8), `reports/page.tsx` (3), `settings/page.tsx` (2), `audit-log/page.tsx` (1), `onboarding/page.tsx` (1), `workers/new/page.tsx` (1), `EditWorkerModal.tsx` (1), `dashboard/layout.tsx` (2). Removed dead local `API_URL` consts; updated useEffect/useCallback dep arrays (getToken/API_URL → apiFetch); dropped redundant Authorization + JSON Content-Type headers.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only). Also grep-verified zero remaining `${API_URL}`/`Bearer ${token}`/`const API_URL` and no dangling `headers` var.
- **Commit:** see git — 🛡️ refactor(web): migrate remaining auth-fetch sites to useApi
- **Notes / decisions:** Ran a parallel workflow (one agent per file, 9 agents) so each file's nuances were handled in isolation — notably `workers/[id]` correctly KEPT `getToken` (still passed to `downloadDocument`/`getDocumentStatus`/`pollDocumentStatus`) while removing it where unused. The dashboard's auth-fetch boilerplate is now centralized in `lib/use-api.ts`. The only `getToken` references left in the app are the `lib/api/*` helper calls; migrating those helpers to internally use the hook/token is a separate, optional refactor (not queued — low value right now).

## 2026-06-30 09:34 — Shared useApi() helper (kill getToken+fetch boilerplate)
- **Item:** Extract the repeated Clerk getToken+fetch+headers boilerplate into a shared useApi/apiFetch helper, adopt in highest-traffic pages first
- **Outcome:** shipped
- **Changes:** new `frontend/lib/use-api.ts` — `useApi()` hook returning `apiFetch(path, options)` that auto-attaches the Clerk bearer token, prepends `NEXT_PUBLIC_API_URL`, and sets JSON `Content-Type` for non-FormData bodies; returns the raw `Response` so adoption is a drop-in. Adopted on the 3 highest-traffic coordinator pages: `dashboard/page.tsx`, `dashboard/workers/page.tsx`, `dashboard/documents/page.tsx` (removed their local `API_URL` consts + inline token/header plumbing).
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ refactor(web): shared useApi() hook + adopt on top pages
- **Notes / decisions:** Returns `Response` (not parsed JSON) deliberately so each caller keeps its own `res.ok`/`res.json()` error handling — makes adoption a 1-line swap and avoids changing error semantics across the app. Left `getToken` in `documents/page.tsx` because `downloadDocument(id, getToken)` still needs it. Did NOT migrate all ~12 files in one firing (too large/risky) — queued the remaining 9 sites as a follow-up so each batch can be verified.

## 2026-06-30 09:24 — Fix N+1 in bulk shift assignment
- **Item:** Fix the N+1 query in bulk shift assignment — batch the per-worker findFirst + compliance validation
- **Outcome:** shipped
- **Changes:** `lib/compliance-assignment.js` — extracted pure `computeCompliance()` helper, refactored `validateComplianceAtTime` to use it (identical output), added batched `validateComplianceForWorkers(workerIds, shiftId, agencyId)` (returns a Map). `routes/shift-assignments.js` — `assign-bulk` Phase 1 now does ONE batched call instead of per-worker `worker.findFirst` + `validateComplianceAtTime`. Updated `tests/routes/shift-assignments.test.js` for the batched path + fixed a missing `prisma.worker.count` mock.
- **Verify:** backend `npm test` — **30→28 failures (fixed 2, ZERO new)**, 121→123 passing. Targeted file: 3→1 failing. Confirmed via stash baseline comparison. (frontend untouched; backend has no lint script.)
- **Commit:** see git — 🛡️ perf(shifts): batch bulk-assign compliance checks (kill N+1)
- **Notes / decisions:** Bulk assignment of N workers went from ~5×N queries (per-worker: worker lookup + re-fetching the SAME shift + SAME required doc types + that worker's docs) to a constant **4 queries** for the whole batch (shift, all workers, doc types, all docs — grouped in memory). For 100 workers that's ~500 queries → 4. Chose to add a batched function + extract a shared pure `computeCompliance()` rather than rewrite the existing single-worker function, so the single/bulk paths can never diverge on compliance logic (a correctness risk for a compliance product). Phase-2 (row creation) left as-is — those are necessary writes with per-row P2002 handling. **Pre-existing failures the human should know about (NOT caused by this firing):** the integration suites (`security-pipeline`, `worker-e2e`, `worker-auth`, `worker-dashboard`, `worker-assignments`) need a live Postgres that isn't available in the Knight's environment; and `shift-assignments.test.js` has one genuinely buggy test (`should reject non-OWNER/ADMIN users`) whose auth mock always forces role OWNER so a VIEWER 403 can't be exercised. Queued a backlog item to fix that test + the DB-test story.

## 2026-06-30 09:14 — Request-ID middleware (no-op: already implemented)
- **Item:** Add request-ID middleware + Sentry correlation tag + return ID in error responses
- **Outcome:** no-op (already done)
- **Changes:** none to code — plan/log only
- **Verify:** n/a (docs-only; no code touched)
- **Commit:** see git — 🛡️ docs(knight): mark request-ID item done (already shipped in ef91788)
- **Notes / decisions:** Verified in `backend/src/server.js`: request-ID middleware (lines ~45-49) sets `req.requestId` from the `x-request-id` header or a fresh `crypto.randomUUID()` and echoes it via the `X-Request-Id` response header; the global error handler tags Sentry with `requestId` and includes `requestId` in the JSON error body. `git log -S` attributes all of this to the super-ready hardening commit `ef91788`. Nothing to build. **Next firing should take the N+1 fix in `shift-assignments.js`** (the next P1 item). Optional future enhancement (NOT done, would be a new item): set `requestId` as a Sentry *scope* tag per-request so ALL events in a request carry it, not only the manually-captured exception.

## 2026-06-30 09:04 — Skeleton loaders replace full-page spinners
- **Item:** Build a reusable `<Skeleton />` primitive and replace full-page spinners on the main list pages
- **Outcome:** shipped
- **Changes:** new `frontend/components/ui/skeleton.tsx` (animate-pulse primitive, design-system colors, aria-hidden); replaced spinners with layout-matching skeletons in `dashboard/workers/page.tsx` (header + 4 stat cards + table rows), `dashboard/shifts/components/ShiftCalendar.tsx` (toolbar + 7×5 month grid), and `dashboard/reports/page.tsx` (metric cards + rows). Each loading container carries `role="status"` + an `sr-only` label.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ feat(ui): reusable Skeleton primitive + skeleton loaders
- **Notes / decisions:** Chose layout-mimicking skeletons (perceived-performance win + no layout shift) over a generic block. Kept the primitive lean and composed page-specific shapes inline with Tailwind sizing. `Loader2` import in reports retained (still used by the PDF-download buttons). Many other pages still use full-page spinners (audit-log, documents, worker dashboard, etc.) — added a follow-up backlog item to extend the pattern.

## 2026-06-30 08:54 — Accessibility: aria-labels on icon-only buttons
- **Item:** Add `aria-label`s to all icon-only buttons across `frontend/app/`
- **Outcome:** shipped
- **Changes:** 12 files, 19 buttons labeled — close-dialog/close-preview (modals & overlays), prev/next month & period (availability + ShiftCalendar), edit/delete shift, download/replace document, toggle review actions
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ feat(a11y): aria-labels on icon-only buttons
- **Notes / decisions:** Ran a parallel workflow (one agent per file, 25 files scanned) so each icon-only button got a context-specific label rather than a generic one. Verified the diff is aria-label-only (no logic/style changes); the only "deletions" are existing `<button>` lines rewritten with the attribute inserted. Icon buttons that already had text labels were left untouched. Follow-up: components outside `app/` (e.g. `components/ui/`) were out of scope for this item and could be swept later if any icon-only buttons exist there.

## 2026-06-30 08:44 — Mobile sidebar drawer (+ fixed P0 build-breaker)
- **Item:** Add a responsive mobile sidebar drawer to `frontend/app/dashboard/layout.tsx`
- **Outcome:** shipped
- **Changes:** `frontend/app/dashboard/layout.tsx` (hamburger top bar, slide-in drawer `fixed`→`md:sticky`, backdrop, close-on-navigate, body-scroll lock, aria-labels on new controls); `frontend/app/worker/dashboard/shifts/page.tsx` (P0 fix below)
- **Verify:** build ✅ (24/24 pages), lint ✅ (only pre-existing warnings), tests ⏭️ skipped (frontend-only change)
- **Commit:** see git — 🛡️ feat(dashboard): responsive mobile sidebar drawer + fix SSR build-breaker
- **Notes / decisions:** While running the verify gate I discovered the **production build was already fully broken** (pre-existing, unrelated to this item): `worker/dashboard/shifts/page.tsx` accessed `localStorage` at render time, so `next build` threw `ReferenceError: localStorage is not defined` during static prerender and failed for the whole app. Since a green build is a prerequisite for verifying ANY frontend work, I fixed it surgically (read storage in a post-mount `useEffect`) rather than block the firing. Audited all other `localStorage` uses — the rest are inside runtime fetch handlers and are safe. The app is now usable on mobile and the build is green again.

## 2026-06-30 — Knight initialized
- **Item:** Bootstrap the autonomous build loop
- **Outcome:** planning
- **Changes:** created `docs/AUTONOMOUS-KNIGHT.md`, `docs/AUTONOMOUS-PLAN.md`, `docs/AUTONOMOUS-LOG.md`, `docs/IDEAS.md`; gitignored `.knight-lock`
- **Verify:** n/a (docs only)
- **Commit:** pending — chore(knight): bootstrap autonomous build loop
- **Notes / decisions:** Backlog seeded from the 2026-05-27 Super-Ready Council audit. Cron fires every 10 min. Each firing re-reads the playbook from disk and ships one item. First real item: P1 mobile sidebar drawer.
