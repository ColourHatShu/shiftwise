# 🛡️ Autonomous Knight — Progress Log

> Newest entries on top. The Knight prepends one entry per firing. This is the
> file the human reads to see what shipped while they were away.

## 2026-07-01 (54) — Bug: manual alert trigger fired alerts for ALL agencies
- **Item:** Self-review of the untested `cronService` expiry-alert engine (core promise)
- **Outcome:** shipped (cross-tenant correctness fix + first cronService tests)
- **Bug:** `checkExpiriesAndAlert = async () => {}` took no args and queried every document with an expiry (`where: { expiryDate: { not: null } }`, no agency filter). The nightly cron wants that (global). But `/alerts/test` calls `checkExpiriesAndAlert({ agencyId: req.agencyId })` — the arg was **silently ignored**, so an OWNER/ADMIN manually triggering the "test" scan ran it **globally** and sent real expiry-alert emails for **all** agencies' documents (a cross-tenant side-effect; last firing's alerts test asserted the route *passes* agencyId but the engine ignored it). Reset was scoped; trigger was not.
- **Fix:** `checkExpiriesAndAlert(options = {})` reads `options.agencyId` and adds it to the `where` when present; no arg (or a node-cron Date tick) → global, unchanged. Callers: cron `cron.schedule(..., checkExpiriesAndAlert)` stays global; `/alerts/test` now genuinely scopes to the caller.
- **Coverage:** new `src/tests/services/cron-expiry-scope.test.js` (3 tests, empty doc-set so the email loop doesn't run) — scoped when `{agencyId}` passed, global on no-arg, global on Date tick. cronService had no tests before.
- **Verify:** `node --check` OK; new suite **3/3**; `npm run test:ci` = **37 suites / 280 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(cron): scope manual expiry-alert trigger to the caller's agency
- **Notes / decisions:** Twelfth defect from the self-review thread — and it validates going past the route sweep into services. Gated behind dev-mode + role so limited blast radius, but genuinely wrong (unsafe on shared/staging + prod-with-flag). Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / the flagged reactivate + hasExpired + TS-transform) or a **"pause"**.

## 2026-07-01 (53) — Test coverage for alerts endpoints — route sweep complete
- **Item:** Self-review of the last untested requirable route, `alerts.js`
- **Outcome:** shipped (coverage; reviewed clean) — backend route-coverage sweep complete
- **Review:** `GET /alerts/test` + `DELETE /alerts/reset-test` are `requireAgency` + `OWNER/ADMIN`, blocked in production unless `ALLOW_ALERT_TEST_ENDPOINTS`, and agency-scoped (trigger passes `{agencyId}`; reset deletes only alerts whose `complianceDocument.agencyId` / audit logs whose `agencyId` == caller's). A prior BLOCKER-fix (was unauthenticated/cross-tenant); no bug now.
- **Changes:** new `src/tests/routes/alerts.test.js` (4 tests) — agency-scoped trigger, prod 403 on trigger, agency-scoped reset (asserts the delete `where` is scoped), prod 403 on reset.
- **Verify:** new suite **4/4**; `npm run test:ci` = **36 suites / 277 tests, 0 failing**.
- **Commit:** see git — 🛡️ test(alerts): cover prod-guard + agency-scoped trigger/reset
- **Milestone:** every backend route is now tested **or** has a documented blocker (`documents.js` + `security-pipeline` need the founder-gated jest TS-transform). The self-review thread (firings 39–53) delivered **11 real defects** (incl. a cross-tenant IDOR + three expiry off-by-ones) and coverage across ~10 previously-untested routes. Backend tests: **60 → 277**.
- **Notes / decisions:** The systematic self-review is now genuinely complete — further firings would be low-yield without a steer. Strongly recommend the founder pick one: matcher weights / no-show module / CSP report-only / auto-poster / £ earnings / confirm the flagged `reactivate` + `hasExpired` findings / greenlight the jest TS-transform — or **"pause"** the cron.

## 2026-07-01 (52) — Test coverage for shift-requirements CRUD (clean)
- **Item:** Self-review of the untested `shift-requirements.js`
- **Outcome:** shipped (coverage; reviewed clean)
- **Review:** POST/GET/PUT/DELETE template endpoints are agency-scoped + `OWNER/ADMIN`-gated. PUT and DELETE fetch by id then verify `template.agencyId !== req.agencyId` → 404 (IDOR-safe), POST validates + dedupes by `agencyId_templateName`. No crash/authz/IDOR bug.
- **Changes:** new `src/tests/routes/shift-requirements.test.js` (7 tests) — create validation (400) / duplicate (400) / success (201, agency-scoped), cross-agency 404 on PUT + DELETE, update + delete happy paths.
- **Verify:** new suite **7/7**; `npm run test:ci` = **35 suites / 273 tests, 0 failing**.
- **Commit:** see git — 🛡️ test(shift-requirements): cover CRUD authz + validation
- **Notes / decisions:** Clean target → locked its authz. The untested *requirable* route list is nearly exhausted (only `alerts` remains; `documents`/`security-pipeline` need the founder-gated jest TS-transform). Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the flagged `reactivate` + `hasExpired` findings + TS-transform) or a **"pause"**.

## 2026-07-01 (51) — Bug + tests: dashboard "expiring soon" dropped today
- **Item:** Self-review of the untested `dashboard.js` (date-filter hypothesis from the reports fix)
- **Outcome:** shipped (correctness fix + coverage)
- **Bug:** `GET /api/dashboard/stats` counted `expiringSoon` with `expiryDate: { gte: now, lte: in30Days }` where `now = new Date()` (current time). `expiryDate` is `@db.Date` (UTC midnight), so a document expiring **today** is `< now` → excluded from the headline dashboard count. Same class as the reports/expiring bug (firing 46) — the most urgent renewals under-counted on the main dashboard.
- **Fix:** count from `startOfToday` (UTC midnight): `expiryDate: { gte: startOfToday, lte: in30Days }` — includes today + the next 30 days.
- **Coverage:** new `dashboard.test.js` (3 tests) — stats shape + agency-scoping, expiring-soon `gte` at UTC midnight (locks the fix), graceful 500. `dashboard.js` was previously untested.
- **TS-transform assessment:** to test `documents.js` (biggest untested/security file) I checked enabling a jest TS transform — but the backend has **no** babel/ts/ts-jest deps installed and runs via plain `node`, so adding one is a dependency + config change that could destabilize the 34 green suites. Left as a founder-gated infra task (would also help un-exclude `security-pipeline`).
- **Verify:** `node --check` OK; new suite **3/3**; `npm run test:ci` = **34 suites / 266 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(dashboard): count documents expiring today in "expiring soon"
- **Notes / decisions:** Eleventh defect from the self-review thread; the "expiry compared against current-time not start-of-day" class has now been fixed in three surfaces (worklist, report, dashboard). Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the `reactivate` + `hasExpired` findings / greenlight the jest TS-transform) or a **"pause"**.

## 2026-07-01 (50) — IDOR sweep (clean) + fix empty-agency false "CQC ready"
- **Item:** Continue the IDOR/authz self-review; review the CQC readiness endpoint
- **Outcome:** shipped (one edge-case fix + coverage; IDOR sweep came back clean)
- **IDOR sweep:** after last firing's audit-pack IDOR, audited the other by-ID/download endpoints — `documents /:id/download` (decrypt+stream), `documents /:id/status`, `/:id/analyse`, `/:id/verify`, and `shift-assignments /assignments/:assignmentId` (GET + DELETE) are **all correctly agency-scoped** (`findFirst {id, agencyId}` → 404). Audit-pack was the only broken one. Tried to add a *real* supertest test for the document-download authz but `documents.js` imports `ocrService.ts` and the backend jest has no TS transform (require fails) — which is also why `file-download.test.js` only asserts inline mock logic and `security-pipeline` is excluded. Noted as a separate infra task.
- **Bug fixed:** `GET /readiness` — `readyForCQC = expiredCount === 0 && compliantCount === workers.length` is vacuously **true when there are 0 workers**, so a new/empty agency was reported 🟢 "Ready for CQC". Added `workers.length > 0 &&` (empty → yellow). Div-by-zero on `compliancePercentage` was already handled (`|| 0`).
- **Coverage:** new `compliance-checklist.test.js` (4 tests) — empty-not-green, all-compliant→green, expired→red, non-compliant→yellow.
- **Flagged (not changed):** `/readiness` `hasExpired` counts ANY expired document (including optional/rejected) toward "red" — arguably should be required+approved only; left as a compliance-semantics call for the founder.
- **Verify:** `node --check` OK; new suite **4/4**; `npm run test:ci` = **33 suites / 263 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(compliance): empty agency isn't "CQC ready" (+ readiness tests)
- **Notes / decisions:** Tenth defect from the self-review thread. IDOR class now confirmed clean across the app (bar the fixed audit-pack). Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm `reactivate` role check / the `hasExpired` semantics) or a **"pause"**.

## 2026-07-01 (49) — 🔴 SECURITY: fix cross-agency audit-pack download (IDOR)
- **Item:** Self-review (authz) of the untested `audit-pack.js` — found a real cross-tenant leak
- **Outcome:** shipped (highest-severity fix of the session)
- **Vulnerability (IDOR / broken object-level authorization):** `GET /api/agency/audit-pack/download/:packId` → `downloadAuditPack(packId)` streamed `uploads/audit-packs/{packId}.zip` directly off disk with **no ownership check**. The route is behind `requireAgency` + `requireRole(['OWNER','ADMIN'])`, but that only proves you're an admin of *some* agency — not that the pack is yours. There's no `AuditPack` DB row (files are flat on disk) and the single-worker packId (`audit-pack-<workerId>-<ts>`) didn't even encode the agency. So an OWNER/ADMIN of agency A could download agency B's audit pack — B's workers' compliance documents (DBS, passport, Right-to-Work) and PII — by knowing/guessing a packId. Serious cross-tenant data leak for a CQC/healthcare product.
- **Fix:** embed the owning `agencyId` in every packId (single-worker now `audit-pack-<agencyId>-<workerId>-<ts>`; bulk already `bulk-export-<agencyId>-<ts>`), and gate `downloadAuditPack(packId, agencyId)` on `isAuditPackOwnedByAgency` — the packId must start with `audit-pack-<agencyId>-` or `bulk-export-<agencyId>-` (trailing '-' delimiter prevents agency-id prefix collisions, e.g. agency-1 vs agency-12). Same "not found" error so a foreign pack's existence isn't leaked. Route now passes `req.agencyId`. Guard lives in a **dependency-free** `lib/audit-pack-ownership.js` (the full service pulls `archiver`, which ships ESM jest can't parse) so it's unit-testable in isolation.
- **Verify:** `node --check` (service + new module + route) OK; new unit suite **5/5** (owned single/bulk, foreign rejected, prefix-collision rejected, missing-arg); `npm run test:ci` = **32 suites / 259 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(audit-pack): scope pack download to the owning agency (IDOR)
- **Notes / decisions:** Ninth and most serious defect from the self-review thread — a genuine cross-tenant PII/document leak, the exact class as the earlier worker-dashboard document leak. Old-format packs (pre-fix, no agencyId in id) will now 404 on download, but packs expire in 7 days so that's transient. **Strongly recommend the founder note this one.** Remaining: a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the `reactivate` role check) or a **"pause"**.

## 2026-07-01 (48) — Bug-class sweep: unsafe .trim() on null/non-string input
- **Item:** Systematic sweep of the recurring `.trim()`-on-bad-input crash class
- **Outcome:** shipped (sweep complete; one more instance fixed)
- **Sweep:** grepped every `.trim()` in `src/routes`, `src/services`, `src/lib`. The `X !== undefined` + `X.trim()` null-crash pattern (which bit `workers` + `agencies` PATCH) has **no remaining unguarded instances** — only the already-fixed lines match. All other `.trim()` calls are safe (truthy guards, `String()` coercion, template literals, `x ? x.trim() : null`).
- **One more found + fixed:** `worker-auth` `handleVerifyCode` guarded `!email || !otp` but not `typeof email === 'string'` (whereas `handleWorkerSignin` does), so a non-string `email` (e.g. `123`) → `(123).toLowerCase()` → `TypeError` → **500 instead of 400**. Aligned the guard with signin; added a regression test.
- **Verify:** `node --check` OK; worker-auth suite **14/14**; `npm run test:ci` = **31 suites / 254 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(worker-auth): reject non-string email in verify-code (+ sweep)
- **Notes / decisions:** Eighth defect from the self-review thread and closure on the `.trim()` crash class (a shared input-sanitize helper or an ESLint rule would prevent recurrence — noted as a future idea). Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the `reactivate` role check) or a **"pause"**.

## 2026-07-01 (47) — Bug + tests: agency settings PATCH null-field crash
- **Item:** Self-review of the untested `agencies.js` (settings + thresholds)
- **Outcome:** shipped (bug fix + coverage)
- **Bug:** `PATCH /api/agencies/update` set `address/city/postcode/phone/agencyType` via `!== undefined` + `.trim()`. Clearing an optional field with an explicit `null` (e.g. `{ address: null }`) hit `null.trim()` → `TypeError` → **500**. Same class as the `workers` PATCH bug fixed earlier; `name` was already null-safe (truthy check).
- **Fix:** `x === null ? null : x.trim()` for all five fields. Reviewed the `compliance-thresholds` PUT in the same pass — well-validated (array + integer + 1..365 range, role-gated, agency-scoped); no bug.
- **Coverage:** new `src/tests/routes/agencies.test.js` (6 tests) — null-field regression, string trimming, thresholds validation (non-array / out-of-range / non-integer → 400), valid thresholds save (agency-scoped `{t1:30,t2:60}` map). `agencies.js` was previously untested.
- **Verify:** `node --check` OK; new suite **6/6**; `npm run test:ci` = **31 suites / 253 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(agencies): PATCH /update no longer 500s on null fields (+ tests)
- **Notes / decisions:** Seventh real defect from the self-review thread (the `null.trim()` class has now recurred in two route files — `workers` and `agencies` — worth a lint rule eventually). Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the `reactivate` role check) or a **"pause"**.

