# 🛡️ Autonomous Knight — Progress Log

> Newest entries on top. The Knight prepends one entry per firing. This is the
> file the human reads to see what shipped while they were away.

## 2026-06-30 13:22 — Ideation pass (backlog refill)
- **Item:** (no implementation) — ran an ideation pass because only ~2 non-blocked items remained (below the playbook's "keep the loop fed" threshold)
- **Outcome:** planning
- **Changes:** added a **P5 — Ideated 2026-06-30** section to `AUTONOMOUS-PLAN.md` with 6 autonomously-buildable, verifiable, non-decision-gated items: Manage Document Types (Settings UI), Bulk worker CSV import, GitHub Actions CI, Modal focus management (a11y), Empty-state consistency, Harden startup env validation. Added a "Surfaced 2026-06-30" section to `IDEAS.md` (worker scorecards, no-show workflow, in-app notifications centre, doc re-upload nudges, handoff notes, care-home rolodex).
- **Verify:** n/a (docs/planning only)
- **Commit:** see git — 🛡️ docs(knight): ideation pass — refill backlog (P5 items)
- **Notes / decisions:** Verified each promoted item is a real gap before adding (no document-types UI, no worker bulk import, no CI workflow, no modal focus trap, minimal env validation). Kept the remaining gated items as-is: £ earnings (needs human/business data), Helmet CSP (needs browser verification — report-only recommendation recorded). Next firings will implement the P5 items + the two leftover P4 items (requestId Sentry scope tag, fix buggy role test). Implementation resumes next firing (kept this one to planning per the playbook).

## 2026-06-30 13:12 — Extend skeleton loaders (documents + audit-log)
- **Item:** Extend skeleton loaders to remaining full-page spinners
- **Outcome:** shipped
- **Changes:** replaced the full-page centered spinners on `dashboard/documents/page.tsx` (header + 3 summary cards + worker cards w/ doc rows) and `dashboard/audit-log/page.tsx` (header + filter card + table header/rows) with layout-matching `<Skeleton>` loaders (each wrapped in `role="status"` + an `sr-only` "Loading…"). Added the `Skeleton` import to both.
- **Verify:** build ✅ (✓ Compiled successfully, 25/25), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only). Confirmed Skeleton imported in both + the documents full-page `animate-spin` removed.
- **Commit:** see git — 🛡️ feat(ui): skeleton loaders for documents + audit-log
- **Notes / decisions:** Ran a 5-agent workflow; `audit-packs`, `compliance`, and the worker dashboard were correctly left unchanged — they have **no full-page spinner** (they render immediately with inline/per-section loading), so forcing a skeleton there would be wrong. **Deferred the Helmet CSP item** (the next P4 item): an enforcing CSP is risky to ship blind (can break Clerk/Sentry/Next at runtime; unverifiable without a browser). Recorded a Report-Only-first recommendation in the plan for when the founder greenlights it.

## 2026-06-30 13:03 — Memoize workers table rows
- **Item:** Add useMemo/useCallback + debounced search to heavy tables (stop re-rendering on keystroke)
- **Outcome:** shipped
- **Changes:** `dashboard/workers/page.tsx` — hoisted `getRAGStatus` + the RAG color map to module scope (pure, stable deps), then wrapped the rendered worker rows in `useMemo(() => workers.map(...), [workers])`. The search input is local state (`searchInputValue`) and was already debounced (300ms); now typing in it no longer rebuilds the table rows (they only depend on `workers`). Replaced the inline `workers.map` in the tbody with `{workerRows}`.
- **Verify:** build ✅ (✓ Compiled successfully, 25/25), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only). Rows JSX preserved verbatim — behavior identical.
- **Commit:** see git — 🛡️ perf(web): memoize workers table rows
- **Notes / decisions:** Applied to the workers list (the canonical heavy table). The perf win is modest at typical agency sizes but it's correct and removes needless work; the same `useMemo` pattern can be applied to compliance/audit-log tables if they grow (noted in the plan). Skipped the human-gated £-earnings item.

