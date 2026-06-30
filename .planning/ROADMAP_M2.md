# ShiftWise — Milestone 2 Roadmap

**Milestone:** Self-Service, Shifts & Audit Pack (Zero-Cost Feature Expansion)  
**Granularity:** Coarse — 3 phases  
**Mode:** Vertical MVP per phase  
**Total requirements:** 12 (SELF-01-04, SHIFT-01-04, AUDIT-01-04)

---

## Milestone 2 Goals

Expand ShiftWise from "compliance coordinator tool" to "self-service + operations platform". By end of milestone:
1. **Workers** can view their own compliance status and upload documents themselves (reduced coordinator burden)
2. **Coordinators** can manage shifts and track worker availability (foundation for rota optimization)
3. **Audit** evidence is packaged as ZIP exports for CQC inspections (compliance artifact delivery)

---

## Phase 4: Worker Self-Service Portal

**Goal:** Allow workers to view their compliance status (docs, expiries, alerts) and upload documents directly without coordinator intervention. Reduces manual coordinator tasks.

**Requirements:**
- SELF-01: Public sign-in page for workers (JWT-less entry, no Clerk required)
- SELF-02: Worker dashboard showing their own documents, expiry dates, upcoming alerts
- SELF-03: Worker can upload new documents (same upload flow, routed to their agency)
- SELF-04: Coordinator notified when worker uploads (audit trail + email)

**Success Criteria:**
1. Worker accesses `/worker-signin` with email + code (sent via Resend email)
2. Worker sees personal compliance dashboard (read-only: their docs, expiries, alerts)
3. Worker can upload new documents via drag-drop; documents appear in coordinator's review queue
4. Coordinator receives email notification with worker name + document type

**Duration (estimate):** 1-2 hours  
**Schema changes:** Minimal (WorkerSession table for temporary JWT/sessions; no Worker schema changes)

---

## Phase 5: Shift Management & Rota

**Goal:** Track which workers are available for shifts, record shift placements, and flag compliance gaps. Foundation for rota optimization in future milestones.

**Requirements:**
- SHIFT-01: Shift entity (date, facility, role, required workers, status)
- SHIFT-02: Worker availability calendar (mark available/unavailable days)
- SHIFT-03: Assign workers to shifts; auto-flag if worker has missing compliance docs
- SHIFT-04: Shift list UI + reporting (coordinator can see scheduled shifts, compliance gaps)

**Success Criteria:**
1. Coordinator creates shift: date + facility + role + required count
2. Coordinator sees worker availability (color-coded: available/unavailable/compliance-gap)
3. Coordinator assigns worker to shift; system flags if compliance is incomplete
4. Compliance gap report shows "Worker X assigned to shift Y but missing doc Z"

**Duration (estimate):** 2-3 hours  
**Schema changes:** Shift table, WorkerAvailability table, ShiftAssignment table

---

## Phase 6: Audit Pack & Compliance Export

**Goal:** Package audit log, compliance documents, and metadata into ZIP for CQC submission or internal review.

**Requirements:**
- AUDIT-01: ZIP export of audit log (JSON + CSV)
- AUDIT-02: ZIP export of worker compliance snapshots (per worker: docs, expiries, alerts)
- AUDIT-03: Metadata file (export date, agency name, covered period)
- AUDIT-04: Email delivery of audit pack (or download link)

**Success Criteria:**
1. Coordinator clicks "Export Audit Pack" for date range (e.g., last quarter)
2. System generates ZIP: audit-log.csv, workers/compliance.json, metadata.json
3. ZIP is emailed to coordinator or available for download for 7 days
4. ZIP is <50MB even with large audit logs (gzip compression)

**Duration (estimate):** 1-2 hours  
**Schema changes:** None (uses existing AuditLog, ComplianceDocument, Worker tables)

---

## Phases Summary

| Phase | Name | REQs | Tasks (est.) | Duration | Schema Changes |
|-------|------|------|-------------|----------|-----------------|
| 4 | Worker Self-Service | 4 | 5 | 1-2 hrs | Minor (WorkerSession) |
| 5 | Shift Management | 4 | 6 | 2-3 hrs | Major (Shift, Availability) |
| 6 | Audit Pack Export | 4 | 4 | 1-2 hrs | None |

**Total:** 12 REQs, ~15 tasks, ~4-7 hours execution  
**Complexity:** Medium (new entities, email delivery, ZIP generation)

---

## Build Order Rationale

1. **Phase 4 (Self-Service) first** because worker uploads reduce coordinator bottleneck immediately and the feature is self-contained
2. **Phase 5 (Shifts) second** because shift management requires availability data from workers, which Phase 4 primes
3. **Phase 6 (Audit Pack) last** because it's a reporting/export feature that becomes more valuable once shifts and self-service are in place (more data to export)

---

## Zero-Cost Achievement (Milestone 2)

✅ **No new services:**
- Worker signin: email codes via existing Resend (free tier)
- Shift management: Postgres + Express + Next.js (existing stack)
- Audit pack: ZIP generation (Node.js built-in)
- Email notifications: Resend (existing integration)

✅ **No new APIs:**
- No paid OCR, vision, or SMS
- No KMS (existing AES-256-GCM key is sufficient)
- No external scheduling/rota optimization (MVP uses simple assignment)

✅ **Backward compatible:**
- All Phase 1-3 features remain intact
- New entities (WorkerSession, Shift, ShiftAssignment) are additive
- Coordinator flow unchanged; worker flow is new parallel path

---

## Deferred (Post-M2)

- Rota optimization AI (pairing algorithm)
- SMS escalation (requires Twilio)
- Gov.uk RTW/NMC/DBS integrations (requires external APIs)
- Real-time shift notifications (requires WebSocket)
- Mobile app (PWA is sufficient for M2)

