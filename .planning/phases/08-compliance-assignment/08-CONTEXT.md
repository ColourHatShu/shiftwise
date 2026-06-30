# Phase 8 Context — Compliance-Based Shift Assignment

**Goal:** Enable coordinators to bulk-assign compliant workers to shifts, with system enforcement preventing non-compliant assignments.

---

## Decisions

**Architecture:**
- Bulk assignment API at `POST /api/shifts/:shiftId/assign-bulk` (accepts JSON: `{workerIds, assignmentType}`)
- Compliance check reuses Phase 5/6 compliance scoring logic (same formula: `completed_required / total_required * 100`)
- Assignment creates immutable `complianceSnapshot` JSON (document state at time of assignment)
- Email notifications sent via Resend (extend existing coordinator notification template)
- Shift requirement templates stored in `ShiftRequirement` model (reusable per coordinator)

**Frontend:**
- Coordinator shift detail page: new "Assign Workers" section with modal
- Modal: searchable worker list (compliant only) + checkboxes + bulk assign button
- Worker portal: two sections: "Available Shifts" (Phase 7) and "Assigned Shifts" (new)
- Worker can confirm/decline with optional note (stored in ShiftAssignment.workerNote)
- Status badges: pending / confirmed / declined

**Backend:**
- New endpoints:
  - `POST /api/shifts/:shiftId/assign-bulk` — bulk assign compliant workers
  - `GET /api/shifts/:shiftId/assignable-workers` — paginated list of compliant workers
  - `PATCH /api/shifts/:shiftId/assignments/:assignmentId` — worker confirm/decline
  - `POST /api/shift-requirements` + `GET/PUT/DELETE` — template CRUD
- Extend cron job: daily at 08:00 re-validate all incomplete assignments, flag at-risk
- New AuditLog actions: `shift.assigned`, `shift.assignment-confirmed`, `shift.assignment-declined`, `shift.compliance-revalidated`

**Database:**
- `ShiftAssignment` model extended with:
  - `complianceSnapshot: JSON` (immutable: { documents: [], status: "compliant" })
  - `workerConfirmation: 'pending'|'confirmed'|'declined'` (default: pending)
  - `workerNote: String?` (max 200 chars)
  - Unique constraint: `(shiftId, workerId)` prevents duplicate assignments
- New `ShiftRequirement` model:
  - `templateName: String` (e.g., "Nursing", "Carer")
  - `requiredDocuments: JSON` (array of document type IDs)
  - `role: String` (e.g., "Nurse")
  - `agencyId: String` (scoped)

**Compliance Score:**
- Reuse Phase 5 formula: `(completed_required / total_required) * 100`
- "Compliant" for assignment = score 100 AND all required docs not expired
- Capture snapshot at assignment time (immutable for audit)
- Re-validate daily via cron; flag at-risk if compliance changes

**Notifications:**
- Email template: new worker-assignment template via Resend
- Subject: "[Shift Confirmed] {Facility} — {Date} {Time}"
- Include: shift date/time, location, role, coordinator contact, CTA to worker portal
- Failed emails: FailedAlert + hourly retry (existing infrastructure)

---

## Code Context

### Reusable Assets

