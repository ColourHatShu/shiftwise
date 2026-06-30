# Phase 7 SPEC: Shift Management & Creation

**Goal:** Coordinators post shifts at care facilities. By end: create shifts (date, time, location, role, headcount), view shift calendar, manage shift details. Workers see available shifts.

---

## Requirements

### R-SM-01: Shift Creation Form
- Coordinator creates shift: facility name, date, start/end time, role (Nurse/Carer/Support), required headcount, notes
- Acceptance: [ ] Form saves shift to DB, [ ] validation on all fields, [ ] shifts appear in calendar

### R-SM-02: Shift Calendar View
- Calendar showing all agency shifts (month/week/day view)
- Color-coded by role (blue=nurse, green=carer, orange=support)
- Click to edit/delete
- Acceptance: [ ] Month view works, [ ] shifts color-coded, [ ] click to edit works

### R-SM-03: Shift Details Page
- Full shift info: facility, date/time, role, required count, assigned workers, notes
- Edit/delete buttons
- Show assigned workers + their compliance status
- Acceptance: [ ] Details page loads, [ ] edit/delete work, [ ] shows compliance status

### R-SM-04: Compliance Requirements per Shift
- Coordinator specifies which docs must be current for a shift (e.g., "DBS required, RtW required")
- Override defaults per shift
- Acceptance: [ ] Compliance requirements configurable, [ ] enforced on assignment

### R-SM-05: Shift Listing for Workers
- Worker sees available shifts matching their role + compliance status
- Filtered by date, location, role
- Apply to shift (with confirmation)
- Acceptance: [ ] Workers see available shifts, [ ] can apply, [ ] filters work

### R-SM-06: Shift Notifications
- Coordinator gets notified when worker applies to shift
- Worker gets notified when assigned to shift
- Acceptance: [ ] Coordinator sees applications, [ ] worker gets assignment email

### R-SM-07: Bulk Shift Creation
- Coordinator uploads CSV with multiple shifts (dates, times, facilities, roles, headcounts)
- System creates all shifts in one action
- Acceptance: [ ] CSV upload works, [ ] all shifts created, [ ] error report for invalid rows

### R-SM-08: Shift Cancellation & Rescheduling
- Cancel shift (all workers notified, history preserved)
- Reschedule shift (auto-reassess worker compliance, notify if new issues)
- Acceptance: [ ] Cancellation works, [ ] rescheduling works, [ ] audit trail logged

### R-SM-09: Shift History & Analytics
- View past shifts + attendance rates per worker
- Dashboard showing shifts filled/unfilled
- Acceptance: [ ] Past shifts viewable, [ ] attendance tracked, [ ] analytics show

### R-SM-10: API for Shift Management
- RESTful endpoints for shift CRUD (covered by coordinator UI, but also available for integrations)
- Acceptance: [ ] CRUD endpoints functional, [ ] proper auth + role checks

---

## Boundaries

**In Scope:**
- Shift creation, calendar, details, edit/delete
- Compliance requirements per shift
- Worker shift browsing + application
- Notifications (coordinator + worker)
- Bulk CSV upload
- Cancellation + rescheduling
- History + basic analytics
- API endpoints

**Out of Scope (Phase 8+):**
- Actual shift assignment (Phase 8)
- Automatic shift matching algorithm
- Shift swaps between workers
- Payroll integration
- Real-time shift availability

---

## Acceptance

- [ ] All 10 requirements satisfied
- [ ] Shifts fully functional in coordinator + worker views
- [ ] Compliance requirements enforced
- [ ] Notifications working
- [ ] Bulk upload handles 100+ shifts
- [ ] History + analytics functional

---

Ambiguity: 0.18 → GATE PASSED

*SPEC locked.*
