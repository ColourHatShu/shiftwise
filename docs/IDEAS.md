# 🛡️ Autonomous Knight — Ideas Ledger

> A running list of bigger feature bets and "someday" ideas. The Knight promotes
> mature ideas into `AUTONOMOUS-PLAN.md` when they're scoped enough to ship in
> small slices. Park raw ideas here first.

## Differentiators (need product validation / data)
- **AI shift-matcher** — "Top 5 workers for this shift" weighted by compliance, distance, past performance, availability, skill match. Build rule-based first; ML once there's production signal.
- **Compliance risk predictor** — flag workers likely to fall non-compliant in the next 30 days. Needs historical data.
- **Shift swap marketplace** — workers trade/claim shifts peer-to-peer.

## New tenant type (own milestone, needs SPEC)
- **Care home / client self-service portal** — read-only compliance proof bundle + invoicing dashboard + request-specific-worker + post-shift worker rating. This is a new tenant type, not a feature — scope as its own milestone.

## Coordinator power features
- Worker scorecards · recurring shift auto-poster · coordinator handoff notes · bulk shift broadcast with priority tiering · worker comms log · no-show/late incident workflow · margin calculator per shift.

## Worker portal depth
- Clock-in/out with geofence · in-app payslip viewer · travel expense log · refer-a-friend tracker · saved care homes · shift map view.

## Platform / production hardening (defer until deploy)
- Pino structured logger (replace `console.log`) · GitHub Actions CI · `Idempotency-Key` support on POSTs · file content-hash dedup · encryption `keyVersion` column for key rotation · migrate local disk → Cloudflare R2 at first real customer.

## Surfaced 2026-06-30 (during ideation — promote when scoped)
- **Worker reliability scorecards** — derive per-worker stats from assignment data (shifts confirmed vs declined, no-shows, total hours) → a scorecard coordinators can sort by. Foundation for the AI shift-matcher. *(value: better staffing decisions; effort: medium; builds on existing ShiftAssignment data.)*
- **No-show / late incident workflow** — coordinator logs an incident against a worker+shift (reason, severity); feeds the scorecard. *(needs a small Incident model; medium.)*
- **In-app notifications centre** — today alerts are email-only; add a bell/inbox so coordinators see expiry/upload/assignment events in-app. *(value: daily engagement; effort: medium — new Notification model + polling.)*
- **Worker document re-upload nudges** — when a doc is rejected or expiring, surface a clear "re-upload" prompt in the worker portal (data already exists). *(value: faster compliance; effort: low-medium, frontend-led.)*
- **Coordinator handoff notes** — free-text shift/day notes visible to the next coordinator. *(value: continuity; effort: low.)*
- **Care-home contact rolodex** — store facility contacts (name/phone/email) so coordinators aren't digging through WhatsApp. *(value: ops; effort: low-medium — new Facility/Contact model.)*

## Harvested from `security-pipeline.test.js` (aspirational spec → real features)
> That suite documents desired AI-pipeline security behaviours, most NOT YET implemented. Build them as real features (each with real tests), then the spec can be enabled incrementally.
> ⚠️ **Correction (2026-06-30):** the spec assumes an **Ollama** network call, but the real `/api/documents/:id/analyse` uses **local Tesseract OCR** (`lib/ocrService`) run in a background `setImmediate`. So "retry/backoff/Retry-After" mostly doesn't apply; the real resilience gap is the **unhandled rejection** in that background call (now tracked as a plan item).
- **AI analyse resilience (corrected)** — the manual analyse route runs `analyzeDocument` in `setImmediate` with no try/catch → silent failure, no `document.ai_analysis_failed` audit, no Sentry. Wrap it + audit failures. (See P6 in the plan.) *(reliability + auditability.)*
- **Identity & wrong-document detection** — flag when the AI-extracted name doesn't match the worker (`identity_mismatch_detected` audit) or the detected document type differs from the expected type (`wrongDocumentWarning`). *(fraud/compliance signal; high value for a CQC-audit product.)*
- **PII-safe audit logging** — ensure audit-log metadata never stores raw PII (document numbers, full names) extracted by the AI. *(GDPR.)*
- **Optimistic locking on document verify** — concurrent approve/reject shouldn't flip-flop status; add a version column / transactional guard. *(data integrity.)*
- **Upload audit trail** — coordinator/worker uploads should always write an audit log (IP, user agent, user id, metadata sans file content). *(traceability.)*
