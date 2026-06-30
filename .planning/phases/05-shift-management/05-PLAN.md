---
phase: 05-shift-management
plan: 01
type: execute
requirements:
  - SHIFT-01
  - SHIFT-02
  - SHIFT-03
  - SHIFT-04
---

# Phase 5 Plan — Shift Management

**Tasks:** 6  
**Duration (est.):** 2-3 hours

## Tasks

1. **A1** (auto): Prisma — Shift, WorkerAvailability, ShiftAssignment tables
2. **A2** (TDD): Shift CRUD endpoints — POST /api/shifts, GET /api/shifts, PATCH /api/shifts/:id
3. **A3** (auto): Worker availability endpoints — GET/POST /api/workers/:id/availability
3. **A4** (TDD): Shift assignment with compliance check — POST /api/shifts/:id/assign
4. **A5** (auto): Shift list UI + calendar + compliance report
5. **A6** (auto): Availability calendar UI (worker marks available/unavailable)

## Success Criteria

✓ Coordinator creates/edits shifts (date, facility, role, required count)  
✓ Worker marks availability calendar (available/unavailable/on leave)  
✓ Coordinator assigns worker; system flags if compliance incomplete  
✓ Compliance gap report visible in shift list UI