## 2026-06-30 12:52 — Modal consolidation complete (design-system canonical)
- **Item:** Finish modal consolidation (founder greenlit "use design-system, go")
- **Outcome:** shipped (⚠️ needs a visual pass)
- **Changes:** `components/ui/modal.tsx` — restyled `<Modal>` to the design system: `rounded-xl`, `border-[#DDE3EE]`, `shadow-2xl`, `bg-black/40 backdrop-blur` overlay, `#0A1628`/`#5B6E8C` header. Migrated the 5 bespoke modals onto `<Modal padded=…>` (removing their own overlay+card + redundant Esc/return-null): `WorkerDetailModal`, `AuditPackModal` (padded default), `BulkUploadModal`, `ShiftModal`, `EditWorkerModal` (isOpen={true}, dropped its manual Esc effect). The modals already using `<Modal>` (AssignModal, ConfirmModal, DeleteConfirmationModal, ConfirmDialog) inherit the new canonical look automatically.
- **Verify:** build ✅ (✓ Compiled successfully), lint ✅ (0 errors); grep-verified **zero `fixed inset-0` left** in the 5 migrated files + Modal imported in all 5. Done via a 5-agent parallel workflow with tailored per-modal specs.
- **Commit:** see git — 🛡️ refactor(ui): consolidate all modals onto design-system <Modal>
- **Notes / decisions:** Every modal in the app now shares one `<Modal>` (single overlay/Esc/click-outside/focus behaviour + one canonical look) — closes the council's duplicated-modal-wrappers finding. This is a broad visual change I can't verify on screen (no localhost here) — **please eyeball the modals**; build/grep gate structure, but shades/spacing want a human glance. ShiftModal/BulkUploadModal keep a now-redundant inner close button (kept per "don't alter inner JSX"); could be removed later.

## 2026-06-30 12:42 — Type the documents page with types/api.ts
- **Item:** Continue `any` cleanup — adopt shared types in another high-`any` file
- **Outcome:** shipped
- **Changes:** `dashboard/documents/page.tsx` — replaced 7 of 8 `any`s with shared types (`workers: Worker[]`, `getComputedStatus(doc: ComplianceDocument | null): string`, `getComplianceScore(docs: ComplianceDocument[])`, the three reduce/map callbacks). Added `Worker.complianceDocuments?: ComplianceDocument[]` to `types/api.ts` (the `/api/documents/agency` shape). Hardened `getComputedStatus` to always return a string (`?? "NOT_UPLOADED"`).
- **Verify:** build ✅ (✓ Compiled successfully, 25/25), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ refactor(types): type the documents page
- **Notes / decisions:** documents/page.tsx was the biggest remaining `any` offender (8); now only the low-value `catch (err: any)` remains there (kept — converting needs `instanceof` guards for little gain). shifts/compliance pages had ≤1 `any` each, so the app-wide `any` cleanup is largely done. Skipped the human-gated £-earnings item again.

## 2026-06-30 12:32 — Shared types/api.ts + replace worst `any`s
- **Item:** Introduce `frontend/types/api.ts` and start replacing the worst `any` usages
- **Outcome:** shipped
- **Changes:** new `frontend/types/api.ts` (Worker, DocumentType, ComplianceDocument, DocSlot, AnalysisResult, Shift, ShiftAssignment, ShiftTemplate, Paginated). Adopted in `dashboard/workers/[id]/page.tsx` — typed the 9 worst `any`s: both modal prop bags (UploadModal/AnalysisModal), `result` (AnalysisResult), `useParams()`/`workerId`, `worker` (Worker), `docSlots` (DocSlot[]), `uploadTarget` (DocumentType), `analysisTarget` (ComplianceDocument), and the `docSlots.map` callback.
- **Verify:** build ✅ (✓ Compiled successfully, 25/25), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Notes / decisions:** Skipped the top backlog item (£ earnings — pay-rate model) as it's explicitly **human-gated** (business data). Made interface fields permissive/optional (supersets of each endpoint's response) so the same types reuse cleanly and existing usages compile. Left low-value `catch (err: any)` (7) as-is — converting them needs `instanceof` guards everywhere for little gain. Queued a follow-up to extend the shared types to other high-`any` files.
- **Commit:** see git — 🛡️ refactor(types): shared types/api.ts + type worker detail page

## 2026-06-30 12:22 — Worker shifts summary (honest "earnings" — no fake £)
- **Item:** Worker earnings dashboard (read-only summary of completed/assigned shifts)
- **Outcome:** shipped (as a shifts/hours summary)
- **Changes:** `worker/dashboard/assigned-shifts/page.tsx` — added a read-only summary stats row (Assigned / Upcoming / Completed / Total hours) computed from the assignments the page already fetches (uses the existing `durationHours` helper). No extra fetch.
- **Verify:** build ✅ (25/25), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ feat(worker): shifts summary on assigned-shifts
- **Notes / decisions:** **Refused to fabricate £ earnings** — there is NO pay-rate/wage data anywhere in the schema (grep-confirmed), so a monetary "earnings" figure would be invented numbers (the same trust-hole class as the old `Math.random()` compliance scores the council flagged). Built the honest version — a shifts/hours summary on real data — and queued "£ earnings needs a pay-rate model" as a human-gated follow-up. Also **blocked the recurring auto-poster** (top item): it's a side-effecting scheduler (auto-creates shifts) that needs a design decision + the human's go-ahead — recorded a recommendation in the plan rather than building a shift-spamming cron blind.