## 2026-07-01 (46) — Bug + tests: expiring report dropped today's expiries
- **Item:** Self-review of the untested `reports.js` (targeted date-filter hypothesis)
- **Outcome:** shipped (correctness fix + coverage)
- **Bug:** `GET /api/reports/expiring` used `where: { expiryDate: { not: null, lte: cutoff, gte: new Date() } }`. `expiryDate` is `@db.Date` (UTC midnight), so a doc expiring **today** (midnight) is `< now` (current time) → excluded from the report entirely — and it's not "already expired" either, so it fell through a gap. The single most urgent renewals were invisible in the expiring report.
- **Fix:** compare from `startOfToday` (UTC midnight) instead of `new Date()` — includes today + future, still excludes already-lapsed docs. Mirrors the earlier worklist off-by-one fix, on a different surface.
- **Coverage:** new `src/tests/routes/reports.test.js` (3 tests) — asserts the `gte` is start-of-day (UTC hours/min/sec = 0), flatten+sort+urgency mapping, and graceful 500. `reports.js` was previously untested.
- **Verify:** `node --check` OK; new suite **3/3**; `npm run test:ci` = **30 suites / 247 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(reports): include documents expiring today in the expiring report
- **Notes / decisions:** Sixth real defect from the self-review thread — a trust/coverage bug on the core "expiring soon" report for a CQC-audit product. Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the `reactivate` role check) or a **"pause"**.

## 2026-07-01 (45) — Test coverage for compliance approve/reject/deactivate
- **Item:** Self-review of the untested, compliance-critical state-changers in `compliance.js`
- **Outcome:** shipped (coverage; endpoints reviewed clean)
- **Review:** `POST /document/:id/approve`, `/document/:id/reject`, `/worker/:id/deactivate` are all correctly agency-scoped (`findFirst {id, agencyId}` → 404), role-gated (`requireRole(['OWNER','ADMIN'])`), and audit-logged. No authz or crash bug. Reject-reason defaults to `''` (optional) — a design choice, not a defect.
- **Changes:** new `src/tests/routes/compliance-actions.test.js` — 6 tests: 404-for-out-of-agency-target on all three, plus approve→APPROVED (+audit log), reject→REJECTED with reason, deactivate→INACTIVE. Mocks prisma / auth / Sentry / compliance-service.
- **Verify:** new suite **6/6**; `npm run test:ci` = **29 suites / 244 tests, 0 failing**.
- **Commit:** see git — 🛡️ test(compliance): cover approve/reject/deactivate authz + happy paths
- **Notes / decisions:** Another clean target → locked its authorization rather than manufacture a fix. Backend route coverage is now broad (assignments, availability, workers, compliance actions, scorecards, coverage, expiring, matcher). Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the `reactivate` role check flagged last firing) or a **"pause"**.

## 2026-07-01 (44) — Bug + tests for workers.js (PATCH null-field crash)
- **Item:** Self-review of the untested, core `workers.js` CRUD
- **Outcome:** shipped (bug fix + coverage; one authz finding flagged for the founder)
- **Bug:** `PATCH /api/workers/:id` set `updateData.phone = phone.trim()` / `notes = notes.trim()` guarded only by `!== undefined`. Since create allows `phone/notes = null`, a client clearing a field with `PATCH { phone: null }` (the code comment literally says "Allow emptying") hit `null.trim()` → `TypeError` → **500**. Fixed to `x === null ? null : x.trim()`.
- **Coverage:** `workers.js` (core entity CRUD, previously **zero tests**) now has an 8-test suite — create validation (400) / duplicate email (409) / success (201, agency-scoped, status ACTIVE), GET-by-id 404, the PATCH null-field regression (200, `update` gets `phone/notes: null`), PATCH 404, DELETE 404 + success.
- **Finding (flagged, not changed):** `PATCH /:id/reactivate` has **no `requireRole`**, while `/deactivate` requires `OWNER/ADMIN` — a privilege asymmetry (a lower-privilege coordinator can reactivate a worker an admin deactivated). Likely an oversight, but since tightening authz could break an intended flow, I left it for the founder to confirm rather than change behavior unprompted (see plan P17).
- **Verify:** `node --check` OK; new suite **8/8**; `npm run test:ci` = **28 suites / 238 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(workers): PATCH null phone/notes no longer 500s (+ tests)
- **Notes / decisions:** Fifth real defect from the self-review thread, plus a flagged authz finding. Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings / confirm the reactivate role check) or a **"pause"**.

## 2026-07-01 (43) — Test coverage for the untested worker-availability endpoint
- **Item:** Self-review (security/authz) → coverage gap, not a bug
- **Outcome:** shipped (test coverage)
- **Review findings:** audited two worker-related write endpoints. `worker-assignments` (confirm/decline) is **correct + already well-tested** — fetches then checks `assignment.workerId !== req.worker.id` → 403 (cross-worker), uses the right `req.worker.id`, and has 10 tests incl. the ownership case. `worker-availability` (coordinator CRUD) is also **authz-correct** (agency-scoped, verifies worker-in-agency → 404) but had **no tests at all**.
- **Changes:** new `src/tests/routes/worker-availability.test.js` — 10 tests: 404-for-out-of-agency-worker on GET/POST/DELETE, validation (missing fields, invalid status, invalid date), status upper-casing, date-range filter construction, upsert create-shape, delete success, and P2025→404.
- **Verify:** new suite **10/10**; `npm run test:ci` = **27 suites / 230 tests, 0 failing**.
- **Commit:** see git — 🛡️ test(worker-availability): cover authz + validation + CRUD
- **Notes / decisions:** The self-review's bug hit-rate is (healthily) dropping — this target was clean, so the honest, valuable move was to lock its untested authorization behavior rather than manufacture a "fix". Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings) or a **"pause"**.

## 2026-07-01 (42) — Bug fix: out-of-scope `req` in checkWorkerCompliance catch
- **Item:** Self-review — compliance-path consistency review surfaced a logging bug
- **Outcome:** shipped (logging/observability correctness fix)
- **Bug:** `checkWorkerCompliance(workerId, agencyId)` in `shift-assignments.js` is a module-level helper (no `req`), but its `catch` used `(req.log || logger).error(...)`. On a DB error during the compliance check it therefore threw `ReferenceError: req is not defined` instead of logging — the real error was masked (the route's own catch still returns 500, so it's observability, not user-facing). A leftover from the console→pino migration applying the `req.log` pattern to a non-handler.
- **Fix:** use the module-level `logger`. Grepped every `req.log` in `backend/src` and confirmed this was the **only** occurrence in a non-`(req,res)` scope (all others are route handlers). Added a test that drives the compliance-check error path and asserts a graceful 500.
- **Verify:** `node --check` OK; shift-assignments suite **13/13**; `npm run test:ci` = **26 suites / 220 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(shifts): use base logger in checkWorkerCompliance (no req in scope)
- **Notes / decisions:** Fourth real defect from the self-review thread (this one a latent crash-on-error-path). Also confirmed the two compliance code paths (`checkWorkerCompliance` for single-assign vs `validateComplianceForWorkers` for bulk) both key off APPROVED docs + required types — consistent. Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings) or a **"pause"**.

## 2026-07-01 (41) — Bug fix: off-by-one in expiring-documents (today ≠ overdue)
- **Item:** Self-review bug-hunt → date off-by-one in the expiring worklist
- **Outcome:** shipped (correctness fix)
- **Bug:** `expiring-documents` computed `daysUntilExpiry = Math.floor((expiryDate@midnightUTC − now@currentTime)/day)`. Because `now` carried the current time-of-day while `expiryDate` is midnight, a document expiring **today** evaluated to `−1` → `overdue: true` and a "Expired 1d ago" label, and it inflated `summary.overdue` — even though the document is still valid today. (`shift-coverage.js` was reviewed in the same pass and is correct — no change.)
- **Fix:** compute a **calendar-day** difference — normalize both `today` and `expiryDate` to UTC midnight and `Math.round` the day delta. Now: expiring today → `0` / not overdue; yesterday → `−1` / overdue; future → positive. Added a regression test (today → `daysUntilExpiry 0`, `overdue false`, `summary.overdue 0`); existing overdue/future assertions still hold (both normalize cleanly).
- **Verify:** `node --check` OK; expiring suite **5/5**; `npm run test:ci` = **26 suites / 219 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(documents): correct expiring off-by-one (today not overdue)
- **Notes / decisions:** Third real bug from the self-review thread. Mislabeling a still-valid compliance doc as "expired" is exactly the kind of trust bug that matters for a CQC-audit product. Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings) or a **"pause"**.

## 2026-07-01 (40) — Bug fix: close the deactivated-worker assign write-path
- **Item:** Self-review follow-through — the assign *write* path still let deactivated workers through
- **Outcome:** shipped (defense-in-depth correctness/safety fix)
- **Bug:** last firing fixed the candidate *lists*, but the write endpoints were still open: `POST /assign` checked only agency membership (not `status`), and `POST /assign-bulk` relied on `validateComplianceForWorkers`, whose worker fetch (`where: { id in …, agencyId }`) had no status filter. A direct API call (or a stale/hand-crafted request) could therefore assign a deactivated worker regardless of the UI list fix.
- **Fix:** (1) `POST /assign` now returns **400 "Cannot assign a deactivated worker"** when `worker.status !== 'ACTIVE'`; (2) `validateComplianceForWorkers` worker fetch gained `status: 'ACTIVE'` so deactivated workers fall through to `notFound` and are skipped by bulk-assign. Added a regression test (deactivated → 400, no assignment created) and updated the happy-path test's worker mock to include `status: 'ACTIVE'`.
- **Verify:** `node --check` + `require()` OK; shift-assignments suite **12/12**; `npm run test:ci` = **26 suites / 218 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(shifts): reject deactivated workers at the assign write-path
- **Notes / decisions:** Completes the deactivated-worker hole end-to-end (lists + both write paths). The self-review thread has now found + fixed two related real bugs — genuinely the highest-value work available without a founder decision. Still recommend a steer (matcher weights / no-show module / CSP / auto-poster / £ earnings) or a **"pause"**.

