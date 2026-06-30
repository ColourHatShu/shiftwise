# Phase 5 Context — Shift Management & Rota

**Phase:** 05 — Shift Management  
**Goal:** Track shifts, worker availability, and assignments. Flag compliance gaps.

## Decisions

1. **Shift Entity:** date, facility, role, requiredCount, status (OPEN|FILLED|CANCELLED)
2. **Availability:** WorkerAvailability table — worker marks available/unavailable per day
3. **Assignment:** ShiftAssignment (workerId, shiftId) with auto-compliance-check
4. **Compliance Flag:** Assign triggers check — missing docs (DBS, RTW) = flag, coordinator sees warning
5. **UI:** Shift list + availability calendar + compliance gap report

## Schema

**Shift:** id, agencyId, date, facility, role, requiredCount, filledCount, status, createdAt  
**WorkerAvailability:** id, workerId, date, status (AVAILABLE|UNAVAILABLE|ONLEAVE)  
**ShiftAssignment:** id, shiftId, workerId, complianceOK (boolean), createdAt

