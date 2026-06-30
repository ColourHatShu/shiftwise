# Phase 8 SPEC: Compliance-Based Shift Assignment

**Phase Goal:** Enable coordinators to assign compliant workers to shifts via bulk operations. System enforces compliance: rejects assignments for non-compliant workers (missing required documents or expired documents), and workers can view assigned shifts with confirmation workflow.

**Success Outcome:** Coordinators assign workers to shifts confidently knowing the system blocks non-compliant assignments. Workers receive shift notifications and can confirm/decline. All assignments are audit-logged.

---

## Requirements

### R-SA-01: Bulk Assignment API
**Current State:** Shift assignment endpoint exists (Phase 7) but lacks compliance filtering.
**Target State:** `POST /api/shifts/{shiftId}/assign-bulk` accepts a list of worker IDs and assigns only compliant workers. Returns assignment results with skipped non-compliant workers and reasons.
**Acceptance Criteria:**
- [ ] Endpoint validates worker compliance before assignment
- [ ] Accepts JSON payload: `{ workerIds: [string], assignmentType: 'automatic'|'manual' }`
- [ ] Returns: `{ assigned: [{workerId, shiftId, status}], skipped: [{workerId, reason}] }`
- [ ] Skipped workers include reason: "Missing {docType}", "Document expired {date}", "Not yet approved"
- [ ] All assignments logged to AuditLog with action "shift.assigned"
- [ ] Concurrent assignments to same shift respect `requiredCount` (no overbooking)

### R-SA-02: Compliance Filter in Shift View
**Current State:** Worker can see shifts but assignment UX doesn't show compliance status.
**Target State:** On coordinator shift detail page, a panel shows "Assignable Workers" (filtered by: compliant, match shift requirements, not already assigned to shift).
**Acceptance Criteria:**
- [ ] Worker list filtered to show only compliant workers (all required docs approved and not expired)
- [ ] Filters by role match: shift requires "Nurse" → show only "Nurse" workers
- [ ] Excludes already-assigned workers (no duplicate assignments per shift)
- [ ] Displays worker name, compliance score, last updated time, compliance status badge
- [ ] List paginated (25 per page), sortable by name/score

### R-SA-03: Quick Assign UI (Coordinator)
**Current State:** Bulk assignment requires API call only.
**Target State:** Coordinator shift detail page has "Assign Workers" button → modal with searchable list + checkboxes + "Assign Selected" action.
**Acceptance Criteria:**
- [ ] Modal displays compliant workers paginated
- [ ] Search filters by first name, last name, email (case-insensitive)
- [ ] Checkboxes select multiple workers (bulk selection)
- [ ] "Assign Selected" button sends bulk assignment request
- [ ] On success: toast notification, list updates, assignments shown in shift detail
- [ ] On failure (non-compliant detected during assign): show errors and rollback

### R-SA-04: Worker Assignment Notification
**Current State:** Worker uploads documents but doesn't know about assigned shifts.
**Target State:** When coordinator assigns a worker to a shift, worker receives email notification. Email includes: shift date/time, location, role, and link to worker portal.
**Acceptance Criteria:**
- [ ] Email sent via Resend when shift.assigned AuditLog entry is created (triggered by cron or async job)
- [ ] Email template includes: shift date, start/end time, facility name, role, coordinator contact
- [ ] Email has "View Assignment" CTA linking to worker portal
- [ ] Subject: "[Shift Confirmed] {Facility} — {Date} {Time}"
- [ ] Failed emails queued in FailedAlert and retried hourly
- [ ] Worker can opt-out of notifications (Phase 9+)

### R-SA-05: Worker Shift Confirmation Workflow
**Current State:** Worker can see available shifts (Phase 7). Assigned shifts not visible to worker.
**Target State:** Worker portal shows two sections: "Available Shifts" (Phase 7) and "Assigned Shifts" (new). For assigned shifts, worker can confirm/decline with optional note.
**Acceptance Criteria:**
- [ ] Worker sees assigned shifts in dedicated section with status badge (pending / confirmed / declined)
- [ ] Confirm button: worker acknowledges attendance
- [ ] Decline button: worker declines with optional reason (max 200 chars)
- [ ] Confirmation status visible to coordinator in shift detail
- [ ] Declined shifts auto-revert to "Open" and availability notifications re-sent
- [ ] All worker actions logged to AuditLog

### R-SA-06: Compliance Status Validation at Assignment Time
**Current State:** Compliance checked only at request time.
**Target State:** System re-validates compliance at assignment time AND stores validation snapshot (documents, dates, status) in assignment record for audit.
**Acceptance Criteria:**
- [ ] `ShiftAssignment` table has optional `complianceSnapshot: JSON` field (documents list at time of assignment)
- [ ] Assignment fails if: required doc missing, expired, or pending approval
- [ ] Snapshot captures: document types, approval status, expiry dates (immutable audit trail)
- [ ] Verification endpoint returns snapshot if assignment < 30 days old
- [ ] Coordinator can audit compliance state at assignment time (prevent false "compliant" claims)

### R-SA-07: Shift Requirement Templates
**Current State:** Each shift specifies required documents in schema but no reusable templates.
**Target State:** Coordinator can define "Shift Requirement Templates" (e.g., "Nursing", "Support", "Casual") that pre-populate compliance requirements per role.
**Acceptance Criteria:**
- [ ] `ShiftRequirement` model with: templateName, requiredDocuments (array), role, description
- [ ] CRUD endpoints: POST/GET/PUT/DELETE /api/shift-requirements
- [ ] When creating shift, coordinator selects template → auto-populates requirements
- [ ] Default templates provided (Nursing, Carer, Support Worker)
- [ ] Can override on per-shift basis