## 2026-07-01 (39) — Bug fix: deactivated workers were still assignable to shifts
- **Item:** Self-review bug-hunt of this session's code → real bug found + fixed
- **Outcome:** shipped (correctness/safety fix)
- **Bug:** worker `deactivate` sets `status='INACTIVE'` and never changes `isActive`, but the three shift-assignment routes (`assignable-workers`, `assign-bulk`, and this session's `suggested-workers`) filtered candidates on `isActive: true` only. A deactivated worker (`status=INACTIVE`, `isActive=true`) therefore still showed up as assignable, as a bulk-assign candidate, and as a shift-matcher "top pick" — you could put a worker the agency had deactivated back on a shift. (The route tests mock `worker.findMany`, so the wrong filter passed tests but would misbehave against the real DB.)
- **Fix:** added `status: 'ACTIVE'` alongside `isActive: true` in all three filters (matches the canonical active-worker filter used by `reports`, `dashboard`, and deactivate/reactivate), plus a regression assertion that `suggested-workers` queries with `status: 'ACTIVE'`.
- **Verify:** `node --check` OK; shift-assignments suite **11/11**; `npm run test:ci` = **26 suites / 217 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(shifts): exclude deactivated workers from assignment/matcher
- **Notes / decisions:** With clean feature work exhausted, ran an adversarial self-review of the session's new code instead of manufacturing polish — and it surfaced a genuine bug (in both my new route and two pre-existing ones). This is the highest-value thing available without a founder decision. Still recommend a steer for new modules (matcher weights / no-show tracking / CSP / auto-poster / £ earnings) or a **"pause"**.

## 2026-07-01 (38) — API reference docs for the session's new endpoints
- **Item:** Document the new API surface (`docs/API.md`)
- **Outcome:** shipped (docs)
- **Changes:** new `docs/API.md` — reference for the six insight/matching endpoints added this session (shift-coverage; worker-scorecards + `/:workerId`; expiring-documents; shifts/:shiftId/suggested-workers): auth, query params, and exact response shapes with annotated examples. Cross-checked every documented field against the route code (coverage status enum + summary keys, expiring summary keys, matcher `meta` keys) — all match.
- **Verify:** docs-only, no code/build impact; accuracy verified by shape-matching against the handlers.
- **Commit:** see git — 🛡️ docs(api): reference for new insight + matcher endpoints
- **Notes / decisions:** With safe non-gated code work exhausted, and having (a) committed to *not* pausing the cron unilaterally — per my standing offer to pause only on the founder's word — and (b) declined to make an unverifiable live-DB migration bet alone, chose the remaining genuinely-useful, zero-risk deliverable: the new endpoints were undocumented, and an accurate reference helps the founder evaluate what shipped + decide next steps. **Non-gated backlog remains exhausted** — the next substantive value needs a founder decision (tune matcher weights / greenlight a model-backed module like no-show tracking / CSP report-only / auto-poster / £ earnings) or a **"pause"**.

## 2026-07-01 (37) — A11y: contrast audit finds + fixes a real AA failure
- **Item:** A11y follow-up — icon-only buttons + status-badge contrast
- **Outcome:** shipped (real WCAG AA failure found + fixed)
- **Findings/changes:**
  - **Icon-only buttons:** app-wide regex for `<button>…<Icon/>…</button>` without `aria-label` returned **zero** — already implemented, nothing to do (verified, not assumed).
  - **Contrast:** computed WCAG ratios for every status/badge pair. All passed except the grey badge `#5B6E8C` on `#EBEEF5` = **4.46 (< AA 4.5)**. Darkened the text to **`#52627E` (5.31:1)** in the shared `components/ui/status-badge.tsx` (INACTIVE, NOT_UPLOADED), `lib/reliability.ts` (no-history badge), and the two worker-profile badges; updated the reliability unit test assertion. Confirmed no instance of the old failing pair remains.
- **Verify:** frontend `npm run test:ci` = **11 files / 85 tests**; `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ a11y(ui): fix sub-AA grey badge contrast (#5B6E8C→#52627E)
- **Notes / decisions:** A genuine defect fix, not churn — one status badge was failing WCAG AA and is now compliant across every place it renders (fixed at the shared component so it can't regress per-page). Completes the P14 accessibility thread. **Non-gated backlog now genuinely exhausted** — next value needs a founder decision (matcher weights / CSP report-only / auto-poster / £ earnings / a model-backed module) or a cron pause.

## 2026-07-01 (36) — A11y: table-header scope sweep across the older core pages
- **Item:** A11y sweep of the older core pages (table headers)
- **Outcome:** shipped (header sweep; icon-button aria + contrast deferred)
- **Changes:** added `scope="col"` to every remaining dashboard table header — audit-log, audit-packs, compliance, compliance-settings, documents, reports, workers. Verified zero `<th>` without `scope` remain anywhere under `app/dashboard` (10 files now covered, including last firing's coverage/scorecards/expiring).
- **Verify:** `npm run lint` 0 errors; frontend `npm run test:ci` = **11 files / 85 tests** (behaviour-preserving); `npm run build` ✓.
- **Commit:** see git — 🛡️ a11y(dashboard): scope=col on all remaining table headers
- **Notes / decisions:** Continued the P14 accessibility thread with a uniform, correct, zero-risk sweep (screen-reader header association is now consistent app-wide) — the last clearly-scoped non-gated quality item. Remaining a11y work (icon-only button `aria-label`s + status-badge contrast audit) is per-button/design and deferred (P14 follow-up). **Non-gated backlog is now effectively empty** — next substantive value needs a founder decision (tune matcher weights / CSP report-only / auto-poster / £ earnings / a model-backed module) or a cron pause.

## 2026-07-01 (35) — Accessibility pass on the new feature surfaces
- **Item:** A11y hardening of the newest views (relevant for a healthcare/CQC product)
- **Outcome:** shipped
- **Changes:** added `scope="col"` to all 16 table headers in `shifts/coverage`, `workers/scorecards`, and `documents/expiring` (screen-reader header association); added `aria-pressed` + descriptive `aria-label` to the expiring-worklist window toggles (7/30/60/90d) and to the shift-matcher "⭐ Top picks" chips in `AssignModal` (they're toggle buttons — now announce selected state + a full label).
- **Verify:** frontend `npm run test:ci` = **11 files / 85 tests** (behaviour-preserving); `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ a11y(views): header scope + toggle aria on new surfaces
- **Notes / decisions:** With clean feature/test work exhausted and remaining features needing founder decisions, picked genuine low-risk value that fits a healthcare/public-sector product's accessibility obligations, scoped to the surfaces this session created. Correct, standard WCAG patterns — not speculative, no product decision, no migration. A broader a11y sweep of the older core pages is queued (P14, lower urgency). **Still recommend a steer** (tune matcher weights / CSP report-only / auto-poster / £ earnings / a model-backed feature) **or pausing the cron** — new *modules* now require a product decision.

## 2026-07-01 (34) — Extract shift-matcher ranking to a pure, tested function
- **Item:** De-risk the pending weight-tuning by extracting the matcher's ranking
- **Outcome:** shipped
- **Changes:** new `backend/src/lib/rank-suggested-workers.js` (`rankSuggestedWorkers`, pure + non-mutating) holding the documented default rule (confirmationRate desc → null last → complianceScore desc → name asc); refactored `routes/shift-assignments.js`'s `suggested-workers` handler to call it (removed the inline sort). +6 focused unit tests (rate-desc, null-last, compliance tie-break, name tie-break, two-null stability, no-mutation).
- **Verify:** `node --check` + `require()` OK; new unit test **6/6**; matcher route suite still **11/11** (refactor behaviour-preserving); `npm run test:ci` = **26 suites / 217 tests, 0 failing**.
- **Commit:** see git — 🛡️ refactor(shifts): extract shift-matcher ranking to a pure tested fn
- **Notes / decisions:** With the clean backlog empty, picked the item that most directly serves the one high-value pending decision (founder ranking weights): the ranking rule now lives in one pure, unit-tested place, so tuning is a single-function edit (and the natural home for distance/skills/rotation). Adds edge-case coverage the happy-path route test didn't have. Not speculative, no migration, behaviour-preserving. **Genuinely nothing clean+non-gated remains** — recommend a steer (tune weights / CSP report-only / auto-poster / £ earnings / model-backed feature) or pausing the cron.

## 2026-07-01 (33) — Dashboard coverage-alert page test (page-test coverage complete)
- **Item:** Dashboard coverage-alert test (closes out P13)
- **Outcome:** shipped — all four new feature surfaces now have page-level tests
- **Changes:** `frontend/app/dashboard/page.test.tsx` — mocks Clerk `useAuth` (loaded + signed-in) and `useApi` (routed by URL: shift-coverage / agencies-me / dashboard-stats), asserting the coverage **alert shows when `needingAttention > 0`** and is **absent when 0**. Used `findAllByText`/`queryAllByText` since the alert text nests (span inside the anchor).
- **Verify:** dashboard file **2/2**; frontend `npm run test:ci` = **11 files / 85 tests**; `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ test(frontend): dashboard coverage-alert page test
- **Notes / decisions:** Completes P13 — the reliability, coverage, expiring-docs, and dashboard-alert surfaces all have page-level regression tests now (backend routes were already covered). First test to mock Clerk in this suite; establishes the pattern for any future Clerk-dependent page. Genuinely no clean non-gated work left after this — remaining is founder-gated (tune shift-matcher weights, CSP report-only, auto-poster, £ earnings, model-backed features, worker-e2e test DB). Recommend a steer or pausing the cron.

## 2026-07-01 (32) — Page tests for scorecards + expiring views
- **Item:** Extend page tests to the other new views
- **Outcome:** shipped (scorecards + expiring; dashboard-alert deferred)
- **Changes:** `app/dashboard/workers/scorecards/page.test.tsx` (asserts a worker row + "80%" confirmation rate, and the "No reliability data yet" empty state) and `app/dashboard/documents/expiring/page.test.tsx` (asserts an overdue row with worker/doc-type + "Expired 3d ago" urgency label, and the "Nothing expiring in this window" empty state). Both mock `@/lib/use-api`.
- **Verify:** the two new files **4/4**; frontend `npm run test:ci` = **10 files / 83 tests**; `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ test(frontend): page tests for scorecards + expiring views
- **Notes / decisions:** Mechanical follow-up on the page-testing seam — the three feature threads' dedicated views now have page-level regression tests. Deferred the dashboard coverage-alert test only because the dashboard page also pulls Clerk `useAuth` (needs an extra mock) — small follow-up, lower value than the dedicated pages. Founder-gated items unchanged.

## 2026-07-01 (31) — Establish frontend page-level tests (coverage page)
- **Item:** Page/component test coverage for app routes
- **Outcome:** shipped
- **Changes:** widened `frontend/vitest.config.ts` `include` to `app/**/*.test.{ts,tsx}`; added `app/dashboard/shifts/coverage/page.test.tsx` — mocks `@/lib/use-api` and asserts (a) a coverage row renders with facility + "Understaffed" status + "1 / 3" counts, and (b) the empty state shows when there are no upcoming shifts. Confirms client pages render under jsdom + RTL.
- **Verify:** new file **2/2**; frontend `npm run test:ci` = **8 files / 79 tests**; `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ test(frontend): page-level tests + coverage-page test
- **Notes / decisions:** With the feature arc complete and clean gated work absent, chose genuine quality coverage over marginal churn — the new views had lib tests but no page-level tests. This establishes the page-testing seam (the `app/**` glob + a working mocked-`useApi` render); the other new pages (scorecards, expiring, dashboard alert) are now mechanical follow-ups (P13). Founder-gated items unchanged (tune shift-matcher weights, CSP report-only, auto-poster, £ earnings, worker-e2e test DB).

## 2026-07-01 (30) — AI shift-matcher "Top picks" UI (MVP complete end-to-end)
- **Item:** Shift-matcher — frontend slice
- **Outcome:** shipped (rule-based shift-matcher MVP complete end-to-end)
- **Changes:** `frontend/app/dashboard/shifts/components/AssignModal.tsx` — fetches `/api/shifts/:shiftId/suggested-workers?limit=5` on open and renders a "⭐ Top picks for this shift" strip above the worker list: ranked candidate chips (name + reliability %, with compliance/reliability in the `title` tooltip), each **one-click selectable** (toggles into the same `selectedWorkers` set, filled style when selected). Non-blocking — hidden if there are no suggestions or the fetch fails.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully. (Frontend-only; the API was tested in the backend slice.)
- **Commit:** see git — 🛡️ feat(shifts): "top picks" shift-matcher strip in AssignModal
- **Notes / decisions:** The capstone is live — when a coordinator opens "Assign Workers", the app now recommends the best compliant + reliable candidates and lets them add them in one click. Completes the reliability → compliance → matcher arc. Ranking weights remain a documented default, one line to tune on founder preference (+ distance/skills/rotation as future inputs). Couldn't visually verify (no localhost); build/lint pass. Remaining founder-gated: CSP report-only, auto-poster, £ earnings, model-backed features, worker-e2e test DB.

## 2026-07-01 (29) — AI shift-matcher: rule-based MVP (backend slice)
- **Item:** AI shift-matcher — backend slice (the roadmap's top item)
- **Outcome:** shipped
- **Changes:** added `GET /api/shifts/:shiftId/suggested-workers?limit=5` to `routes/shift-assignments.js` (OWNER/ADMIN) — returns the top compliant candidates for a shift, ranked by a **documented default**: confirmation-rate (reliability) desc → no-history workers last → compliance score desc → name. Uses the batched `validateComplianceForWorkers` (constant queries) + one `groupBy` for reliability; candidate scan capped at 200 (`meta.scanCapped` flags truncation) so it stays perf-viable. Returns `{ data: [{rank, ...}], meta }`. +2 tests.
- **Verify:** `node --check` OK; shift-assignments suite **11/11** (+2); `npm run test:ci` = **25 suites / 211 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(shifts): rule-based shift-matcher (suggested-workers) API
- **Decision:** built the MVP with a sensible, **documented, tunable** default ranking rather than stall further — I'd flagged the weights as founder-scoped and waited several firings + a roadmap reset with no steer, and the founder keeps running the loop for value. Not a hard-gated item (unlike £ earnings which needs real rate data). The weights are trivially adjustable when the founder states a preference (and distance/skills/rotation can be layered in). Frontend "⭐ Top picks" strip in AssignModal queued (P12). This is the capstone of the reliability+compliance work.

## 2026-07-01 (28) — Milestone summary + roadmap reset (ideation)
- **Item:** (0 non-gated actionable items) — milestone summary + roadmap, not marginal polish
- **Outcome:** planning
- **Changes:** added a prominent **"🧭 NEXT MILESTONE — awaiting founder direction"** section at the top of `AUTONOMOUS-PLAN.md` with a prioritized menu of the remaining (all founder-gated/decision-needing) work + one-word greenlights: AI shift-matcher (with the default ranking the Knight would use), CSP report-only, auto-poster, £ earnings, model-backed features (notifications / no-show / rolodex / handoff notes), and the worker-e2e test-DB decision.
- **Verify:** docs only — no code/build impact.
- **Commit:** see git — 🛡️ docs(knight): milestone summary + next-milestone roadmap
- **Session recap:** from this morning's state, the loop delivered — CI (GitHub Actions) + ~285 green tests (backend + frontend, from zero frontend tests), structured pino logging across the codebase, **3 production-class bug fixes** (Sentry-on-boot crash, worker-login P0, multi-tenant document leak), env-validation + pagination hardening, a real README, and **3 complete feature threads** (reliability, coverage, expiring-docs worklist) fully surfaced + discoverable. ~30 features/fixes shipped to `main`, all CI-gated.
- **Decision:** with the clean non-gated backlog genuinely exhausted, chose an honest roadmap reset over manufacturing another marginal change. **Strongly recommend the founder either greenlight one item above or pause the 10-min cron** — further firings would be speculative or trivial. The Knight will keep the repo green and await direction.

## 2026-07-01 (27) — Expiring worklist discoverability (docs header + ⌘K)
- **Item:** Make the expiring worklist discoverable
- **Outcome:** shipped
- **Changes:** `app/dashboard/documents/page.tsx` — header is now a flex row with an "Expiring & overdue" link (Clock) to `/dashboard/documents/expiring`. `components/ui/command-palette.tsx` — added an "Expiring Documents" nav entry (Clock icon + keywords: expiry/overdue/renew/lapse/due-soon) and imported `Clock`.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully.
- **Commit:** see git — 🛡️ feat(nav): make expiring-documents worklist discoverable
- **Notes / decisions:** The core worklist is now reachable three ways (dashboard "EXPIRING SOON" card, Documents page header, ⌘K). Small, clean polish completing the feature's integration. Genuinely at the end of the clean non-gated runway again — three feature threads (reliability, coverage, expiring-docs) are fully built + surfaced + discoverable. Highest-value next work is founder-gated: **AI shift-matcher** (ranking weights), CSP report-only, auto-poster, £ earnings, worker-e2e test DB. Recommend a steer or pausing the cron.

## 2026-07-01 (26) — Expiring-documents worklist view (core promise, feature complete)
- **Item:** Expiring-documents worklist — frontend slice
- **Outcome:** shipped (core-promise feature complete end-to-end)
- **Changes:** new `frontend/app/dashboard/documents/expiring/page.tsx` — overdue-first table (worker→profile link, document type, expiry date + coloured urgency label "Expired Xd ago / Expires today / Xd left", status), a 7/30/60/90-day window selector (re-fetches), an "N overdue, M within Xd" summary, and red-tinted overdue rows. `useApi` + `Skeleton` + `EmptyState`. Re-pointed the dashboard **"EXPIRING SOON"** stat card from `/dashboard/documents` → `/dashboard/documents/expiring`.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully (new route 2.83 kB). Frontend-only; API tested in the backend slice.
- **Commit:** see git — 🛡️ feat(documents): expiring/overdue worklist view + dashboard link
- **Notes / decisions:** This closes the loop on the product's **core promise** — coordinators now have a one-click, urgency-sorted worklist of overdue + soon-expiring documents (from the dashboard card they already look at). Three feature threads shipped end-to-end this session: reliability, coverage, and now the expiring-docs worklist. Couldn't visually verify (no localhost); build/lint pass. Founder-gated items unchanged (AI shift-matcher, CSP report-only, auto-poster, £ earnings, worker-e2e test DB).

## 2026-07-01 (25) — Core promise: expiring-documents worklist (backend slice)
- **Item:** Expiring-documents worklist — backend slice (serves the product's core promise)
- **Outcome:** shipped
- **Changes:** new `backend/src/routes/expiring-documents.js` — `GET /api/expiring-documents?days=30` (agency-scoped, days clamped 1..365, active workers only) → a flat, `expiryDate asc` list of docs that are overdue or expiring within the window, each with `daysUntilExpiry` (negative = overdue) + `overdue` flag, plus a `{ total, overdue, windowDays }` summary. **Includes already-expired** docs (an overdue doc is an active compliance breach) — unlike the worker-grouped, future-only `reports/expiring`. Mounted at `/api/expiring-documents`. +4 tests.
- **Verify:** route `require()` loads; `node --check src/server.js` OK; new test **4/4**; `npm run test:ci` = **25 suites / 209 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(documents): expiring/overdue documents worklist API
- **Notes / decisions:** Found a real core-promise gap: no *actionable* expiring-docs worklist (the dashboard "EXPIRING SOON" count just links to the whole documents page; `reports/expiring` is a future-only, worker-grouped downloadable report). This flat overdue-first worklist is the coordinator's core daily task ("catch expiring docs before they lapse"). Frontend view + re-pointing the dashboard card queued as slice 2 (plan P11). Founder-gated items unchanged.

## 2026-07-01 (24) — DRY the reliability rate→colour helper (+tests)
- **Item:** Extract a shared reliability colour helper
- **Outcome:** shipped
- **Changes:** new `frontend/lib/reliability.ts` — `reliabilityRateStyle(rate)` returns `{ label, badgeClass, textClass }` for the green ≥80 / amber ≥50 / red / grey-null thresholds (single source of truth). Adopted in `workers/scorecards/page.tsx` (was a local `rateStyle`) and the `workers/[id]` reliability panel (was an inline ternary), removing two divergent copies. +4 unit tests (`reliability.test.ts`).
- **Verify:** new test **4/4**; frontend `npm run test:ci` = **7 files / 77 tests**; `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ refactor(ui): shared reliabilityRateStyle helper (+tests)
- **Notes / decisions:** Chose a concrete DRY refactor of the code I'd just written (thresholds were duplicated in two places and could drift) over speculative feature-invention or another planning-only ideation pass — real maintainability value + a tested util, bounded and verifiable. Left `AssignModal`'s badge on its local generic-Tailwind style deliberately (it matches that modal's compliance badge). **Genuinely at the end of the clean autonomous runway now** — the reliability + coverage milestone is fully built, surfaced, and tidied. Next substantive work is founder-gated: **AI shift-matcher** (ranking weights), CSP report-only, auto-poster, £ earnings, worker-e2e test DB. Recommend a steer or pausing the cron.

## 2026-07-01 (23) — Discoverability: new views in the ⌘K command palette
- **Item:** Add scorecards + coverage to the command palette
- **Outcome:** shipped
- **Changes:** `frontend/components/ui/command-palette.tsx` — added two nav entries: "Worker Reliability" (`/dashboard/workers/scorecards`, TrendingUp) and "Shift Coverage" (`/dashboard/shifts/coverage`, CalendarClock), each with search keywords. Imported the two icons.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully.
- **Commit:** see git — 🛡️ feat(nav): add reliability + coverage to command palette
- **Notes / decisions:** The two new views were only reachable via in-page header links; adding them to ⌘K makes them quick-navigable without cluttering the persistent sidebar (contextual sub-features belong in the palette, not the main nav). Small, clean discoverability polish. The reliability + coverage feature set is now fully built + surfaced (dedicated pages, assignment picker, dashboard alert, worker profile, and quick-nav). Highest-value next work is founder-gated: **AI shift-matcher** (ranking weights), CSP report-only, auto-poster, £ earnings, worker-e2e test DB.

## 2026-07-01 (22) — Reliability panel on the worker profile (feature complete)
- **Item:** Per-worker scorecard — profile surfacing
- **Outcome:** shipped (feature complete end-to-end)
- **Changes:** `frontend/app/dashboard/workers/[id]/page.tsx` — added `/api/worker-scorecards/:id` to the profile's parallel fetch and a **Reliability panel** (between the header and Compliance Documents): a big colour-coded confirmation-rate % (green ≥80 / amber ≥50 / red, or "No history yet" when null) plus an assigned/confirmed/declined/pending breakdown. `TrendingUp` icon added to imports.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully. (Frontend-only; API tested in the backend slice.)
- **Commit:** see git — 🛡️ feat(workers): reliability panel on the worker profile
- **Notes / decisions:** Reliability is now surfaced in all the natural places — dedicated scorecards page, the assignment picker (badge + suggested), and now the individual profile. Coordinators viewing a worker immediately see how reliably they confirm shifts. Couldn't visually verify (no localhost); build/lint pass. Founder-gated items unchanged (AI shift-matcher needs ranking weights; CSP report-only; auto-poster; £ earnings; worker-e2e test DB).

## 2026-07-01 (21) — Per-worker scorecard endpoint (for the profile)
- **Item:** Per-worker scorecard — backend slice
- **Outcome:** shipped
- **Changes:** `routes/worker-scorecards.js` — added `GET /api/worker-scorecards/:workerId` (agency-scoped; 404 if the worker isn't in the agency) returning one worker's reliability (total/confirmed/declined/pending + `confirmationRate`) via a single-key `groupBy(['workerConfirmation'])`. Test mock now includes `worker.findFirst`; +3 tests.
- **Verify:** route `require()` loads; scorecards suite **8/8** (was 5); `npm run test:ci` = **24 suites / 205 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(workers): per-worker scorecard endpoint
- **Notes / decisions:** Small backend slice to power a reliability panel on the worker profile (avoids the profile fetching the whole all-workers list). Confirmed `reports/expiring` already covers expiring-docs surfacing, so didn't duplicate that. Profile surfacing queued as slice 2 (plan P10). Founder-gated items unchanged.

## 2026-07-01 (20) — Surface shift-coverage gaps on the main dashboard
- **Item:** Shift coverage — surface on the dashboard
- **Outcome:** shipped
- **Changes:** `frontend/app/dashboard/page.tsx` — added `/api/shift-coverage` to the dashboard's parallel fetch and an amber **actionable alert card** (CalendarClock, "N upcoming shift(s) need workers", "Review coverage →" linking to `/dashboard/shifts/coverage`), rendered only when `needingAttention > 0` (home stays clean when fully staffed). Correct singular/plural.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully (dashboard 4.16 kB).
- **Commit:** see git — 🛡️ feat(dashboard): surface shift-coverage gaps alert
- **Notes / decisions:** Chose a conditional prominent alert over a 5th stat card (a lone 5th card unbalances the 4-col grid; an alert is more actionable + self-hiding when there's nothing to act on). Puts the coverage signal where coordinators start their day. The coverage feature is now: API → dedicated view → dashboard alert. Founder-gated items unchanged.

## 2026-07-01 (19) — Shift coverage: coordinator gaps view (feature complete)
- **Item:** Shift coverage — frontend slice
- **Outcome:** shipped (feature complete end-to-end)
- **Changes:** new `frontend/app/dashboard/shifts/coverage/page.tsx` — upcoming-shifts table (date / facility / role / confirmed÷required / shortfall / colour-coded status badge), a "N of M need attention" summary line, and a "show only needing attention" checkbox filter. `useApi` → `/api/shift-coverage`, `Skeleton` loading, `EmptyState` (separate messages for "no upcoming shifts" vs "all covered"). Added a "Coverage" link (CalendarClock) to the Shifts page header.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully (new route `/dashboard/shifts/coverage` 2.96 kB). Frontend-only; API tested in the backend slice.
- **Commit:** see git — 🛡️ feat(shifts): coverage/gaps coordinator view
- **Notes / decisions:** Completes the coverage feature — coordinators now have a one-glance "which upcoming shifts still need workers" view, complementing reliability (who to pick). Two feature threads now shipped end-to-end this session (reliability + coverage), both read-only/no-migration. Couldn't visually verify (no localhost); build/lint pass. Founder-gated items unchanged (AI shift-matcher needs ranking weights; CSP report-only; auto-poster; £ earnings; worker-e2e test DB).

## 2026-07-01 (18) — New feature: shift coverage / staffing gaps (backend slice)
- **Item:** Shift coverage — backend slice (new feature line; keep shipping real value)
- **Outcome:** shipped
- **Changes:** new `backend/src/routes/shift-coverage.js` — `GET /api/shift-coverage` (agency-scoped) returns upcoming shifts (shiftDate ≥ today, ordered soonest-first) with required/assigned/confirmed counts, `shortfall` (required − confirmed, floored 0), and `status` (filled / understaffed / unfilled), plus a `{ totalUpcoming, needingAttention }` summary. Pure aggregation of existing Shift + ShiftAssignment data — **no schema change**. Mounted at `/api/shift-coverage`. +4 tests.
- **Verify:** route `require()` loads; `node --check src/server.js` OK; new test **4/4**; `npm run test:ci` = **24 suites / 202 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(shifts): coverage/staffing-gaps API
- **Notes / decisions:** Opened a second read-only feature line (like scorecards — no migration, low risk) answering a core coordinator question: *which upcoming shifts still need workers?* Coordinator "gaps" view queued as slice 2 (plan P9). This complements the reliability thread: reliability tells you *who* to pick, coverage tells you *where* you still need to pick. Founder-gated items unchanged (CSP report-only, auto-poster, £ earnings, worker-e2e test DB).

## 2026-07-01 (17) — Rule-based "suggested workers" hint (feature complete)
- **Item:** Rule-based "suggested workers" hint
- **Outcome:** shipped end-to-end (both slices, both small)
- **Changes:** backend `routes/shift-assignments.js` — `assignable-workers` now sets `suggested = confirmationRate !== null && confirmationRate >= 80` per candidate (all candidates are already compliance-filtered). Frontend `AssignModal.tsx` — `suggested?` added to the Worker type + a "⭐ Suggested" badge next to the worker name. +2 backend test assertions (suggested true at 90%, false with no history).
- **Verify:** `node --check` OK; shift-assignments suite **9/9**; backend `npm run test:ci` = **23 suites / 198 tests, 0 failing**; frontend `npm run lint` 0 + `npm run build` ✓.
- **Commit:** see git — 🛡️ feat(shifts): flag + badge "suggested" (reliable, compliant) workers
- **Notes / decisions:** Deliberately a per-candidate **flag/badge, not a reorder** — the endpoint paginates by firstName at the DB layer, so a within-page reliability re-sort would be inconsistent across pages. A true global "best candidates" ranking needs the endpoint to fetch-all → rank → paginate, and with distance/skill weighting that becomes the **AI shift-matcher** — logged as a likely own-milestone (bigger, may warrant founder input on the ranking weights). The scorecards → reliability → suggested thread is now shipped end-to-end. Founder-gated items unchanged.

## 2026-07-01 (16) — Reliability badge in the assignment picker (feature complete)
- **Item:** Reliability in the shift-assignment picker — frontend slice
- **Outcome:** shipped (reliability-at-point-of-assignment complete end-to-end)
- **Changes:** `frontend/app/dashboard/shifts/components/AssignModal.tsx` — added `confirmationRate` to the Worker interface and a reliability badge per candidate row: colour-coded `{rate}% conf` (green ≥80 / amber ≥50 / red), or a muted **"New"** badge when `confirmationRate` is null (no history). Matches the component's existing badge styling; `title` tooltips explain the metric.
- **Verify:** `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully. (Frontend-only; the API field was tested in the backend slice.)
- **Commit:** see git — 🛡️ feat(shifts): show worker reliability in the assignment picker
- **Notes / decisions:** Coordinators now see each candidate's reliability *inline while choosing* — the highest-value placement. Kept it consistent with the modal's current (generic-Tailwind) badge style rather than restyling the whole modal. Next thread step (queued): a rule-based "suggested workers" ordering (sort/tag by reliability + compliance) → the AI shift-matcher foundation. Couldn't visually verify (no localhost); build/lint pass. Founder-gated items unchanged.

## 2026-07-01 (15) — Reliability at the point of assignment (assignable-workers enrichment)
- **Item:** Reliability in the shift-assignment picker — backend slice
- **Outcome:** shipped
- **Changes:** `routes/shift-assignments.js` — after building the compliant-candidate list, `GET /:shiftId/assignable-workers` now enriches each worker with `confirmationRate` via one additive `shiftAssignment.groupBy` over the candidates' history (confirmed ÷ responded, null if none). No change to filtering/pagination/behaviour. Added `groupBy` to the test mock + a new test asserting the rate is computed (90% from 9/1).
- **Verify:** `node --check` OK; `shift-assignments.test.js` **9/9** (+1); `npm run test:ci` = **23 suites / 198 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(shifts): reliability (confirmationRate) in assignable-workers
- **Notes / decisions:** Continues the scorecards → shift-matcher thread by putting reliability **at the decision point** (the assignment picker), where it's most useful. Kept it strictly additive to the critical assignment path (extra field only) and verified via the existing suite. Frontend slice (show the badge in the picker) queued, then a rule-based "suggested workers" ordering. Founder-gated items unchanged (CSP report-only, auto-poster, £ earnings, worker-e2e test DB); Supabase password waived.

## 2026-07-01 (14) — Worker scorecards: coordinator view (feature complete)
- **Item:** Worker scorecards — frontend slice
- **Outcome:** shipped (feature complete end-to-end)
- **Changes:** new `frontend/app/dashboard/workers/scorecards/page.tsx` — a reliability table (assigned/confirmed/declined/pending + colour-coded confirmation-rate badge: green ≥80, amber ≥50, red, grey "—" for no data), rows link to the worker profile; `useApi` → `/api/worker-scorecards`, `Skeleton` loading + `EmptyState` empty. Added a "Reliability" link (TrendingUp) to the Workers page header.
- **Verify:** build ✅ (✓ Compiled successfully; new route `/dashboard/workers/scorecards` 3.22 kB), lint ✅ 0 errors, tests ⏭️ (frontend-only; the API was tested in the backend slice).
- **Commit:** see git — 🛡️ feat(workers): reliability scorecards coordinator view
- **Notes / decisions:** Completes the worker-scorecards feature (API + UI) — coordinators can now see at a glance who reliably confirms shifts. Design-system styled, consistent with the rest of the dashboard. Couldn't visually verify (no localhost) — build/lint pass; founder to eyeball. Next thread: this is the foundation for the AI shift-matcher (rank assignable workers by reliability + compliance + distance). Remaining gated items unchanged (CSP report-only, auto-poster, £ earnings, worker-e2e test DB).

## 2026-07-01 (13) — New feature: worker reliability scorecards (backend slice)
- **Item:** Worker reliability scorecards — backend slice (promoted from IDEAS.md; "keep shipping real value" over speculative polish)
- **Outcome:** shipped
- **Changes:** new `backend/src/routes/worker-scorecards.js` — `GET /api/worker-scorecards` (agency-scoped) aggregates existing `ShiftAssignment` data per worker via `groupBy(['workerId','workerConfirmation'])`: total / confirmed / declined / pending + `confirmationRate` (confirmed ÷ responded, null if none responded), sorted best-first (no-data workers last). Mounted at `/api/worker-scorecards`. **No schema change** — pure aggregation of existing data. +5 tests.
- **Verify:** route `require()` loads; `node --check src/server.js` OK; new test **5/5**; `npm run test:ci` = **23 suites / 197 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(workers): reliability scorecard API (from assignment data)
- **Notes / decisions:** With the non-gated backlog exhausted, chose to **build a vetted feature** (IDEAS.md worker scorecards) rather than more marginal polish — it needs no founder decision and no risky migration (reads existing assignment confirmations), and it's the foundation for the future AI shift-matcher. Frontend coordinator view queued as slice 2 (plan P8). 🟢 Reminder: founder waived the Supabase password rotation. Remaining gated items: CSP (report-only), auto-poster, £ earnings, worker-e2e test DB.

## 2026-07-01 (12) — Finish compliance-dashboard coverage; founder waived password rotation
- **Item:** (non-gated backlog empty) — completed unit coverage of the `compliance-dashboard` module
- **Outcome:** shipped
- **Changes:** new `frontend/lib/compliance-dashboard.aggregation.test.ts` — 6 tests for `calculateOverallCompliance` (empty → 0, rounded average), `groupByStatus` (partition + empty buckets), `verifyScoreFormula` (100 when none required, rounded %). Combined with earlier work, the whole module (filters/sort/paginate/query-string/status/aggregation) is now unit-tested.
- **Verify:** new file **6/6**; frontend `npm run test:ci` = **6 files / 73 tests** (was 67); `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ test(frontend): finish compliance-dashboard module coverage
- **🟢 Founder decision:** the founder said the **Supabase password does NOT need rotating ("its fine")** — so that recommendation is **withdrawn**; the Knight will stop flagging it. (It was only ever a flag in firing summaries, not a plan item.)
- **Notes / decisions:** Non-gated backlog remains exhausted; chose concrete regression coverage over a speculative ideation pass. Remaining work is founder-gated: **CSP (report-only)**, **auto-poster**, **£ earnings**, and the **worker-e2e test DB**. Recommend pausing the cron or greenlighting one of those; further firings will otherwise be speculative polish.

## 2026-07-01 (11) — Real project README (replace create-next-app boilerplate)
- **Item:** (non-gated backlog empty) — shipped a genuine documentation deliverable instead of a speculative ideation pass
- **Outcome:** shipped
- **Changes:** rewrote the root `README.md` (was untouched create-next-app boilerplate that didn't even name the product). Now covers: product summary + core promise, monorepo layout, tech-stack table, prerequisites, backend+frontend setup steps, **env-var tables verified against the actual `backend/.env.example` + `frontend/.env.example`** (fixed the frontend copy path; added `DOCUMENT_ENCRYPTION_KEY`), scripts, testing/CI, and architecture notes (multi-tenancy, coordinator vs worker auth, `computeCompliance` engine, AES-256-GCM document encryption, requestId/pino/Sentry observability).
- **Verify:** docs only — no build/test impact; cross-checked every env var + script name against source (`.env.example` files, `package.json` scripts) so nothing is aspirational.
- **Commit:** see git — 🛡️ docs: real project README (replace create-next-app boilerplate)
- **Notes / decisions:** With the non-gated backlog exhausted (console.* sweep done last firing), chose a concrete, real, verifiable deliverable — accurate onboarding docs for a project that now has a full stack + CI + ~259 tests — over another speculative ideation pass. **This is genuinely the end of the clean autonomous runway.** Everything left is founder-gated: rotate the Supabase password (🔴 still pasted in chat), CSP report-only, auto-poster, £ earnings, worker-e2e test DB. Strongly recommend pausing the 10-min cron or greenlighting one of these; further firings will otherwise be speculative.

## 2026-07-01 (10) — console.* → pino, batch 8 (libs) — item COMPLETE
- **Item:** Migrate remaining `console.*` to the logger — **DONE**
- **Outcome:** shipped — the console.* sweep is complete
- **Changes:** 6 libs migrated to base `logger` (pino `(obj,msg)`): `encryption.js` (7), `nodemailer.js` (5, child `service:'mail'`), `compliance-service.js` (5), `auth.js` (3), `compliance-assignment.js` (2), `email-templates.js` (2, child `service:'mail'`). Imports added (`./logger`).
- **Intentionally kept as `console` (documented judgment):** `server.js` boot logs, `worker-auth.js` JWT boot warning, `lib/fetchWithRetry.js` (generic util; its unit test spies on console), `lib/analysis-failure.js` (last-resort fallbacks — console is the safe path if the logger/DB itself is failing), and `src/tests/`.
- **Verify:** no `console.` in the 6 migrated libs; `node --check` + `require()` all 6 OK; `npm run test:ci` = **22 suites / 192 tests, 0 failing** (encryption-roundtrip + auth/mailer-mocked suites unaffected).
- **Commit:** see git — 🛡️ refactor(lib): finish console.* → structured logger migration
- **Notes / decisions:** **Item 78 complete — ~30 files / ~162 console.* calls migrated to structured pino logging** with requestId correlation in handlers, secret redaction, and Sentry preserved. **This exhausts the entire non-gated backlog.** Every remaining plan item is founder-gated: £ earnings (business data), CSP (needs greenlight), the DB-dependent test suites (worker-e2e needs a test DB; security-pipeline is an aspirational spec). **Recommend pausing the 10-min cron or greenlighting a gated item** (rotate Supabase password, CSP report-only, auto-poster) — further autonomous firings would only ideate or do speculative work.

## 2026-07-01 (9) — console.* → pino, batch 7 (finish ALL route files)
- **Item:** Migrate remaining `console.*` to the logger — batch 7 (routes complete)
- **Outcome:** shipped — **every route file is now migrated**
- **Changes:** 9 remaining route files — `worker-auth` (3 handler calls; kept its module-scope JWT boot `console.warn`), `worker-assignments` (2), `shift-templates` (3), `shifts-analytics` (2), `shifts-bulk` (1), `workers-bulk` (1), `dashboard` (1), `compliance-checklist` (2), `audit-log` (1) — 16 calls → `(req.log||logger)` pino form; logger imported in each.
- **Verify:** the only `console` left in `src/routes/` is `worker-auth.js`'s intentional boot warning; `node --check` all 9 OK; `npm run test:ci` = **22 suites / 192 tests, 0 failing** (worker-assignments/shift-templates/shifts-analytics/shifts-bulk/workers-bulk/audit-log suites all green, exercising the `(req.log||logger)` fallback since tests don't set `req.log`).
- **Commit:** see git — 🛡️ refactor(routes): finish console.* migration for all route files
- **Notes / decisions:** **All 24 route files (~138 calls) done.** Item 78 now has only the **libs** left (`encryption`, `nodemailer`, `compliance-service`, `auth`, `compliance-assignment`, `email-templates`, `fetchWithRetry`, `analysis-failure`) — all base-logger, some are boot/fallback logs that may be fine as `console` (per-file judgment). One more batch finishes it. Then the entire non-gated backlog is exhausted; only founder-gated items remain (Supabase password rotation, CSP report-only, auto-poster, £ earnings, worker-e2e test DB).

## 2026-07-01 (8) — console.* → pino, batch 6 (6 more route files)
- **Item:** Migrate remaining `console.*` to the logger — batch 6
- **Outcome:** shipped
- **Changes:** 6 route files — `reports` (4), `document-types` (4), `alerts` (4: 2 manual-trigger logs → `info` with user/agency, 2 `console.error(err)` → `error({err})`), `worker-documents` (4), `worker-availability` (3), `shift-requirements` (4) — 23 calls → `(req.log||logger)` in pino `(obj,msg)` form; logger imported in each.
- **Verify:** no `console.` left in the 6; `node --check` all OK; `npm run test:ci` = **22 suites / 192 tests, 0 failing** (worker-dashboard + document-types suites still green, exercising the `(req.log||logger)` fallback).
- **Commit:** see git — 🛡️ refactor(routes): migrate 6 more route files' console.* to logger
- **Notes / decisions:** **15 files / ~122 calls migrated now** — roughly one more large batch (small routes + libs) finishes item 78. Noted `worker-auth.js` has a module-scope boot warning that should stay `console` (like server.js boot logs). Still flagging: this is marginal pre-deploy polish; the meaningful next steps remain founder-gated (Supabase password rotation, CSP report-only, auto-poster, £ earnings, worker-e2e test DB).

## 2026-07-01 (7) — console.* → pino, batch 5 (workers/shift-assignments/shifts/audit-pack)
- **Item:** Migrate remaining `console.*` to the logger — batch 5 (large batch per the reprioritization)
- **Outcome:** shipped
- **Changes:** 4 route files — `workers.js` (7), `shift-assignments.js` (7), `shifts.js` (5), `audit-pack.js` (6) — all 25 `console.error` catch-block calls → `(req.log||logger).error({ err }, '…')`; logger imported in each. Uniform conversion.
- **Verify:** no `console.` left in the 4; `node --check` all OK; `npm run test:ci` = **22 suites / 192 tests, 0 failing** (incl. `shift-assignments.test.js`, which exercises the `(req.log||logger)` fallback since the test doesn't set `req.log`).
- **Commit:** see git — 🛡️ refactor(routes): migrate 4 more route files' console.* to logger
- **Notes / decisions:** Did a large 4-file batch (per item 78's "large batches to finish" guidance) rather than one file. **9 files / ~99 calls now migrated.** Remaining ≈ the small routes + libs (~75 app-code calls; `server.js` boot + `src/tests/` intentionally excluded). At this rate ~2 more large batches would finish it. Continuing to note: this is marginal pre-deploy polish; the high-value work remains founder-gated (Supabase password rotation, CSP report-only, auto-poster, £ earnings, worker-e2e test DB).

## 2026-07-01 (6) — Unit-test the compliance-dashboard list logic (deferred console grind)
- **Item:** (deferred the console.* sweep this firing — explicitly allowed by item 77's reprioritization "large batches OR defer") → did higher-value coverage instead
- **Outcome:** shipped
- **Changes:** new `frontend/lib/compliance-dashboard.filters.test.ts` — 14 tests covering `filterWorkers` (name/email/jobTitle, case-insensitive, empty + no-match), `sortWorkers` (score/name/updated, asc+desc, **non-mutating**), `paginateWorkers` (slice, totalPages, partial last page, empty), and `buildQueryString`/`parseQueryString` (defaults omitted + full round-trip). These pure functions drive the coordinator compliance list and were entirely untested.
- **Verify:** new file **14/14**; full frontend `npm run test:ci` = **5 files / 67 tests** (was 53); `npm run lint` 0 errors; `npm run build` ✓.
- **Commit:** see git — 🛡️ test(frontend): cover compliance-dashboard filter/sort/paginate logic
- **Notes / decisions:** Judged this real regression protection on core list UX (a bug in sort/filter silently shows coordinators wrong data) to be more valuable than another marginal console.* batch — and item 77 already permits deferral. The console.* tail (~remaining files) is still queued; recommend doing it in one large batch near deploy, or leaving it. Still flagging: the loop has exhausted high-value autonomous work; the meaningful next steps are all founder-gated (Supabase password rotation, CSP report-only, auto-poster, £ earnings, worker-e2e test DB) — pausing the cron or greenlighting one of these would beat continued polish.

## 2026-07-01 (5) — console.* → pino, batch 4 (compliance + agencies) + reprioritize
- **Item:** Migrate remaining `console.*` to the logger — batch 4
- **Outcome:** shipped (2 files) + **reprioritized the item**
- **Changes:** `routes/compliance.js` (8) and `routes/agencies.js` (8) — all `console.*` → `(req.log||logger)` in pino `(obj,msg)` form (handler catch blocks; `agency created` at info). Added the logger import to each.
- **Verify:** no `console.` left in either; `node --check` both OK; `npm run test:ci` = **22 suites / 192 tests, 0 failing**.
- **Commit:** see git — 🛡️ refactor(routes): migrate compliance+agencies console.* to logger
- **⚠️ Reprioritization (product-owner call):** surveyed the full scope and found **~130 `console.*` across ~32 files** — far more than the plan implied. Grinding one file per firing would waste ~20 firings on marginal pre-deploy polish while all high-value work is founder-gated. Updated item 77: do the remaining tail in **large batches (5–8 files/firing)** to finish in ~2–3 firings, **or defer** until nearer deploy; and explicitly scoped OUT `server.js` boot logs + `src/tests/` (those should stay `console`). 5 files / ~74 calls migrated so far (the highest-signal ones).
- **Note to founder:** the loop has genuinely exhausted high-value autonomous work — the remaining backlog is this marginal sweep + founder-gated items (Supabase password rotation, CSP report-only, auto-poster, £ earnings, worker-e2e test DB). Consider pausing the 10-min cron or greenlighting a gated item.

## 2026-07-01 (4) — console.* → pino migration, batch 3 (documents.js)
- **Item:** Migrate remaining `console.*` to the logger — batch 3
- **Outcome:** shipped
- **Changes:** `routes/documents.js` — all **19** `console.*` migrated. The 6 in the background `analyzeDocument` + module scope use the base `logger`; the 13 in request handlers use **`(req.log || logger)`** so they carry the requestId when the request-logger middleware ran, and safely fall back otherwise. Converted to pino `(obj, msg)` form (e.g. GCM-auth-failure object arg, decryption/upload errors as `{ err }`). Verbose OCR/cache chatter demoted to `debug`.
- **Verify:** no `console.` left; `node --check src/routes/documents.js` OK; `npm run test:ci` = **22 suites / 192 tests, 0 failing**. (A plain `node -e require()` of the route fails on its `../lib/ocrService` **.ts** import — pre-existing, unrelated to logging; the app runs it through a TS transform, and jest handles it in-suite.)
- **Commit:** see git — 🛡️ refactor(documents): migrate console.* to structured logger
- **Notes / decisions:** Used the `(req.log || logger)` pattern (same as server.js's error handler) so handler logs get requestId correlation without assuming the middleware ran (safe in isolated tests too). This is the biggest route file done; remaining console.* are the smaller route files + `lib/encryption.js`. Backend console.* is now ~58 calls migrated across the 3 highest-volume files (cron 28 + email 11 + documents 19).

## 2026-07-01 (3) — console.* → pino migration, batch 2 (emailService)
- **Item:** Migrate remaining `console.*` to the logger — batch 2
- **Outcome:** shipped
- **Changes:** `services/emailService.js` — all **11** `console.*` migrated to `logger.child({ service: 'email' })` in pino `(obj, msg)` form: send-attempt/success at `info`, routing + Resend API detail at `debug` (was noisy `console.log`), missing-key at `warn`, failures at `error` with `{ err }`. Behaviour unchanged.
- **Verify:** no `console.` left; `node --check` + `require()` OK; `npm run test:ci` = **22 suites / 192 tests, 0 failing**.
- **Commit:** see git — 🛡️ refactor(email): migrate console.* to structured pino logger
- **Notes / decisions:** Picked emailService over the larger `documents.js` for this batch because it's uniform (service-level, no `req` scoping) → a clean, complete, low-risk conversion. Also demoted routing/API-response chatter to `debug` so default `info` logs stay signal-rich. `documents.js` (mixed request-handler + background) is next — needs `req.log` in handlers vs base `logger` in `analyzeDocument`, so it warrants its own careful batch.

## 2026-07-01 (2) — console.* → pino migration, batch 1 (cronService)
- **Item:** Migrate remaining `console.*` to the logger — batch 1
- **Outcome:** shipped
- **Changes:** `services/cronService.js` — all **28** `console.log/error/warn` calls migrated to a module child logger `logger.child({ service: 'cron' })`, each converted to pino's `(obj, msg)` form (e.g. `console.error('…', err)` → `log.error({ err, … }, '…')`), with the `[Cron Service]` prefixes dropped (now the `service:cron` binding). All Sentry captures + business logic left exactly as-is.
- **Verify:** no `console.` left in the file; `node --check` OK + `require()` loads; `npm run test:ci` = **22 suites / 192 tests, 0 failing** (unchanged — cronService isn't in a passing suite, but loads clean).
- **Commit:** see git — 🛡️ refactor(cron): migrate console.* to structured pino logger
- **Notes / decisions:** Picked cronService as batch 1 (most console.* by far, and background jobs benefit most from structured logs). Did it as a careful per-call conversion (rewrote the file) rather than a blind find/replace, since pino's signature differs from console's. Remaining files queued in the plan for future batches. This is the last non-gated backlog item; after the console.* batches, everything left is founder-gated (£ earnings, CSP report-only, auto-poster) or large/infra (security-pipeline features, worker-e2e test DB).

## 2026-07-01 — Structured logger (pino) core + request correlation
- **Item:** Structured logger (pino)
- **Outcome:** shipped (bounded slice: logger + server.js request/error wiring; broad console.* migration split into a follow-up)
- **Changes:** `npm install pino`; new `backend/src/lib/logger.js` (level from `LOG_LEVEL`/NODE_ENV; JSON; redacts authorization/cookie/password/otp/token). `server.js`: requires it, attaches `req.log = logger.child({ requestId })` in the request-id middleware, and the global error handler now emits a structured correlated line (`(req.log||logger).error({ err, userId, agencyId }, 'Unhandled request error')`). +2 smoke tests (`tests/unit/logger.test.js`, LOG_LEVEL=silent).
- **Verify:** logger `require()` OK (guards the redact config, which throws on bad paths); `node --check src/server.js` OK; new test **2/2**; `npm run test:ci` = **22 suites / 192 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(backend): pino structured logger + request-scoped logging
- **Notes / decisions:** Did the high-value bounded slice (logger + request correlation + error handler) rather than a churny mass `console.*` replacement — the sweep is queued as a follow-up to do in small verifiable batches. Skipped `pino-pretty` (JSON-only) to avoid a second dep + transport worker-thread complexity; JSON is deploy-standard and pairs with the requestId/Sentry pipeline. **This clears the last clean no-decision item** — remaining backlog is founder-gated (£ earnings, CSP report-only, auto-poster) or large/infra (security-pipeline features, worker-e2e test DB), plus the mechanical console.* sweep. Next firing: the console.* sweep batch, or ideate/await a founder unlock.

## 2026-06-30 17:22 — Resurrect the audit-pack component test → frontend testing complete (53 tests)
- **Item:** Resurrect `__tests__/audit-pack-components.test.tsx`
- **Outcome:** shipped — all 3 pre-existing frontend suites now run; **component-testing seam established**
- **Changes:** installed `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@vitejs/plugin-react`; added `plugins: [react()]` to `vitest.config.ts` (JSX transform — the components are TSX and tsconfig is jsx:preserve); imported `@testing-library/jest-dom/vitest` in `vitest.setup.ts` (for `.toBeInTheDocument`); switched the test's `jest.mock('react-hot-toast')` → `vi.mock(...)` (vitest statically hoists `vi.mock`); added the file to `include`.
- **Verify:** the component suite **12/12**; full `npm run test:ci` = **4 files / 53 tests passed**; `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully.
- **Commit:** see git — 🛡️ test(frontend): resurrect audit-pack component suite (RTL)
- **Notes / decisions:** The AuditPackModal/CQCChecklist components are context-free (plain `fetch` + `react-hot-toast`, no Clerk/useApi), so they rendered under jsdom with just fetch+toast mocks — no provider wrapping needed. The only blocker was the JSX transform (fixed with `@vitejs/plugin-react`) and `.toBeInTheDocument` (jest-dom). One-line test edit (`jest.mock`→`vi.mock`) for reliable hoisting. **Frontend now has a real, CI-enforced test foundation (unit + component): 53 tests.** Combined with backend's 190, the project is at ~243 green tests. Remaining clean item: pino logger (76); the rest is founder-gated or large/infra.

## 2026-06-30 17:12 — Resurrect 2 of 3 frontend __tests__ suites (4 → 41 tests)
- **Item:** Resurrect the pre-existing `frontend/__tests__/` suites
- **Outcome:** shipped (2 of 3 suites; the React component one deferred)
- **Changes:** installed `jsdom`; rewrote `vitest.config.ts` to add the `@/` alias (`fileURLToPath`), `globals: true`, `environment: 'jsdom'`, a `setupFiles` entry, and widened `include` to the two non-component suites; new `vitest.setup.ts` shims `jest`→`vi` (the suites were authored against Jest); excluded `vitest.setup.ts` from `next build`'s typecheck.
- **Verify:** `npm run test:ci` = **3 files / 41 tests passed** (lib 4 + worker-compliance 21 + worker-offline 16); `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully.
- **Commit:** see git — 🛡️ test(frontend): resurrect worker-compliance + worker-offline suites
- **Notes / decisions:** Unlike the backend placeholder suites, these two were *real* tests and passed once wired (no bugs surfaced — the compliance-scoring + offline-cache libs are correct). Deferred `audit-pack-components.test.tsx` (12 tests) — it's a React component test needing `@testing-library/react` + `user-event` (another dep install) and `vi.mock` hoisting differs from `jest.mock`, so it warrants its own firing. Frontend coverage went from a single seed test to 41 real assertions over core worker logic + CI-enforced.

## 2026-06-30 17:02 — Frontend test runner (Vitest) — establishes the seam
- **Item:** Frontend test runner
- **Outcome:** shipped (closes the biggest coverage gap: frontend had *zero* tests)
- **Changes:** `npm install -D vitest`; added `test`/`test:ci` scripts; `vitest.config.ts` (scoped `include: ['lib/**/*.test.ts']`, node env); `lib/compliance-dashboard.test.ts` (4 tests — `getComplianceStatus` boundaries + `getStatusLabel`); `tsconfig.json` excludes `*.test.ts(x)` so `next build` won't typecheck them; CI frontend job now runs `npm run test:ci`.
- **Verify:** `npm run test:ci` = **1 file / 4 tests passed**; `npm run lint` 0 errors; `npm run build` ✓ Compiled successfully. (CI `npm ci` will install vitest from the updated lockfile.)
- **Commit:** see git — 🛡️ test(frontend): add Vitest runner + first lib unit test
- **Notes / decisions:** Finally tackled this (deferred a few firings on the npm-dep concern) — registry is reachable and the strict build+lint+test gate de-risked it. **Discovered 3 pre-existing `__tests__/` suites** (`worker-compliance`, `worker-offline`, `audit-pack-components`) that were written before any runner and fail today (need `@/` alias + jsdom + `@testing-library/react`). Rather than expand this firing into installing RTL/jsdom + chasing unknown assertion failures, I **scoped the runner to `lib/`** (clean green seam) and queued resurrecting `__tests__/` as a follow-up — same "real tests catch real bugs" upside as the backend placeholder episode. The seam is the win: future frontend tests now have a home + CI enforcement.

## 2026-06-30 16:52 — Worker re-upload nudge for expiring/expired documents
- **Item:** Worker document re-upload nudge
- **Outcome:** shipped
- **Changes:** `app/worker/dashboard/page.tsx` — the REJECTED docs already had a Re-upload CTA; **added the expiring/expired case** (gated on `status !== 'REJECTED' && expiryDate && (status === 'EXPIRED' || expiryColor red/yellow)`) with a clear message (expired vs expiring-soon) + Re-upload button. Extracted a shared `startReupload(documentTypeId)` helper (sets the doc-type select, `scrollIntoView` + focus, success toast) and refactored the existing rejected button to use it.
- **Verify:** build ✅ (✓ Compiled successfully; /worker/dashboard 5.49 kB), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only).
- **Commit:** see git — 🛡️ feat(worker): re-upload nudge for expiring/expired documents
- **Notes / decisions:** Read the page first and found the REJECTED nudge already existed — so the real gap was expiring/expired docs (a worker with an expired DBS saw "EXPIRED 10 days ago" but no action). DRY'd the two CTAs through one handler. Build-verifiable only (no localhost) — founder to eyeball. This was the last clean no-new-dep P7 item; remaining work is gated (CSP, auto-poster, £ earnings), needs deps (frontend test runner, pino), or is large/infra (security-pipeline features, worker-e2e test DB). Next firing will ideate unless a gated item is greenlit.

