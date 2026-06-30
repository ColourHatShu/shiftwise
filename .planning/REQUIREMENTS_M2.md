# ShiftWise — Milestone 2 Requirements

**Milestone:** Self-Service, Shifts & Audit Pack  
**Constraint:** Zero-cost (no paid APIs, no external services beyond Resend email which is already in use)

## v2 Requirements

### Worker Self-Service (SELF)
- [ ] **SELF-01:** A public `/worker-signin` page accepts worker email and sends a one-time code via Resend. Worker enters code to receive a temporary JWT (valid for 7 days) in a secure HTTP-only cookie.
- [ ] **SELF-02:** Authenticated worker at `/worker-dashboard` views their own compliance documents (read-only), expiry dates (color-coded: green/yellow/red by urgency), and upcoming alerts.
- [ ] **SELF-03:** Worker can upload new documents via the dashboard (same file upload endpoint, but routed to their own agency without coordinator action).
- [ ] **SELF-04:** When a worker uploads a document, the coordinator receives an email notification with worker name, document type, and a link to the review modal.

### Shift Management (SHIFT)
- [ ] **SHIFT-01:** A `Shift` entity exists (date, facility/location, role/position, requiredCount, status: OPEN|FILLED|CANCELLED). Coordinator can create/edit/delete shifts.
- [ ] **SHIFT-02:** A `WorkerAvailability` table tracks when workers are available (calendar view: available/unavailable/onleave). Workers mark availability via self-service dashboard or coordinator marks it.
- [ ] **SHIFT-03:** Coordinator can assign workers to shifts. System auto-flags if assigned worker is missing critical compliance docs (e.g., DBS, Right to Work) for that facility type.
- [ ] **SHIFT-04:** A shift list UI shows all shifts (past, current, upcoming), assignment status (X of Y filled), and a compliance-gap report (which assigned workers have incomplete docs).

### Audit Pack Export (AUDIT)
- [ ] **AUDIT-01:** A `POST /api/audit-pack/export` endpoint accepts dateFrom/dateTo, generates a ZIP file containing audit-log.csv (all actions in date range) and metadata.json (export date, agency, period).
- [ ] **AUDIT-02:** The audit pack ZIP includes a workers/ subdirectory with one JSON file per worker (worker metadata, compliance docs, expiry dates, alert history).
- [ ] **AUDIT-03:** The ZIP is compressed (gzip) and <50MB even with large audit logs (100K+ rows).
- [ ] **AUDIT-04:** After export, the ZIP is emailed to coordinator with a download link (7-day expiry) and also saved to disk for manual download from `/dashboard/audit-packs`.

## Traceability (M2)

| REQ-ID | Phase | Category |
|--------|-------|----------|
| SELF-01 | 4 | Worker Self-Service |
| SELF-02 | 4 | Worker Self-Service |
| SELF-03 | 4 | Worker Self-Service |
| SELF-04 | 4 | Worker Self-Service |
| SHIFT-01 | 5 | Shift Management |
| SHIFT-02 | 5 | Shift Management |
| SHIFT-03 | 5 | Shift Management |
| SHIFT-04 | 5 | Shift Management |
| AUDIT-01 | 6 | Audit Pack Export |
| AUDIT-02 | 6 | Audit Pack Export |
| AUDIT-03 | 6 | Audit Pack Export |
| AUDIT-04 | 6 | Audit Pack Export |

## Out of Scope (M2)

- Rota optimization algorithms (defer to M3)
- SMS escalations (requires Twilio, paid)
- Real-time WebSocket notifications (MVP uses email + polling)
- Mobile native apps (PWA sufficient)
- Gov.uk integrations (RTW share codes, NMC PIN checks, DBS update service)
- KMS key management (existing AES-256-GCM sufficient)
- Cyber Essentials / NHS DSPT / ICO registration (compliance/legal, not technical)