## 2026-06-30 12:12 — Shift templates: frontend (slice 2)
- **Item:** Shift templates — frontend slice (templates UI + create-from-template)
- **Outcome:** shipped
- **Changes:** new `frontend/app/dashboard/shifts/templates/page.tsx` — light design-system page: list templates, create (form), delete (ConfirmDialog), and a per-template "pick a date → Create shift" action; all via `useApi` (`/api/shift-templates` + `POST /api/shifts`). Added a "Templates" link to the Shifts page header (`dashboard/shifts/page.tsx`).
- **Verify:** build ✅ (25/25 — new route at 5.31 kB), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only; API tested in slice 1)
- **Commit:** see git — 🛡️ feat(shifts): shift templates UI + create-from-template
- **Notes / decisions:** Used `useApi` (Clerk bearer) rather than the bare relative `/api` calls the legacy shifts page uses — that's the proven path for `requireAgency` backend routes. create-from-template reuses the existing `POST /api/shifts` (no new endpoint). Shift templates feature is now usable end-to-end (define a template → one-click dated shift). Remaining slice: the recurring auto-poster (needs a scheduler design).

## 2026-06-30 12:03 — Shift templates: entity + backend API (slice 1)
- **Item:** Shift templates — start with the template entity + create-from-template flow
- **Outcome:** shipped (slice 1 of 3: entity + API)
- **Changes:** `prisma/schema.prisma` — new `ShiftTemplate` model (agency-scoped reusable shift def: name, facility, start/end, role, requiredCount, complianceCheckup, notes; `@@unique([agencyId, name])`) + Agency relation. **Pushed to Supabase via `prisma db push`** (new `shift_templates` table, additive). New `routes/shift-templates.js` — CRUD (GET list / POST create with validation + P2002 dup handling / DELETE with agency-ownership check), mounted at `/api/shift-templates`. New `tests/routes/shift-templates.test.js` (7 tests).
- **Verify:** backend `npm test` — **130 passed / 28 failed** (was 123/28: **+7 new, ZERO new failures**); route `require()` loads clean; db push synced + client regenerated. Frontend untouched (no FE build needed).
- **Commit:** see git — 🛡️ feat(shifts): ShiftTemplate entity + CRUD API
- **Notes / decisions:** Scoped to the **entity + API** first (per "start with the template entity"); queued the **frontend create-from-template UI** and the **recurring auto-poster** (needs a scheduler design) as separate slices. Distinct from the existing `ShiftRequirement` model (that's document-requirements-per-role, not a reusable shift definition). Used `db push` (not `migrate`) to add the table, consistent with how this project's Supabase DB is managed (migrations lag schema — see SUPABASE.md); the table is additive so no data risk. create-from-template will reuse the existing `POST /api/shifts` (no new endpoint needed).

## 2026-06-30 11:52 — Re-theme worker detail page (dark → light)
- **Item:** Re-theme `dashboard/workers/[id]/page.tsx` from dark to the light design system
- **Outcome:** shipped (⚠️ needs a human visual pass)
- **Changes:** converted ~100 className lines across all 3 components (UploadModal, AnalysisModal, WorkerProfilePage): cards `bg-slate-800/*`→`bg-white`, borders→`border-[#DDE3EE]`, inset tiles→`bg-[#F5F7FA]`, headings/values→`text-[#0A1628]`, muted→`text-[#5B6E8C]`, translucent-on-dark accents (`bg-blue-500/10 text-blue-400` etc.)→light (`bg-blue-50 text-blue-700`), removed the dark-only date-picker `invert` filter, overlays `bg-black/60`→`bg-black/40`. Colored action buttons (blue-600/green-600) kept white text.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0, only a pre-existing exhaustive-deps warning), tests ⏭️ skipped (frontend-only). **Objective completeness checks:** `grep` confirms ZERO `slate-*` classes remain; no `bg-white … text-white` (white-on-white); diff is 100 ins / 100 del (pure className swaps, logic untouched).
- **Commit:** see git — 🛡️ style(workers): re-theme worker detail page to light design system
- **Notes / decisions:** This is a purely-visual change I **cannot verify visually** (no localhost from here), so I did it as a deterministic color-token mapping and gated it with objective checks (grep-clean of dark classes + build + anti-pattern grep) rather than eyeballing. **Please do a quick visual pass on `/dashboard/workers/<id>`** — if any shade is off, tell me and I'll adjust. This closes the council's last dark-theme leak; the coordinator app is now uniformly light.