## 2026-06-30 16:42 — Pagination clamps on audit-log + documents
- **Item:** Pagination clamp on the other list endpoints
- **Outcome:** shipped
- **Changes:** `routes/audit-log.js` (was `limit||50`, validated `<=1000` → allowed `take:1000`) and `routes/documents.js` (was `limit||20`, **fully unbounded**) now clamp to `page = max(1)` + `limit = min(max(…,1),100)` — no client can request an unbounded `take`. Removed audit-log's now-redundant 400-on-bad-pagination block (input is clamped instead, matching workers/compliance). New `tests/routes/audit-log.test.js` (5 tests).
- **Verify:** `node --check` both routes OK; new test **5/5**; `npm run test:ci` = **21 suites / 190 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(api): clamp pagination on audit-log + documents
- **Notes / decisions:** Audited all list endpoints first — `compliance` + `workers` already clamp at 100; `shifts` has no user-controlled limit; only audit-log (soft 1000 cap) and documents (no cap) needed it. Used the robust `min(max(...,1),100)` form so negative/zero limits floor to 1 too. Chose this clean, no-new-dep, route-tested item over the frontend test runner (P7) which needs npm devDeps + build/lint/CI integration (its own firing + founder sign-off). Remaining clean backlog is thin — next firing likely the re-upload nudge (frontend, build-verifiable) or another ideation/founder-unlock.