**From Phase 7:**
- `Shift` model, `ShiftAssignment` model (extend, don't replace)
- Shift CRUD endpoints (reuse, build on)
- Calendar UI components (reuse for coordinator view)
- Worker shift browsing UI (reuse for available shifts view)

**From Phase 5/6:**
- `calculateComplianceScore(workerId)` function (Phase 5 helper)
- Compliance badge colors (red/yellow/green)
- ComplianceDocument model + approval status
- AuditLog infrastructure

**From Phase 4:**
- Resend email template pattern
- FailedAlert queue + retry logic

**Tailwind components to reuse:**
- Modal, checkbox, badge, button variants
- Table/list pagination patterns
- Search/filter input patterns

### New Files

**Backend:**
- `backend/src/routes/shift-assignments.js` — Bulk assign, confirm/decline, assign-workers list
- `backend/src/routes/shift-requirements.js` — Template CRUD
- `backend/src/lib/compliance-assignment.js` — Compliance check, snapshot capture
- `backend/src/lib/email-templates.js` — Worker assignment email template (extend existing)
- `backend/src/tests/routes/shift-assignments.test.js` — 15+ tests
- `backend/src/tests/routes/shift-requirements.test.js` — 8+ tests

**Frontend:**
- `frontend/app/dashboard/shifts/components/AssignModal.tsx` — Search, checkboxes, bulk assign
- `frontend/app/dashboard/shifts/components/AssignmentList.tsx` — Show assigned workers + status
- `frontend/app/worker/dashboard/assigned-shifts/page.tsx` — Worker view assigned shifts
- `frontend/app/worker/dashboard/assigned-shifts/components/ConfirmModal.tsx` — Confirm/decline
- `frontend/lib/assignment-helpers.ts` — Filter compliant workers, validate assignment

**Database:**
- `backend/prisma/migrations/{timestamp}-add-shift-assignment-fields.sql` — Add complianceSnapshot, workerConfirmation, workerNote columns
- `backend/prisma/migrations/{timestamp}-create-shift-requirements.sql` — Create ShiftRequirement table

### Patterns to Follow

- **Compliance check:** Use existing phase 5 `calculateComplianceScore()` function (same formula, same colors)
- **Bulk operations:** Follow Phase 6 bulk export pattern (batch query, error handling, rollback on failure)
- **Email templates:** Follow Phase 4 worker notification pattern (Resend, FailedAlert, retry loop)
- **API error handling:** Return structured errors (reason for skipped worker included in response)
- **Audit logging:** Every assignment/confirmation/decline action logged with action type, actor, entity
- **Role enforcement:** `requireRole(['OWNER','ADMIN'])` middleware on all assignment endpoints
- **Compliance snapshot:** Immutable JSON capture at assignment time (never updated)

---

## Canonical References

**Locked Requirements (MUST READ):**
- `.planning/phases/08-compliance-assignment/08-SPEC.md` — 10 requirements (R-SA-01 through R-SA-10)

**Project Context:**
- `.planning/PROJECT.md` — Core value: audit-ready for CQC
- `.planning/REQUIREMENTS.md` — Validation-level requirements

**Phase Dependencies:**
- `.planning/phases/07-shift-management/07-CONTEXT.md` — Shift infrastructure, ShiftAssignment model
- `.planning/phases/05-coordinator-dashboard/05-CONTEXT.md` — Compliance scoring formula
- `.planning/phases/06-audit-pack/06-CONTEXT.md` — Compliance snapshots (similar immutable pattern)

**Code References:**
- `backend/src/lib/compliance-service.js` — Phase 5 compliance calculation (reuse function)
- `backend/src/cronService.js` — Extend daily cron for re-validation
- `backend/src/lib/nodemailer.js` — Email template patterns
- `backend/src/lib/auth.js` — Role middleware (requireRole)
- `backend/prisma/schema.prisma` — Shift, ShiftAssignment, ComplianceDocument models

---

## Deferred Ideas

- **Push notifications** (SMS/in-app instead of email) — Phase 9
- **Shift swap/trade requests** (worker-initiated) — Phase 9
- **Automatic re-assignment on decline** — Phase 9
- **Compliance waiver system** (coordinator can override) — Phase 9
- **Mobile app for shift confirmation** — Phase 9
- **Calendar view of assigned shifts** (worker currently sees list only) — Phase 9
- **External scheduling system integration** (Workable, etc.) — Phase 10

---

## Risk & Assumptions

**Risk: Compliance snapshot staleness**
- **Assumption:** Re-validation cron job (daily 08:00) catches document expiries before shifts occur
- **Mitigation:** Coordinator receives "at-risk" alert; can remove assignment immediately
- **Fallback:** Phase 9 adds same-day re-validation for critical shifts

**Risk: Bulk assign timeout on large worker lists**
- **Assumption:** <500 workers per agency, bulk assign <100 workers per request
- **Mitigation:** Batch processing (25 at a time) with progress tracking
- **Monitoring:** Sentry logs timeout events

**Assumption: Compliance formula stable**
- **Assumption:** `(completed_required / total_required) * 100` doesn't change mid-phase
- **Mitigation:** Formula locked in Phase 5; reuse existing function
- **Future:** Move to backend API in Phase 9 if custom scoring added

---

## Success Criteria (Phase Verification)

- [ ] Coordinator can bulk-assign 10 workers to shift in <10 seconds
- [ ] Non-compliant worker is rejected with clear reason
- [ ] Worker receives assignment email within 1 minute
- [ ] Worker can confirm/decline shift in portal within 30 seconds
- [ ] All assignments logged to AuditLog (action, actor, timestamp)
- [ ] Compliance snapshot captured at assignment time and never mutated
- [ ] Re-validation cron marks at-risk assignments correctly
- [ ] Concurrent bulk assigns don't create duplicates (unique constraint enforced)
- [ ] Assignment status dashboard shows fill rates accurately
- [ ] Test coverage >80% on assignment logic, >70% overall

---

## Next Steps

Run `/gsd-plan-phase 8` to create the detailed implementation plan.

This CONTEXT.md captures:
- ✅ SPEC.md locked requirements (reference only)
- ✅ Architecture decisions (API, email, templates, snapshot)
- ✅ Code locations and reusable assets
- ✅ Canonical references (SPEC.md is primary)
- ✅ Deferred ideas (not scope creep, just future phases)
- ✅ Risks and assumptions

The planner will use this to break Phase 8 into concrete tasks.
