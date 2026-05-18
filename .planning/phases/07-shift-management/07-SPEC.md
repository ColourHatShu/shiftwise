# Phase 7 Specification: Shift Management & Creation

**Goal:** Build a comprehensive shift management system for coordinators to create/manage shifts and for workers to browse/apply to shifts.

## 10 SPEC Requirements (R-SM-01 through R-SM-10)

### R-SM-01: Shift CRUD API
Backend endpoints for shift creation, retrieval, update, deletion:
- POST /api/shifts (create shift with validation)
- GET /api/shifts (list with filtering by date/role/facility)
- GET /api/shifts/:id (get single shift with assignments)
- PATCH /api/shifts/:id (update shift)
- DELETE /api/shifts/:id (delete shift)

### R-SM-02: Shift Assignment API
Backend endpoints for assigning workers to shifts with compliance checks:
- POST /api/shifts/:shiftId/assign (assign worker, check compliance)
- GET /api/shifts/:shiftId/assignments (list assignments)
- GET /api/shifts/:shiftId/assignments/:assignmentId (get assignment details)
- DELETE /api/shifts/:shiftId/assignments/:assignmentId (unassign worker)

### R-SM-03: Coordinator Shift Calendar UI
Frontend component for coordinators to manage shifts:
- Month/week/day calendar views
- Color-coded shifts by role
- Create shift modal with validation
- Edit shift modal
- Delete shift confirmation
- Drag-drop to reassign workers (optional)

### R-SM-04: Worker Shift Browsing UI
Frontend for workers to view available shifts:
- List available shifts filtered by role/date/location
- Search and filter controls
- Shift detail view with facility info, times, required headcount, role
- Apply to shift button with confirmation

### R-SM-05: Shift Application/Assignment Flow
Backend + frontend workflow:
- Workers can apply to shifts (creates ShiftApplication record)
- Coordinator can view pending applications
- Coordinator can approve/reject applications
- Automatic compliance check on assignment
- Email notification to worker on status change

### R-SM-06: CSV Bulk Upload
Feature to upload 100+ shifts at once:
- Parse CSV with columns: facility, date, time, endTime, role, requiredCount, notes
- Validate all rows before creating (transaction-safe)
- Show progress and results (succeeded, failed with reasons)
- Download template CSV

### R-SM-07: Shift Cancellation & Rescheduling
Operations on shifts:
- Cancel shift (mark status=CANCELLED, notify assigned workers)
- Reschedule shift (change date/time, notify affected workers)
- Track audit trail for cancellations/changes

### R-SM-08: Shift Analytics Dashboard
Coordinator dashboard showing:
- Total shifts this month/week
- Filled vs. open positions
- Compliance gaps by shift
- Worker availability heatmap
- Cancellation trends

### R-SM-09: Shift Compliance Integration
Compliance checks for shift assignments:
- Auto-check required documents before assignment
- Flag missing/expired docs
- Allow override with coordinator notes
- Log assignment + compliance status to audit trail

### R-SM-10: Comprehensive Testing
Test coverage >80% across all shift-related code:
- Backend CRUD unit tests (shifts, assignments)
- CSV parsing tests
- Compliance check tests
- Frontend component tests (calendar, worker list)
- E2E flow tests (create shift → assign worker → email notification)
- At least 30 test cases total

## Success Criteria

All 10 requirements implemented and working:
- [x] R-SM-01: Shift CRUD API
- [x] R-SM-02: Shift Assignment API
- [ ] R-SM-03: Coordinator Shift Calendar UI
- [ ] R-SM-04: Worker Shift Browsing UI
- [ ] R-SM-05: Shift Application/Assignment Flow
- [ ] R-SM-06: CSV Bulk Upload
- [ ] R-SM-07: Shift Cancellation & Rescheduling
- [ ] R-SM-08: Shift Analytics Dashboard
- [ ] R-SM-09: Shift Compliance Integration
- [ ] R-SM-10: Comprehensive Testing

## Test Coverage Target

- Backend: >85% lines covered
- Frontend: >80% component coverage
- Total: >30 test cases
- All critical paths (happy path + error cases) covered