## 2026-06-30 16:32 — Unit-test fetchWithRetry (+ pin a contract quirk)
- **Item:** Unit tests for `lib/fetchWithRetry.js`
- **Outcome:** shipped
- **Changes:** new `backend/src/tests/unit/fetchWithRetry.test.js` — 8 tests (mock `global.fetch`, `maxRetries:1` so the real 1s backoff keeps it quick): success-first-try, non-retryable 404 (no retry), 5xx→retry→success, thrown network error→retry→success, 429 retryable, `maxRetries:0` single attempt, and both exhaustion paths.
- **Verify:** file **8/8**; `npm run test:ci` = **20 suites / 185 tests, 0 failing**.
- **Commit:** see git — 🛡️ test(lib): cover fetchWithRetry retry/backoff + contract
- **Notes / decisions:** Writing the tests surfaced a real **contract quirk** (not a bug, but easy to misuse): on a **persistent 5xx** the helper *returns* the final non-ok response, but on a **persistent thrown/network error** it *re-throws* (with `.attempts`). So callers must BOTH check `.ok` and `try/catch`. Tests now pin both behaviors. Chose this clean, zero-dep, fully-verifiable item over the frontend test runner (P7) — the runner needs new npm devDeps + `next build`/`lint`/CI integration and deserves its own careful firing (and likely founder sign-off on the deps). npm registry IS reachable here (confirmed `npm view vitest` → 4.1.9), so the runner is feasible when prioritized.