## 2026-06-30 11:42 — Worker availability calendar (persistent) — first firing on main
- **Item:** Worker availability calendar (mark available/unavailable days; foundation for rota)
- **Outcome:** shipped
- **Changes:** rewrote `dashboard/availability/page.tsx` — a real, light-themed coordinator page: worker `<select>` picker + month calendar; each day toggles AVAILABLE/UNAVAILABLE/ON_LEAVE and **persists** via the existing API (`GET/POST/DELETE /api/workers/:id/availability`) with optimistic update + rollback; month nav, skeleton loading, legend. Re-added the "Availability" sidebar nav item (now functional) using the `CalendarDays` icon.
- **Verify:** build ✅ (24/24, route now 3.95 kB), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ feat(web): persistent worker availability calendar
- **Notes / decisions:** First firing committing **directly to `main`** per the new playbook. The backend availability API is coordinator-scoped (`requireAgency` + `:workerId`), so the calendar is a **per-worker coordinator view** (worker picker), which is why the old generic `/dashboard/availability` stub was dead (no worker context). Used local `ymd()` formatting to avoid UTC off-by-one. **Discovered + queued:** the worker detail page (`workers/[id]`) is still dark-themed (slate/white) — the last dark-theme leak in the coordinator app — so I put the calendar on its own light page rather than there.

## 2026-06-30 11:24 — Cmd+K: live shift search (workers + shifts in parallel)
- **Item:** Extend Cmd+K live search to shifts and documents
- **Outcome:** shipped (shifts done; documents deliberately deferred)
- **Changes:** `components/ui/command-palette.tsx` — the debounced search now fetches **workers + shifts in parallel** (`Promise.allSettled` so one failing doesn't kill the other) via `/api/workers?search=` and `/api/shifts?facilityName=`; results render in three keyboard-navigable groups (Pages & actions / Workers / Shifts) with a single loading flag. Shift hits navigate to `/dashboard/shifts`.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ feat(web): ⌘K live shift search
- **Notes / decisions:** **Documents intentionally NOT searched** — checked the backend: `/api/documents/agency` has no search param, and there's no document detail route, so doc hits would have no deep-link target distinct from worker search (and would require fetching the whole agency doc tree per keystroke). Recorded that rationale in the plan rather than building a low-value path. Shift hits land on the Shifts page (there's no per-shift route). Refactored worker+shift fetch into one parallel debounced effect; unified flat keyboard index across all three groups.

## 2026-06-30 11:11 — Cmd+K: visible affordance + live worker search
- **Item:** Cmd+K follow-ups — visible search affordance + live data search
- **Outcome:** shipped
- **Changes:** `components/ui/command-palette.tsx` — now opens on a custom `OPEN_COMMAND_PALETTE_EVENT` (in addition to ⌘K/Ctrl+K) and performs **live worker search** (debounced 250ms via `useApi` → `/api/workers?search=…&limit=5`); results are grouped ("Pages & actions" + "Workers") with a unified flat keyboard index and a loading spinner. `dashboard/layout.tsx` — added a visible "Search… ⌘K" button in the sidebar that dispatches the open event.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ feat(web): ⌘K visible affordance + live worker search
- **Notes / decisions:** Used a decoupled custom window event to open the palette from the sidebar button (avoids lifting state / a context provider). Scoped live search to **workers** (highest-value entity, endpoint already supports `?search=`); shifts + documents search queued as a follow-up. Debounce + a `cancelled` guard prevent stale/racey results. Couldn't visually verify (no localhost here) — build/lint pass.

