# Phase 7 Context: Shift Management

**Goal:** Coordinators create + manage shifts. Workers see available shifts.

## Decisions

**Backend:**
- New endpoints: shifts CRUD, applications, notifications
- Shift model: facility, date, time, role, headcount, complianceReqs, status
- ShiftApplication model: worker, shift, status (applied/assigned/rejected)
- Notifications: extend Phase 4 email system

**Frontend:**
- Coordinator dashboard: shift calendar (month/week), create form, shift details modal
- Worker portal: shift list view, filter by date/role/location, apply button
- Calendar library: react-big-calendar or similar

**Database:**
- Shift table: id, agencyId, facility, date, startTime, endTime, role, requiredCount, complianceReqs (JSON), notes, status
- ShiftApplication table: id, shiftId, workerId, status, appliedAt, assignedAt

---

Ready for planning.