## 2026-06-30 16:22 — Identity-mismatch audit (fraud/compliance signal)
- **Item:** Identity-mismatch audit
- **Outcome:** shipped
- **Changes:** added `recordIdentityMismatch(doc, worker, detectedName)` to `lib/analysis-failure.js` — writes a `document.identity_mismatch_detected` audit entry with `metadata: { expectedName, detectedName }` (names only, no document numbers; never throws). `routes/documents.js` `analyzeDocument` now calls it after a successful OCR scan, **gated on `analysis.fullName && analysis.nameMatchesWorker === false`**. +3 unit tests.
- **Verify:** `node --check` documents.js OK; module exports both helpers; analysis-failure suite **8/8**; `npm run test:ci` = **19 suites / 177 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(documents): audit document.identity_mismatch_detected
- **Notes / decisions:** Checked the extractor first (`lib/extractors/index.ts`) — it defaults `nameMatchesWorker` to `false` and only flips true when an extracted name contains the worker's first/last name. So a naive "if !nameMatchesWorker" would have audited EVERY document where no name was read (false positives). Gating on `analysis.fullName` (a name was actually extracted) makes the signal real: a name was read AND it doesn't match. Picked this over the frontend-test-runner item because it needs no new npm deps (the runner needs `npm install`, which is network-restricted in this sandbox) — so it's the highest-priority item that's actually shippable+verifiable here. Frontend test runner remains the next high-leverage pick (may need the founder/CI to run the install).