## 2026-06-30 10:54 — Cmd+K command palette (first slice)
- **Item:** Cmd+K universal search + quick actions
- **Outcome:** shipped
- **Changes:** new `frontend/components/ui/command-palette.tsx` — ⌘K/Ctrl+K command palette with client-side fuzzy (substring) filter over navigation + quick actions, full keyboard nav (↑↓/↵/esc), design-system styled. Mounted once in `dashboard/layout.tsx`.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only). (Two build failures caught + fixed during the gate: missing `React` namespace import, then typing `icon` with lucide's `LucideIcon` instead of a hand-rolled ComponentType.)
- **Commit:** see git — 🛡️ feat(web): ⌘K command palette for navigation + quick actions
- **Notes / decisions:** Scoped the first slice to navigation/quick-actions (no backend dependency) for a clean, verifiable win. Queued follow-ups: a visible "Search… ⌘K" affordance for discoverability, and live worker/shift/document data search via `useApi`. Couldn't visually verify (no localhost access from here) — build/lint pass; human to eyeball.

## 2026-06-30 10:44 — Hide the dead /dashboard/availability route
- **Item:** Hide or finish the dead `/dashboard/availability` route
- **Outcome:** shipped
- **Changes:** `dashboard/layout.tsx` — removed the "Availability" sidebar nav item (the sidebar was its only entry point, confirmed by grep). Left a comment explaining why.
- **Verify:** build ✅ (24/24, route still compiles — just unlinked), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ fix(ui): hide dead availability route from sidebar
- **Notes / decisions:** The page is a **trust hole**: it lives in the coordinator dashboard but shows worker-facing "Your Availability" copy, `fetchAvailability` is a no-op (no aggregate endpoint), and `updateAvailability` is optimistic-local-only — clicks are silently discarded on refresh. The item preferred "hide over delete" and the page's own comment marks it an intentional Phase-9 placeholder, so I removed the nav link rather than deleting the file. The route now isn't reachable through the UI; kept the page as scaffolding the **P3 worker availability calendar** can finish (the per-worker backend already exists at `/api/workers/:workerId/availability`). When P3 builds the real calendar, either wire this up + re-add the nav item or delete the stub.

## 2026-06-30 10:34 — Replace last native window.confirm() with ConfirmDialog
- **Item:** Replace remaining native `window.confirm()` destructive actions with `components/ui/confirm-dialog.tsx`
- **Outcome:** shipped
- **Changes:** `dashboard/shifts/components/AssignmentList.tsx` — the unassign-worker action used native `confirm('Remove this worker from the shift?')`; now opens the styled `<ConfirmDialog>` (added a `confirmTarget` state; trash button opens it; `onConfirm` performs the DELETE; `busy` reflects the in-flight delete). Added an `aria-label` to the icon-only trash button.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only). Grep confirms zero native `confirm(`/`window.confirm(` left in `app/` + `components/`.
- **Commit:** see git — 🛡️ refactor(ui): replace last window.confirm with ConfirmDialog
- **Notes / decisions:** Only one native confirm() remained (the super-ready hardening had already replaced the others). Destructive actions now match the design system and are accessible (ESC/focus). **Blocked the top item** (finish modal consolidation) per the playbook's "Needs the human" path — it requires a canonical-modal-style decision I can't verify visually; recorded my recommendation (make the design-system style canonical) in the plan so the human can unblock with one word. Moved on to ship this item.

