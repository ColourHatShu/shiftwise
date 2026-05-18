# Phase 7 Plan: Shift Management

**Estimate:** 16 hours (5 slices)

## Slices

### 1. Backend Shift Service + CRUD (4h)
- Shift model, ShiftApplication model, migrations
- Services: createShift, updateShift, deleteShift, getShifts
- API endpoints: POST/GET/PUT/DELETE /api/shifts

### 2. Shift Calendar UI (4h)
- Calendar component with month/week/day views
- Color-coded by role
- Create form, edit modal, delete confirmation

### 3. Worker Shift Browsing + Application (3h)
- Worker: view available shifts filtered by role/date/location
- Apply to shift button
- Application notifications

### 4. Shift Management Features (3h)
- Bulk CSV upload (100+ shifts)
- Cancellation + rescheduling
- History + analytics dashboard

### 5. Testing (2h)
- CRUD tests, calendar tests, application flow tests
- CSV parsing tests
- >80% coverage, 30+ test cases

---

5 commits. All 10 SPEC requirements met.