## 2026-06-30 16:12 — Ideation pass (round 2 — backlog refill)
- **Item:** (no implementation) — ideation pass; clean actionable items hit zero
- **Outcome:** planning
- **Changes:** added a **P7 — Ideated 2026-06-30 (round 2)** section to `AUTONOMOUS-PLAN.md` with 6 verified, buildable, test-verifiable items: identity-mismatch audit (uses the already-computed `nameMatchesWorker`), **frontend test runner** (Vitest+RTL — frontend currently has *zero* tests), pagination clamp on the non-workers list endpoints, unit tests for `lib/fetchWithRetry.js`, worker document re-upload nudge, and a structured logger (pino).
- **Verify:** n/a (planning only). Each item was checked against the code first: confirmed the frontend has no `test` script, `nameMatchesWorker` is stored but never audited, and `express.json`/workers-list are already safe (so I did NOT add those as false gaps).
- **Commit:** see git — 🛡️ docs(knight): ideation round 2 — refill backlog (P7)
- **Notes / decisions:** All prior backlog tiers are now either shipped, decision-gated (£ earnings, CSP, auto-poster), or large/infra (security-pipeline enablement, worker-e2e test DB). Rather than force-green a spec suite or build a gated feature, ran a proper ideation pass so the next several firings have clean work again. **Highest-leverage next pick: the frontend test runner** (closes the biggest coverage gap and unblocks all future frontend tests). The most valuable founder unlocks remain: rotate the Supabase password, greenlight the CSP (report-only), and decide on auto-poster / £ earnings.

## 2026-06-30 16:02 — Harden background document analysis (Sentry + audit on failure)
- **Item:** Harden background document analysis
- **Outcome:** shipped
- **Changes:** new `backend/src/lib/analysis-failure.js` — `recordAnalysisFailure(doc, reason, error?)`: marks the document FAILED, `Sentry.captureException` (with documentId/agencyId tags) when an error is present, and writes a `document.ai_analysis_failed` audit entry (**reason only — no PII**); never throws. Routed all **7** OCR/analysis failure paths in `routes/documents.js` (unsupported type, PDF-empty, PDF-fail, decrypt-fail, OCR-error, analysis-exception, outer-catch) through it and removed the dead `updateDocumentStatus`. +5 unit tests.
- **Verify:** no leftover `updateDocumentStatus`; `node --check` documents.js OK; new test **5/5**; `npm run test:ci` = **19 suites / 174 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(documents): audit + Sentry on OCR analysis failures
- **Notes / decisions:** Corrected the earlier framing: `analyzeDocument` already had a full outer catch, so failures weren't unhandled rejections — the real gap was that they were **silent** (console-only: no Sentry alert, no audit trail), which is unacceptable for a CQC-audit product (a document silently stuck FAILED with no record). The fix makes every failure visible + auditable, with a clean testable seam. This was the last harvested-from-security-pipeline quick win that's verifiable without a live DB/Ollama; the remaining harvested items (identity/wrong-doc detection, optimistic locking) are larger features. Backlog is now decision-gated or large — next firing will ideate unless the founder greenlights a gated item.

## 2026-06-30 15:52 — Unit-test computeCompliance (core logic) + close two leads
- **Item:** (no clean plan item left) — shipped real core-logic coverage instead of pure ideation
- **Outcome:** shipped
- **Changes:** new `backend/src/tests/unit/compliance-assignment.test.js` — 8 direct tests for `computeCompliance` (the pure function every compliance verdict flows through): no-required-docs, all-approved, missing, not-yet-approved, expired (with date), no-expiry-date, partial score + concatenated reasons, snapshot shape. Previously only exercised indirectly via a route test.
- **Verify:** new test **8/8**; `npm run test:ci` = **18 suites / 169 tests, 0 failing**.
- **Commit:** see git — 🛡️ test(compliance): unit-test computeCompliance core logic
- **Decisions / leads closed:** (1) **Frontend Sentry is fine** — `sentry-initializer.tsx` already uses the functional v10 API (`replayIntegration()`/`captureConsoleIntegration()`), not the removed v7 class API. The earlier worry (after the backend v7→v10 fix) is resolved — no fix needed; recorded in the plan so it isn't re-investigated. (2) **Corrected an IDEAS.md mis-assumption:** the document AI pipeline is **local Tesseract OCR**, not Ollama, so the "retry/backoff" harvested item doesn't apply; the real gap is an **unhandled rejection** in the background `setImmediate(analyzeDocument)` (no audit/Sentry on failure) — added as a P6 plan item. With the clean backlog exhausted, chose to add high-value core-logic coverage (fully verifiable, no infra) over redundant ideation.

## 2026-06-30 15:42 — Empty-state adoption across remaining pages
- **Item:** Empty-state consistency — remaining pages
- **Outcome:** shipped (empty states now consistent app-wide)
- **Changes:** adopted `<EmptyState>` on **documents** (page-level "no workers" + CTA), **compliance** ("No workers found"), **shift templates** ("No templates yet"), and the **shifts detail** "Assigned Workers" panel (was off-theme gray `text-gray-500`, now design-system + `py-6`). Added the import to each. Reused already-imported icons (FileText, LayoutTemplate) and omitted icons where none was imported (compliance, shifts) to avoid churn.
- **Verify:** build ✅ (✓ Compiled successfully), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only).
- **Commit:** see git — 🛡️ feat(ui): adopt EmptyState across documents/compliance/templates/shifts
- **Notes / decisions:** Left **reports**' inline table-row messages as-is — they're contextual per-row notes ("Perfect—every worker is compliant", "No expiring documents in this range"), not blank-list states, so EmptyState doesn't fit. Combined with last firing, all main list pages now share one empty-state look. **This clears the last clean P5 item** — the buildable backlog is now only decision-gated (£ earnings, CSP, auto-poster) or larger (security-pipeline features, worker-e2e test DB). **Next firing should run an ideation pass** to refill, unless the founder greenlights a gated item.

## 2026-06-30 15:32 — Empty-state component + adoption (workers, audit-log)
- **Item:** Empty-state consistency
- **Outcome:** shipped (component + 2 key pages; remaining pages split into a follow-up)
- **Changes:** new `frontend/components/ui/empty-state.tsx` — `<EmptyState icon title message action>` (icon tile + title + message + optional CTA, design-system styled, `aria-hidden` icon). Adopted on the **workers** table empty (distinct "no match" vs "none added yet" + "Add your first worker" CTA) and the **audit-log** empty (which was off-theme gray `text-gray-500` → now consistent).
- **Verify:** build ✅ (✓ Compiled successfully), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only).
- **Commit:** see git — 🛡️ feat(ui): reusable EmptyState + adopt on workers/audit-log
- **Notes / decisions:** Established the shared pattern rather than blitzing every page blind (can't visually verify without localhost). Split the remaining adopters (documents, compliance, reports, shifts detail, templates) into a follow-up item — mechanical, build-verifiable. This was the last clean P5 item; the buildable backlog is now thin (mostly decision-gated or larger), so the next firing will likely run an ideation pass.

## 2026-06-30 15:22 — Startup env validation (+ reclassify security-pipeline)
- **Item:** Harden startup env validation (and triage the last 2 "broken suites")
- **Outcome:** shipped (env validation) + planning (security-pipeline reclassified)
- **Changes:** new `backend/src/lib/validate-env.js` (`getEnvErrors(env)` — pure, returns `{errors, warnings}`: DATABASE_URL always required; JWT_SECRET-not-dev-fallback + CLERK_SECRET_KEY required in prod; dev → warnings). `server.js` now calls it at boot, logs warnings, and `process.exit(1)` with a clear message on errors (replacing the soft CLERK check). +5 unit tests.
- **Verify:** `validate-env` require OK; `node --check src/server.js` OK; new test **5/5**; `npm run test:ci` = **17 suites / 161 tests, 0 failing**.
- **Commit:** see git — 🛡️ feat(backend): fail-fast env validation + tests
- **Decisions:** Investigated the next "broken suite", `security-pipeline.test.js` — it is **NOT** a placeholder like the others; it's an **aspirational security SPEC suite** that mounts the real documents router (needs Clerk-auth mocking + `nock` + a live Ollama) and deliberately asserts *unbuilt* features (AI retry/backoff, wrong-document detection, identity-mismatch, optimistic locking) plus env-coupled checks. Force-greening it would mean gutting the spec or building many features blind — a rabbit hole. So I **reclassified** it (and `worker-e2e`, which needs a test DB) in the plan, kept both excluded from CI, and **harvested its concrete security gaps into `IDEAS.md`** ("Harvested from security-pipeline") as real, buildable feature items. The quick-fix portion of the test-suite item is complete (3/3 placeholder/mock suites fixed). Picked env validation (the next clean, verifiable item) to ship this firing.

## 2026-06-30 15:12 — Rewrite worker-dashboard tests → caught + fixed a multi-tenant data leak
- **Item:** Fix the broken backend suites — slice 3 (`worker-dashboard`)
- **Outcome:** shipped — **and found/fixed a security bug (cross-worker data exposure)**
- **Discovery:** `worker-dashboard.test.js` was another **placeholder stub** (only `toBeDefined()`/`toBe(true)`). Rewrote it into **7 real tests** behind the real `workerAuthMiddleware`. The multi-tenant test caught it: `getWorkerDocuments` did `const { workerId, agencyId } = req.worker`, but the middleware sets `req.worker = { id, agencyId }` — so `workerId` was **undefined**, Prisma dropped the filter, and `findMany({ where: { workerId: undefined, agencyId }})` returned **every worker's compliance documents in the agency** to any logged-in worker (PII/GDPR exposure). `uploadWorkerDocument` had the same bug → `workerId: undefined` on create (uploads broken).
- **Changes:** `backend/src/routes/worker-documents.js` — both handlers now destructure `{ id: workerId, agencyId }`. `backend/src/tests/integration/worker-dashboard.test.js` — full real rewrite (7 tests: auth, multi-tenant filter, expiry color/days enrichment, empty, DB-error, document-types). Re-added `worker-dashboard` to `test:ci`.
- **Verify:** worker-dashboard **7/7**; `npm run test:ci` = **16 suites / 156 tests, 0 failing**.
- **Commit:** see git — 🛡️ fix(worker-docs): scope worker documents to the worker (security) + real tests
- **Notes / decisions:** **Third real bug surfaced by replacing placeholder tests with real ones** (after the Sentry v10 crash and the worker-login P0). Pattern holds: the "TDD stub" suites never exercised the routes, so genuine bugs hid behind green-looking intentions. **Please smoke-test the worker portal (login + documents list) once a DB is wired.** Remaining: `security-pipeline` (next firing — likely the same), `worker-e2e` (needs a test DB).

## 2026-06-30 15:02 — Rewrite worker-auth tests → caught + fixed a P0 (worker login broken)
- **Item:** Fix the broken backend suites — slice 2 (`worker-auth`)
- **Outcome:** shipped — **and found/fixed a production P0**
- **Discovery:** `worker-auth.test.js` was a **placeholder TDD stub** — every test set up mocks but never called the endpoint, only asserting `expect(prisma.worker.findUnique).toBeDefined()`. Stubbing it green would have been false coverage, so I **rewrote it into 13 real behavioural tests** (signin incl. anti-enumeration + email-failure resilience; verify-code valid/missing/unknown/wrong/expired/used; JWT cookie; middleware). The valid-OTP test immediately failed with a **500** → the route's `jwt.sign(payload, secret, { expiresIn, iat: ... })` throws `"iat" is not allowed in "options"`. **Every worker `verify-code` call 500s → workers cannot log in at all.** The placeholder never caught it because it never hit the route.
- **Changes:** `backend/src/routes/worker-auth.js` — removed the invalid `iat` option (jsonwebtoken sets `iat` automatically). `backend/src/tests/integration/worker-auth.test.js` — full real rewrite (13 tests). Re-added `worker-auth` to `test:ci`.
- **Verify:** worker-auth file **13/13**; `npm run test:ci` = **15 suites / 149 tests, 0 failing** (worker-auth rejoined); full suite shows only the 3 still-excluded suites failing (worker-dashboard, security-pipeline, worker-e2e). The CI gate is green under `--runInBand`.
- **Commit:** see git — 🛡️ fix(worker-auth): remove invalid iat jwt option (P0) + real tests
- **Notes / decisions:** This is the second P0 the Knight has surfaced (after the Sentry v10 crash) — both were latent because the relevant tests/paths were never exercised. **Please smoke-test worker login once a DB/SMTP is wired.** `worker-dashboard` and `security-pipeline` are probably the same placeholder pattern — next firings will rewrite them into real tests (and likely surface more real bugs).

## 2026-06-30 14:52 — Fix worker-assignments test suite (1 of 5)
- **Item:** Fix the mock-broken backend suites — slice 1
- **Outcome:** shipped
- **Changes:** `backend/src/tests/routes/worker-assignments.test.js` — added the missing `findMany: jest.fn()` to the `prisma.shiftAssignment` mock in `beforeEach` (the 2 GET tests used it but it was never stubbed → undefined). Removed `worker-assignments` from the `test:ci` ignore list so CI runs it.
- **Verify:** worker-assignments file now **10/10** (was 8/10); `npm run test:ci` = **14 suites / 136 tests, 0 failing** (worker-assignments rejoined); full suite **146 passed / 25 failed** (was 144/27).
- **Commit:** see git — 🛡️ test(workers): fix worker-assignments suite (missing findMany mock)
- **Notes / decisions:** Confirmed the suite was a pure incomplete-mock bug (the 8 PATCH tests already passed; only the 2 GET tests failed on the missing `findMany`) — not aspirational, so a 1-line fix. **Remaining mock-broken suites: `worker-auth`, `worker-dashboard`, `security-pipeline`** (next firings), plus `worker-e2e` which genuinely needs a live test DB. Slicing item 50 one suite per firing to keep each change small + verified.

## 2026-06-30 14:42 — Modal focus management (a11y)
- **Item:** Modal focus management (a11y)
- **Outcome:** shipped
- **Changes:** `components/ui/modal.tsx` — on open: remembers `document.activeElement`, moves focus to the first focusable child (or the card); while open: traps Tab/Shift+Tab within the dialog; on close: restores focus to the opener. Card is `tabIndex={-1}` + `outline-none` as a focus fallback. Merged the existing Esc handler into the same keydown listener.
- **Verify:** build ✅ (✓ Compiled successfully), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only). Couldn't keyboard-test in a browser here, but it's the standard focus-trap pattern and every modal builds clean.
- **Commit:** see git — 🛡️ feat(a11y): focus trap + restore in shared Modal
- **Notes / decisions:** High-leverage because the whole app's modals now route through `<Modal>` (after the recent consolidation) — one change improves keyboard/screen-reader UX everywhere (proper focus on open, no tabbing out to the page behind, focus returns to the trigger). Skipped the gated items; left item 50 (fix the 5 mock-broken suites) for dedicated per-suite firings.