## 2026-06-30 10:20 — Make <Modal> reusable + migrate DeleteConfirmationModal
- **Item:** Consolidate duplicated modal wrappers into the shared `<Modal>` component
- **Outcome:** shipped (scoped — see decision)
- **Changes:** `components/ui/modal.tsx` — added an additive `padded` prop (default true; when false, children render without the `p-6` body wrapper so a modal's own full-width header/footer borders span the card edge-to-edge). `dashboard/shifts/components/DeleteConfirmationModal.tsx` — removed its duplicated `fixed inset-0` overlay + card wrapper and now renders through `<Modal size="sm" padded={false}>`, inner markup unchanged.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ refactor(ui): make Modal reusable + migrate DeleteConfirmationModal
- **Notes / decisions:** Investigated all 6 wrapper-duplicating modals and found this is partly a **design decision, not a mechanical refactor** — they use two visual languages: generic Tailwind (`rounded-lg`/`shadow-lg`/`max-h-96`) vs the dashboard design system (`rounded-xl`/`shadow-2xl`/`backdrop-blur`). Forcing them all onto today's `<Modal>` would visibly change shadows, corner radius, max-height, and add/remove the blur — unwanted churn. So this firing did the SAFE part: made `<Modal>` capable of hosting header/footer modals (the prerequisite) and migrated the one modal (`DeleteConfirmationModal`) whose style already matches — faithfully (only shadow-lg→xl + ESC/click-outside-to-cancel, both fine for a confirm dialog). The existing `<Modal>` users (`AssignModal`, `ConfirmModal`) are unaffected (default `padded` preserved). **⛔ Needs the human/council:** pick the canonical modal style before migrating the rest — queued as a follow-up.

## 📊 Milestone summary — 2026-06-30 (8 items shipped)
The Knight loop has been running ~10-min firings on `knight-autonomous` (isolated branch, never master). **Shipped so far (most recent first):**
1. Shared `<ConfirmationBadge>` — deduped shift-confirmation badges (this firing)
2. Shared `<StatusBadge>` — deduped worker/document status pills (3 sites)
3. Full `useApi()` migration — 26 fetch sites across 9 files
4. `useApi()` hook created + adopted on top 3 pages
5. **perf:** killed N+1 in bulk shift-assign (≈5×N → 4 queries)
6. Skeleton loaders (workers, shifts calendar, reports) + reusable `<Skeleton>`
7. a11y: aria-labels on 19 icon-only buttons (12 files)
8. Responsive mobile sidebar drawer **+ fixed a P0 production build-breaker** (`localStorage` at render time)
(Plus 1 no-op: request-ID middleware was already done.)

**Queued next:** worker-confirmation/RAG follow-ups (decided against unifying), modal-wrapper consolidation, replace `window.confirm()`, Cmd+K search, availability calendar, shift templates, earnings dashboard, type-safety + perf passes, custom Helmet CSP, extend skeletons.

**⛔ Needs the human:** backend integration test suites (`worker-*`, `security-pipeline`) need a live Postgres to run in the Knight's env; one buggy `shift-assignments` role test (auth mock forces OWNER). Branch is ~10 commits ahead of master, frontend builds green — ready for a review/merge whenever you like.

---

## 2026-06-30 10:04 — Shared <ConfirmationBadge> (shift-confirmation dedup)
- **Item:** Dedupe the remaining status badges (shift-confirmation vocabulary)
- **Outcome:** shipped
- **Changes:** new `frontend/components/ui/confirmation-badge.tsx` (`<ConfirmationBadge status withIcon? />`); removed the identical `getStatusBadge` switch from `dashboard/shifts/components/AssignmentList.tsx` and `worker/dashboard/assigned-shifts/page.tsx` and adopted the shared component (worker portal passes `withIcon` for the check/x icons). Dropped the now-unused `Badge` import from assigned-shifts.
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ refactor(ui): shared ConfirmationBadge for shift-confirmation state
- **Notes / decisions:** Reproduced the exact Tailwind palette + labels → **zero visual change**. Deliberately used a SEPARATE component from `<StatusBadge>` because the vocabularies collide: shift-confirmation "pending" is a gray "Pending" whereas document "PENDING" is an amber "Pending Review" — a single flat status map would conflate them. Decided against forcing the worker-portal doc badges (different uppercase/named-color palette) and the numeric RAG (score→bucket, not a status string) into a shared component; recorded that decision in the plan rather than churning visuals for little benefit.

## 2026-06-30 09:54 — Shared <StatusBadge> (dedupe status-pill logic)
- **Item:** Extract duplicated status-badge color logic into a single shared badge component/util
- **Outcome:** shipped
- **Changes:** new `frontend/components/ui/status-badge.tsx` — `<StatusBadge status … />` + `getStatusStyle()` with a central status→{label,className} map (worker ACTIVE/INACTIVE/SUSPENDED + document NOT_UPLOADED/PENDING/APPROVED/EXPIRING_SOON/EXPIRED/REJECTED), optional `fallbackStatus`. Adopted in: `workers/page.tsx` (removed inline `getStatusBadge` switch), `documents/page.tsx` (removed `statusConfig` map; used `fallbackStatus="NOT_UPLOADED"` to preserve exact behavior), `compliance/WorkerDetailModal.tsx` (replaced an ad-hoc binary green/red badge).
- **Verify:** build ✅ (24/24), lint ✅ (exit 0), tests ⏭️ skipped (frontend-only)
- **Commit:** see git — 🛡️ refactor(ui): shared StatusBadge component
- **Notes / decisions:** workers + documents adoptions are visually identical (same pill classes + labels; documents keeps the NOT_UPLOADED fallback via the new prop). WorkerDetailModal was an **intentional normalization** — it previously rendered the raw uppercase status with only ACTIVE=green / else=red and `px-3`; it now shows the canonical capitalized pill (e.g. INACTIVE = grey, SUSPENDED = amber) consistent with the rest of the app. Did NOT fold in the shift-confirmation badges or the worker-list RAG (green/amber/red) logic — those are distinct vocabularies; queued as a follow-up to extend the same component.

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
