# ShiftWise API — operational insight & matching endpoints

Reference for the read/insight endpoints added in the 2026-07 autonomous-Knight
session (worker reliability, shift coverage, the expiring-documents worklist, and
the rule-based shift-matcher). All are **agency-scoped** (results are limited to
the caller's agency) and require a coordinator **Clerk bearer token**:

```
Authorization: Bearer <clerk-token>
```

Unless noted, auth is `requireAgency` (any signed-in coordinator of the agency).
Errors follow the app convention: `4xx`/`500` with `{ "error": "message" }`.

---

## GET /api/shift-coverage
Upcoming shifts and how fully they're staffed (by **confirmed** workers). Sorted
by `shiftDate` ascending.

**Response**
```jsonc
{
  "data": [
    {
      "shiftId": "…",
      "facilityName": "St Mary Hospital",
      "shiftDate": "2026-07-10",
      "role": "Nurse",
      "requiredCount": 3,
      "assignedCount": 2,
      "confirmedCount": 1,
      "shortfall": 2,              // max(requiredCount - confirmedCount, 0)
      "status": "understaffed"     // "filled" | "understaffed" | "unfilled"
    }
  ],
  "summary": { "totalUpcoming": 12, "needingAttention": 4 }  // needingAttention = shortfall > 0
}
```
`status`: `filled` when `confirmedCount >= requiredCount`; `unfilled` when
`confirmedCount === 0`; otherwise `understaffed`.

---

## GET /api/worker-scorecards
Reliability scorecard for every worker in the agency, derived from their
shift-assignment confirmation history.

**Response**
```jsonc
{
  "data": [
    {
      "workerId": "…",
      "firstName": "Jane",
      "lastName": "Doe",
      "totalAssignments": 10,
      "confirmed": 8,
      "declined": 2,
      "pending": 0,
      "confirmationRate": 80       // round(confirmed / (confirmed + declined) * 100); null if none responded
    }
  ]
}
```

## GET /api/worker-scorecards/:workerId
The same scorecard for a single worker. `404` if the worker is not in the agency.

**Response**: `{ "data": { …same fields as above… } }`

---

## GET /api/expiring-documents
The core-promise worklist: a flat, urgency-sorted list of **active** workers'
compliance documents that are already overdue or expiring within the window.
Sorted by `expiryDate` ascending (most overdue first).

**Query**: `days` — window in days, default `30`, clamped `1..365`.

**Response**
```jsonc
{
  "data": [
    {
      "documentId": "…",
      "workerId": "…",
      "workerName": "Jane Doe",
      "documentType": "DBS Check",
      "expiryDate": "2026-06-28T00:00:00.000Z",
      "daysUntilExpiry": -3,       // negative = overdue
      "overdue": true,
      "status": "APPROVED"
    }
  ],
  "summary": { "total": 5, "overdue": 2, "windowDays": 30 }
}
```
Note: includes **already-expired** docs (an overdue doc is an active compliance
breach), unlike the future-only, worker-grouped `GET /api/reports/expiring`.

---

## GET /api/shifts/:shiftId/suggested-workers
Rule-based **shift-matcher**: the top compliant candidates for a shift, ranked by
the documented default. Auth: `requireRole(['OWNER','ADMIN'])`. `404` if the shift
is not in the agency.

**Query**: `limit` — number of suggestions, default `5`, clamped `1..20`.

**Response**
```jsonc
{
  "data": [
    {
      "rank": 1,
      "id": "…",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "complianceScore": 100,
      "confirmationRate": 92        // null if no history
    }
  ],
  "meta": {
    "compliantCandidates": 7,
    "scanned": 120,                 // active, not-yet-assigned candidates considered
    "scanCapped": false,            // true if the candidate scan hit its 200 cap
    "ranking": "confirmationRate desc (no-history last), then complianceScore desc"
  }
}
```
**Ranking** lives in `backend/src/lib/rank-suggested-workers.js` (`rankSuggestedWorkers`) —
the single place to tune weights or layer in distance/skills/rotation. Only
fully-compliant candidates are returned; compliance is validated per-shift via the
batched `validateComplianceForWorkers`.