## 2026-06-30 14:32 — GitHub Actions CI (+ discovered the "27 failures" are mock bugs)
- **Item:** GitHub Actions CI
- **Outcome:** shipped
- **Changes:** new `.github/workflows/ci.yml` — frontend job (`npm ci` → `npm run lint` → `npm run build`) + backend job (`npm ci` → `npx prisma generate` → `npm run test:ci`), on push/PR to `main`. Added `test:ci` to `backend/package.json` (`jest` ignoring the 5 broken suites).
- **Verify:** `npm run test:ci` locally = **13 suites / 126 tests, 0 failing**. Frontend lint+build pass (verified repeatedly). YAML is standard (no local YAML linter available, but every command it runs is locally validated). Couldn't execute GitHub Actions from here — the workflow will run on the next push; **please confirm it goes green on GitHub**.
- **Commit:** see git — 🛡️ ci: add GitHub Actions workflow (frontend + backend)
- **Notes / decisions:** **Important discovery:** the long-standing "27 failing / DB-dependent integration suites" were mostly mis-diagnosed — `worker-auth`, `worker-dashboard`, `security-pipeline`, `worker-assignments` actually **mock prisma but never set up the model objects** (`prisma.worker` undefined → `findUnique` throws); only `worker-e2e` truly needs a DB. Reworded the backlog item accordingly (fix the incomplete mocks, then add them to `test:ci`). CI deliberately excludes those 5 so the pipeline is green and trustworthy now; it still guards the whole frontend + 126 backend tests.

## 2026-06-30 14:22 — Bulk worker CSV import: upload modal (slice 2 — feature complete)
- **Item:** Bulk worker CSV import — frontend slice
- **Outcome:** shipped (feature complete end-to-end)
- **Changes:** new `frontend/app/dashboard/workers/components/WorkerBulkUploadModal.tsx` — file upload (FileReader→text) + paste textarea + "Download template" + a results view (succeeded/failed + per-row errors), all via `useApi` (`/api/workers/bulk/upload` + `/template`), rendered through the canonical `<Modal>`. Wired a "Bulk import" button into the Workers page header (`workers/page.tsx`) + refreshes the list on success.
- **Verify:** build ✅ (✓ Compiled successfully; workers route 5.52 kB), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only; API tested in slice 1).
- **Commit:** see git — 🛡️ feat(workers): bulk import upload modal
- **Notes / decisions:** Design-system themed (matches the Workers page) rather than copying the shifts modal's generic gray look; used `useApi` (Clerk token) since the backend route is `requireAgency`. Coordinators can now import many workers from a CSV with clear per-row error feedback. Couldn't visually verify (no localhost) — build/lint pass; founder to eyeball.

## 2026-06-30 14:12 — Bulk worker CSV import: backend (slice 1)
- **Item:** Bulk worker CSV import — backend slice
- **Outcome:** shipped (slice 1 of 2: API; upload modal next)
- **Changes:** new `backend/src/routes/workers-bulk.js` mirroring shifts-bulk — `POST /api/workers/bulk/upload` (parses CSV via `csv-parse/sync`, validates firstName/lastName/email per row + email format + optional startDate, creates workers, returns `{ results: {total, succeeded, failed, errors[]} }`, dup-email → per-row error) and `GET /api/workers/bulk/template` (CSV template). Mounted at `/api/workers/bulk` **before** the generic `/api/workers` router so `/:id` can't swallow it. +5 tests.
- **Verify:** route `require()` loads ✅; `node --check src/server.js` ✅; new test **5/5**; full backend suite **144 passed / 27 failed** (was 139/27 — **+5 new, zero new failures**).
- **Commit:** see git — 🛡️ feat(workers): bulk CSV import API
- **Notes / decisions:** Mirrored the proven shifts-bulk shape (incl. `{ csvData }` body + per-row error reporting) for consistency. Mounted before `/api/workers` to avoid the `/:id` route capturing `/bulk` (defensive even though fall-through would also work). Queued the **upload modal** (Workers page) as slice 2. Skipped gated items (£ earnings, CSP, DB-less integration suites).

## 2026-06-30 14:02 — Manage Document Types: Settings UI (slice 2 — feature complete)
- **Item:** Manage Document Types — frontend slice
- **Outcome:** shipped (feature now complete end-to-end)
- **Changes:** new `frontend/app/dashboard/settings/components/DocumentTypesManager.tsx` — a self-contained card on the Settings page: lists document types, add/edit via one form (name, description, required?, hasExpiry, expiryWarningDays), delete via ConfirmDialog. All through `/api/document-types` (`useApi`); the backend's "in use" 409 on delete is surfaced as a friendly toast. Rendered below the agency-details form in `settings/page.tsx`.
- **Verify:** build ✅ (✓ Compiled successfully; settings route 6.62 kB), lint ✅ (0 errors), tests ⏭️ skipped (frontend-only; API tested in slice 1).
- **Commit:** see git — 🛡️ feat(settings): document types management UI
- **Notes / decisions:** Coordinators can now manage their required-document config from the UI (previously impossible — only a read endpoint existed). Light design-system themed; ConfirmDialog uses the shared canonical Modal. Couldn't visually verify (no localhost) — build/lint pass; founder to eyeball.

## 2026-06-30 13:52 — Manage Document Types: backend CRUD (slice 1)
- **Item:** Manage Document Types (core compliance config) — backend slice
- **Outcome:** shipped (slice 1 of 2: API; Settings UI next)
- **Changes:** new `backend/src/routes/document-types.js` — GET/POST/PATCH/DELETE for `DocumentType` (agency-scoped; name required; sensible defaults isRequired/hasExpiry/warningDays; **409 on duplicate name**; **409 on delete when complianceDocuments still use the type**). Mounted at `/api/document-types`. New `tests/routes/document-types.test.js` (8 tests).
- **Verify:** route `require()` loads ✅; `node --check src/server.js` ✅; new test **8/8**; full backend suite **139 passed / 27 failed** (was 131/27 — **+8 new, zero new failures**).
- **Commit:** see git — 🛡️ feat(documents): document-types CRUD API
- **Notes / decisions:** Only a list endpoint existed before (`/api/agencies/document-types`); no way to create/edit/delete the required-document config — core to a compliance product. Added a dedicated RESTful router; the existing agencies GET is left in place (still used elsewhere). Delete is intentionally blocked when documents reference the type (FK-safe + clear message). Queued the **Settings UI** as slice 2. Skipped the gated items (£ earnings, CSP, DB-less integration suites).

## 2026-06-30 13:42 — Fix buggy role test (shift-assignments)
- **Item:** Fix the buggy `should reject non-OWNER/ADMIN users` test (+ DB-less integration suites — split off)
- **Outcome:** shipped (test fix); the DB-less-integration half is queued as its own item
- **Changes:** `backend/src/tests/routes/shift-assignments.test.js` — the `requireAgency` mock previously hardcoded `req.user = OWNER`, which overrode the VIEWER the test set, so the role check never failed. Changed it to respect a pre-set `req.user`/`req.agencyId` (defaulting to OWNER), and cleaned up the test (removed a nonsense `shiftAssignmentsRouter.replace = jest.fn()` line) so it sets a VIEWER before mounting the router.
- **Verify:** `shift-assignments.test.js` now **8/8** (was 5/8); full backend suite **131 passed / 27 failed** (was 130/28 — one more passing, suite moved from failed→passed). No new failures.
- **Commit:** see git — 🛡️ test(shifts): fix VIEWER-rejection test (requireAgency mock)
- **Notes / decisions:** Did only the small, clean test fix this firing. The remaining 27 failures are the integration suites that need a live Postgres (`worker-*`, `security-pipeline`) — split into a separate backlog item since making them DB-less is a test-infra decision (CI Postgres service vs a dedicated Supabase test project vs mocking) that pairs with the GitHub Actions CI item; don't want them hitting the real Supabase DB.

## 2026-06-30 13:32 — requestId Sentry scope tag + FIX latent Sentry v10 crash (P0)
- **Item:** Set `requestId` as a per-request Sentry scope tag
- **Outcome:** shipped (+ discovered/fixed a P0)
- **Discovery:** the installed `@sentry/node` is **v10.53.1**, but `server.js` used **v7 APIs** — `new Sentry.Integrations.Http/Express/OnUncaughtException/OnUnhandledRejection` in `init`, and `Sentry.Handlers.requestHandler()/errorHandler()`. In v10 `Sentry.Integrations` and `Sentry.Handlers` are `undefined`, so the moment `SENTRY_DSN_BACKEND` is set (i.e. production error monitoring is turned on) the backend would **TypeError on boot**. It only "worked" because the DSN is empty in dev (Sentry block skipped).
- **Changes:** `backend/src/server.js` — `Sentry.init` now uses v8+ defaults (dropped the removed `integrations: [new Sentry.Integrations.*]` array; HTTP/Express/uncaught/unhandled are auto-enabled). Replaced the dead `Handlers.requestHandler()` with a middleware doing `Sentry.setTag('requestId', req.requestId)` (the actual item — v8+ isolates scope per request, so all events in the request carry it). Removed the dead `Handlers.errorHandler()`; the custom global handler keeps its `Sentry.captureException(err, { tags })` (valid in v10) so no double-capture.
- **Verify:** `node --check src/server.js` ✅; a node harness confirmed v10 `init` + `setTag` + `captureException` don't throw ✅; backend `npm test` 130 passed / 28 failed (unchanged baseline — zero new failures); grep confirms no `Sentry.Handlers`/`Sentry.Integrations` code remains (only a comment). Could not boot-with-real-DSN here (no DSN/DB-in-sandbox), but the API surface is validated.
- **Commit:** see git — 🛡️ fix(sentry): migrate to @sentry/node v10 API + requestId scope tag
- **Notes / decisions:** This is the highest-value find in a while — Sentry is the production error-monitoring the whole observability phase depends on, and it was silently un-enable-able. **When the founder adds a real `SENTRY_DSN_BACKEND`, please confirm the backend still boots** (I validated the API but not a live DSN end-to-end).

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
