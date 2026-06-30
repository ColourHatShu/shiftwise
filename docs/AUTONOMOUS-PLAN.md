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
- [ ] Add `aria-label`s to all icon-only buttons across `frontend/app/` (currently zero); make the app screen-reader navigable
- [ ] Build a reusable `<Skeleton />` primitive and replace full-page spinners with skeleton loaders on the main list pages (workers, reports, shifts)
- [ ] Add request-ID middleware on the backend and attach it as a Sentry correlation tag + return it in error responses
- [ ] Fix the N+1 query in bulk shift assignment (`backend/src/routes/shift-assignments.js`) — batch the per-worker `findFirst` + compliance validation instead of looping

## P2 — Maintainability (DRY) & dead code
- [ ] Extract the repeated Clerk `getToken + fetch + headers` boilerplate (~98 sites) into a shared `useApi`/`apiFetch` helper and adopt it in the highest-traffic pages first
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
