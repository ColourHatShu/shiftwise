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
- [ ] Migrate the remaining `getToken + fetch` sites to `useApi` (`workers/[id]`, `compliance`, `reports`, `settings`, `audit-log`, `onboarding`, `workers/new`, `EditWorkerModal`, `dashboard/layout`)
- [ ] Extract duplicated status-badge color logic (~6 files) into a single shared badge component/util
- [ ] Consolidate duplicated modal wrappers (~4 files) into one reusable `<Modal>` component
- [ ] Replace any remaining native `window.confirm()` destructive actions with the existing `components/ui/confirm-dialog.tsx`
- [ ] Hide or finish the dead `/dashboard/availability` route (remove it from the sidebar if not implemented)

## P3 — Feature expansion (Wave C)
- [ ] Cmd+K universal search + quick actions (workers, shifts, documents) — high demo value, scoped to client-side fuzzy search first
- [ ] Worker availability calendar (mark available/unavailable days; foundation for rota)
- [ ] Shift templates + recurring auto-poster (saves coordinators hours/week) — start with the template entity + create-from-template flow
- [ ] Worker earnings dashboard (read-only summary of completed/assigned shifts)

## P4 — Code quality & performance
- [ ] Introduce a shared `frontend/types/api.ts` and start replacing the worst `any` usages (begin with `workers/[id]/page.tsx`)
- [ ] Add `useMemo`/`useCallback` + debounced search to heavy tables so they stop re-rendering on every keystroke
- [ ] Add a custom Helmet CSP to the backend (currently using Helmet defaults)
- [ ] Extend skeleton loaders (using the new `<Skeleton />`) to the remaining full-page spinners: audit-log, documents, audit-packs, compliance, worker dashboard pages
- [ ] Set `requestId` as a per-request Sentry scope tag (after the Sentry requestHandler) so ALL events in a request carry it, not just the manually-captured exception in the global error handler
- [ ] Fix the buggy `should reject non-OWNER/ADMIN users` test in `shift-assignments.test.js` (auth mock always forces OWNER) and make backend integration suites (worker-*, security-pipeline) runnable without a live Postgres (test DB or mock)