### R-SA-08: Assignment Status Dashboard (Coordinator)
**Current State:** Coordinator sees individual shifts but no bulk assignment status.
**Target State:** Dashboard shows "Assignment Status" summary: total shifts, assigned count, open count, fill rate %. Toggle to show assignment details per shift.
**Acceptance Criteria:**
- [ ] Summary cards: "Total Shifts", "Assigned", "Open", "Fill Rate %"
- [ ] Table view: Shift date, facility, role, required count, assigned count, % filled
- [ ] Color coding: green (≥80% filled), yellow (50-79%), red (<50%)
- [ ] Click row → shift detail with full assignment list
- [ ] Export as CSV: shift ID, date, facility, role, fill rate

### R-SA-09: Cascading Compliance Updates
**Current State:** Worker document approved/rejected. Assignment status unclear if compliance state changes.
**Target State:** When document approval status changes, system re-validates all of worker's shift assignments. If assignment becomes non-compliant, coordinator receives alert.
**Acceptance Criteria:**
- [ ] Cron job (daily 08:00) re-validates all incomplete shift assignments
- [ ] If worker loses compliance for an assigned shift: mark assignment as "at-risk"
- [ ] Send coordinator alert: "{Worker} assigned to {Shift} may be non-compliant (document expired)"
- [ ] Alert includes: remove assignment, extend deadline, re-assign option
- [ ] Log re-validation in AuditLog

### R-SA-10: Testing & Validation
**Current State:** Phase 7 shift CRUD tests exist.
**Target State:** Comprehensive tests for compliance-aware assignment logic.
**Acceptance Criteria:**
- [ ] Unit tests: compliance check function (compliant worker, expired doc, missing doc scenarios)
- [ ] Integration tests: bulk assign endpoint (success case, partial failure, concurrency)
- [ ] E2E test: coordinator creates shift → assigns workers → worker confirms
- [ ] CSV export test: 100+ shifts export correctly
- [ ] Compliance snapshot validation test
- [ ] Coverage: >80% on assignment logic, >70% overall

---

## Boundaries

### In Scope (Phase 8)
- Bulk assignment API with compliance filtering
- Coordinator quick-assign UI (modal, search, checkboxes)
- Worker shift confirmation workflow
- Assignment notifications (email)
- Compliance snapshot storage for audit
- Shift requirement templates
- Assignment status dashboard
- Cascading compliance updates (cron-based)
- Comprehensive testing (>80% coverage)

### Out of Scope (Deferred to Phase 9+)
- **Push notifications** — Email only in Phase 8
- **Worker notification preferences** (opt-out, digest, timezone) → Phase 9
- **Calendar view of assigned shifts** (worker sees list only) → Phase 9
- **Shift swap / trade requests** → Phase 10
- **Automatic re-assignment on decline** → Phase 9
- **Compliance waiver system** (coordinator override) → Phase 9
- **Integration with external scheduling systems** → Phase 10
- **Mobile app for worker shift confirmation** → Phase 9

---

## Constraints

### Performance
- Bulk assignment (100 workers) completes in < 2 seconds
- Compliance check cache: 60-second TTL on compliance scorecards
- Assignment status dashboard loads in < 1.5 seconds with 500+ shifts

### Data & Privacy
- Compliance snapshot immutable (never updated after creation)
- All assignments logged with userId, timestamp, IP
- Assignment history retained for 2 years (compliance audit)
- GDPR: worker can request assignment history deletion (logs excluded)

### Compatibility
- Works with Phase 7 Shift model (no breaking changes)
- Works with Phase 6 compliance dashboard (reads same compliance data)
- Worker OTP auth unchanged
- Coordinator role checks unchanged (OWNER/ADMIN only for bulk assign)

### Scale
- Assume <500 workers, <1000 shifts per agency initially
- Bulk assign: 100 workers per request
- Concurrent assignments from multiple coordinators safe (unique constraint on ShiftAssignment)

---

## Acceptance Criteria (Go/No-Go)

### Minimum Viable Product
- [ ] Coordinator can bulk-assign workers to shift via modal UI
- [ ] System rejects non-compliant workers (shows reason)
- [ ] Worker receives email when assigned to shift
- [ ] Worker can confirm/decline assignment in portal
- [ ] All assignments logged to AuditLog with full audit trail
- [ ] Assignment status dashboard shows fill rate and open shifts

### Quality Bar
- [ ] No unhandled errors in Sentry related to assignments
- [ ] Compliance check re-validates correctly when docs change
- [ ] Bulk assign handles 100 workers without timeout
- [ ] Concurrent assignments don't create duplicates (unique constraint enforced)
- [ ] All 10 SPEC requirements verified in code

### User Experience Bar
- [ ] Coordinator can assign 20 workers in < 30 seconds (includes modal + confirm)
- [ ] Worker gets shift confirmation email within 1 minute of assignment
- [ ] Worker portal clearly shows assigned vs. available shifts
- [ ] No silent failures — assignment errors shown with actionable messaging

---

## Ambiguity Report

**Auto-selected defaults (--auto mode):**
- Goal clarity: 0.90 ✓ (compliance filtering is specific)
- Boundary clarity: 0.85 ✓ (clear what's in/out)
- Constraint clarity: 0.75 ✓ (performance targets set)
- Acceptance criteria: 0.85 ✓ (pass/fail checkboxes defined)
- **Ambiguity: 0.13** → GATE PASSED

---

*SPEC.md locked. Ready for discuss-phase.*
