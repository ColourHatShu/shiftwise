---
phase: 05-coordinator-dashboard
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/routes/compliance.js
  - backend/src/lib/compliance-service.js
  - frontend/app/dashboard/compliance/page.tsx
  - frontend/lib/compliance-dashboard.ts
autonomous: true
requirements:
  - R-CD-01
  - R-CD-02
  - R-CD-03
  - R-CD-04
  - R-CD-05
  - R-CD-06
  - R-CD-07
  - R-CD-08
  - R-CD-09
  - R-CD-10
user_setup: []

must_haves:
  truths:
    - Coordinator sees all agency workers with live compliance scores (0-100%)
    - Coordinator can filter workers by compliance status (red/yellow/green), name, and sort results
    - Dashboard shows active alerts (expiring docs, expired docs, non-compliant workers)
    - Coordinator can export compliance data as CSV or PDF
    - Compliance scores match Phase 4 worker portal calculation
    - Quick-action modal allows coordinator to approve/reject documents and deactivate workers
    - All coordinator actions (approve/reject/deactivate) log to AuditLog
    - Dashboard loads sub-2 seconds with 200 workers (no N+1 queries)
    - Dashboard is responsive on tablet (iPad) and mobile
    - Clear error messages for common failures (export timeout, permission denied, stale data)
  artifacts:
    - path: backend/src/routes/compliance.js
      provides: API endpoints for workers list, export, alerts
      exports: ["GET /api/agency/compliance/workers", "POST /api/agency/compliance/export", "GET /api/agency/compliance/alerts"]
    - path: backend/src/lib/compliance-service.js
      provides: Compliance score calculation, CSV/PDF generation, alert aggregation
      exports: ["calculateScore", "generateCSV", "generatePDF", "aggregateAlerts"]
    - path: frontend/app/dashboard/compliance/page.tsx
      provides: Main compliance dashboard UI with list, filters, alerts, export
      min_lines: 250
    - path: frontend/lib/compliance-dashboard.ts
      provides: Helper functions for filtering, sorting, formatting compliance data
      exports: ["filterWorkers", "sortWorkers", "getStatusColor", "formatScore"]
    - path: backend/prisma/schema.prisma
      provides: Index on (agencyId, status) for fast filtering
      contains: "@@index([agencyId, status])"
  key_links:
    - from: frontend/app/dashboard/compliance/page.tsx
      to: backend/src/routes/compliance.js
      via: fetch to /api/agency/compliance/workers
      pattern: "fetch.*api/agency/compliance/workers"
    - from: backend/src/routes/compliance.js
      to: backend/src/lib/compliance-service.js
      via: import calculateScore, generateCSV, aggregateAlerts
      pattern: "require.*compliance-service"
    - from: backend/src/routes/compliance.js
      to: prisma.worker + prisma.complianceDocument
      via: aggregation query for score calculation
      pattern: "prisma\\.worker\\.findMany|aggregateMany"
    - from: frontend/app/dashboard/compliance/page.tsx
      to: frontend/lib/compliance-dashboard.ts
      via: import filterWorkers, sortWorkers, getStatusColor
      pattern: "import.*from.*compliance-dashboard"
    - from: backend/src/routes/compliance.js
      to: prisma.auditLog
      via: log all approve/reject/deactivate actions
      pattern: "prisma\\.auditLog\\.create"

---

<objective>
Provide coordinators with complete agency-wide compliance visibility: all workers with live compliance scores, filterable by status/name, active alerts, and one-click compliance export.

Purpose: Coordinators need a single dashboard to monitor all workers' compliance status, identify at-risk workers (expiring docs, non-compliant), and export reports without manual effort.

Output: Backend API + compliance scoring service + responsive React dashboard (desktop/tablet/mobile).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/05-SPEC.md
@.planning/phases/05-coordinator-dashboard/05-CONTEXT.md
</execution_context>

<context>
Key codebase patterns from Phase 1–4:

**Backend Routes:**
- `requireAgency` middleware scopes all queries to current agency (multi-tenant isolation)
- `requireRole(['OWNER', 'ADMIN'])` enforces authorization on sensitive endpoints
- Audit log created transactionally for all state-changing operations
- Error responses return 400 (validation), 403 (permission), 500 (server error)

**Frontend Components:**
- Use Clerk `useAuth()` to get JWT token for API calls
- Pagination: 20 items per page with page selector
- Search debounced with 500ms timeout to avoid excessive API calls
- Status dropdown values: "ACTIVE", "INACTIVE", "SUSPENDED"
- Compliance score badges use Tailwind colors: red (0-40%), yellow (41-80%), green (81-100%)

**Compliance Calculation (Phase 4):**
- Formula: `(completed_required / total_required) * 100`
- `completed_required` = count of documents with `status === 'APPROVED'`
- `total_required` = count of document types with `isRequired === true` for the agency
- Score rounded to nearest integer

**Database Indexes (Phase 1):**
- Worker lookups scoped by `(agencyId, status)` for fast filtering
- AuditLog includes `userId`, `agencyId`, `action`, `entity`, `entityId`, `metadata`

**CSS Framework:**
- Tailwind CSS v3, no CSS modules
- Responsive breakpoints: mobile <768px, tablet 768-1023px, desktop ≥1024px
- Buttons: `btn`, `btn-primary`, `btn-secondary` — check existing dashboard for exact classes

**Existing Frontend Patterns:**
- Worker list page at `frontend/app/dashboard/workers/page.tsx` shows workers with pagination, search, status filter
- Reuse components: EditWorkerModal pattern for quick actions, search input with debounce
- Use lucide-react icons: Download (export), Filter, Search, Plus, X (close modal)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend API endpoints + compliance scoring service (3 hours)</name>
  <files>
    backend/src/routes/compliance.js
    backend/src/lib/compliance-service.js
    backend/prisma/schema.prisma
  </files>
  <action>
Create backend compliance route and service layer.

**File: backend/src/lib/compliance-service.js**
Export functions:
- `calculateScore(workerId, agencyId)` — Returns integer 0–100. Query agency's required document types, count approved documents for worker, return (approved/required)*100 rounded.
- `aggregateAlerts(agencyId)` — Returns array of 3-5 alert objects: {type: 'expiring_soon'|'expired'|'non_compliant', count: number, workerIds: string[]}. Query expiryAlerts joined with workers, group by status. Use 3-7 days as "expiring soon" threshold.
- `generateCSV(workers, agencyId)` — Takes array of worker objects with scores, returns CSV string with columns: name, email, score, required_docs_completed, last_updated. Include BOM for Excel compatibility.
- `generatePDF(workers, agencyName, generatedDate)` — Returns Buffer. Use existing PDF generation pattern from Phase 3 reports route. Include agency name, date, table of all workers + scores.

**File: backend/src/routes/compliance.js**
Create new Express router with these endpoints:

- `GET /api/agency/compliance/workers` (requireAgency middleware required)
  * Query params: page (default 1), limit (default 20), search (optional), status (optional: RED|YELLOW|GREEN), sortBy (optional: score|name|updated), sortDir (optional: asc|desc)
  * Permission: OWNER/ADMIN only (requireRole check)
  * Returns: { workers: [{id, firstName, lastName, email, jobTitle, status, score, required_docs_completed, last_updated, color_code}], pagination: {page, limit, total, totalPages}, cacheAge: seconds }
  * Query: Single aggregation query (no N+1) — use Prisma `findMany` with `include` for complianceDocuments, count APPROVED documents per worker, calculate score in memory
  * Caching: Memoize result in memory for 60 seconds using a simple cache object (key = agencyId + query hash), return `cacheAge` in response
  * Error: Return 403 if non-OWNER/ADMIN, 400 for invalid params, 500 with Sentry capture

- `POST /api/agency/compliance/export` (requireAgency, requireRole)
  * Body: {format: 'csv'|'pdf', filters?: {search?, status?, sortBy?, sortDir?}}
  * Returns for CSV: { downloadUrl: 'data:text/csv;base64,...', fileName: 'compliance-report-2026-05-18.csv' }
  * Returns for PDF: { downloadUrl: 'data:application/pdf;base64,...', fileName: 'compliance-report-2026-05-18.pdf' }
  * Large exports (500+ rows): Wrap in try-catch, if generation takes >5s add progress indicator support (optional v1 — return 202 Accepted with status endpoint)
  * Log action to AuditLog: {action: 'compliance.export', entity: 'Agency', entityId: agencyId, metadata: {format, rowCount}}

- `GET /api/agency/compliance/alerts` (requireAgency, requireRole)
  * No query params required
  * Returns: { alerts: [{type, count, message, example_workers: [{id, firstName, lastName}]}], total_alerts: number, last_updated: ISO string }
  * Example alert: {type: 'expiring_soon', count: 12, message: '12 workers have documents expiring in 3-7 days', example_workers: [...]}

**File: backend/prisma/schema.prisma**
Add index on Worker model (if not present):
  @@index([agencyId, status])

**Compliance Score Color Mapping (frontend consumes):**
- RED: score 0-40 (non-compliant)
- YELLOW: score 41-80 (expiring soon or partial)
- GREEN: score 81-100 (compliant)

**API Error Handling:**
- 400: Invalid pagination, invalid status filter, invalid sortBy
- 403: Non-OWNER/ADMIN attempts to access
- 500: Database error, PDF generation failure — log to Sentry with agencyId tag

**Compliance Score Consistency (R-CD-05):**
Verify formula matches Phase 4: (completed_required / total_required) * 100
- completed_required = count of ComplianceDocument where (status='APPROVED' AND documentType.isRequired=true)
- total_required = count of DocumentType where (isRequired=true AND agencyId=req.agencyId)
- Unit test will compare dashboard score vs worker portal score for same worker
  </action>
  <verify>
    <automated>
      1. npm run test -- backend/src/lib/compliance-service.test.js (tests for calculateScore, generateCSV, generatePDF, aggregateAlerts)
      2. curl -H "Authorization: Bearer {valid-jwt}" http://localhost:3001/api/agency/compliance/workers (returns 200 with workers array)
      3. curl -H "Authorization: Bearer {invalid-jwt}" http://localhost:3001/api/agency/compliance/workers (returns 403)
      4. Database: SELECT COUNT(*) FROM audit_logs WHERE action LIKE 'compliance.export' (verify export actions logged)
    </automated>
  </verify>
  <done>
    - GET /api/agency/compliance/workers endpoint returns all agency workers with scores, filtered/sorted, 60s cache active
    - POST /api/agency/compliance/export returns CSV/PDF as base64-encoded download
    - GET /api/agency/compliance/alerts returns alert summary for expiring, expired, non-compliant workers
    - Compliance scores match Phase 4 formula (unit test passes)
    - All export/approve/reject actions logged to AuditLog with agencyId + userId
    - No N+1 queries (single aggregation query per request)
    - Error handling: 400 (validation), 403 (permission), 500 (server error) with Sentry capture
  </done>
</task>

<task type="auto">
  <name>Task 2: Dashboard list UI + filter/sort panel (3 hours)</name>
  <files>
    frontend/app/dashboard/compliance/page.tsx
    frontend/lib/compliance-dashboard.ts
  </files>
  <action>
Create responsive React dashboard page and helper library.

**File: frontend/lib/compliance-dashboard.ts**
Export utility functions consumed by the dashboard:
- `filterWorkers(workers, search, status)` — Returns filtered array. Search matches firstName, lastName, email (case-insensitive). Status matches 'RED', 'YELLOW', 'GREEN' based on score. Return all workers if no filters.
- `sortWorkers(workers, sortBy, sortDir)` — Returns sorted array. sortBy: 'score'|'name'|'updated'. sortDir: 'asc'|'desc'. Default: score desc (highest first).
- `getStatusColor(score)` — Returns 'red'|'yellow'|'green' based on score bands (0-40: red, 41-80: yellow, 81-100: green).
- `formatScore(score)` — Returns string with % (e.g., "85%").
- `getComplianceBadgeClass(status)` — Returns Tailwind class string for status badge (e.g., "bg-red-100 text-red-800").

**File: frontend/app/dashboard/compliance/page.tsx**
"use client" component.

Structure:
1. **Header** — Title "Compliance Dashboard", "Export" buttons (CSV/PDF), "Refresh" icon
2. **Filter Panel** — Inline horizontal layout (desktop), collapsible (mobile <768px)
   - Search input: "Search workers..." placeholder, debounced 500ms, case-insensitive on first/last name
   - Status dropdown: "All / Red (Non-Compliant) / Yellow (Expiring Soon) / Green (Compliant)"
   - Sort dropdown: "Sort by Score (High→Low) / Name (A→Z) / Last Updated (Newest)"
   - Filter button (mobile only) to toggle filter panel visibility
3. **Active Alerts Section** — Shows 3-5 most urgent alerts with counts and clickable alerts
   - Example: "12 workers have docs expiring in 3-7 days" — clicking filters to RED|YELLOW status
4. **Workers List Table** (desktop) or **Card List** (mobile/tablet)
   - Columns (desktop): Name | Email | Compliance Score (with color badge) | Docs Completed | Last Updated | Actions
   - Card layout (mobile): Worker name, score badge, quick actions (View, Approve, Deactivate)
   - Pagination: 20 per page, page selector at bottom
   - On row click → open worker detail modal (Task 3)
5. **Responsive Breakpoints:**
   - Desktop ≥1024px: side-by-side filters + full table with all columns
   - Tablet 768–1023px: stacked filters above list, table with condensed columns
   - Mobile <768px: full-width cards, filters collapsible, single action button opens modal

**State & Data Fetching:**
- useState: workers, searchQuery, selectedStatus, sortBy, sortDir, page, loading, error, alerts, cacheAge
- useEffect: fetch workers on mount + when filters/sort change
- Fetch URL: `/api/agency/compliance/workers?page={page}&search={searchQuery}&status={statusFilter}&sortBy={sortBy}&sortDir={sortDir}`
- Debounce search input (500ms) to avoid excessive API calls
- Maintain query params in URL for shareability (per R-CD-02)
- Display `cacheAge` in subtle text: "Data last updated {cacheAge}s ago"

**CSS Classes:**
- Use Tailwind: `container`, `mx-auto`, `px-4` for padding
- Buttons: `btn`, `btn-primary`, `btn-secondary` (reuse from worker list)
- Table: `table`, `table-striped`, `table-hover` (check existing dashboard for exact classes)
- Badges: `badge`, `badge-red`, `badge-yellow`, `badge-green`
- Modal trigger: onclick handler sets state + renders modal component

**Error Handling:**
- Network error: Show toast "Failed to load workers. Retrying..."
- Permission denied (403): Show alert "You don't have permission to view this page"
- Stale data warning: If cacheAge > 300s, show subtle banner "Data last updated 5 minutes ago. [Refresh]"

**Export Buttons (Task 1 integration):**
- "Export as CSV" button: POST /api/agency/compliance/export with {format: 'csv', filters: {search, status, sortBy, sortDir}}, get base64 download, trigger browser download
- "Export as PDF" button: Same, format: 'pdf'
- While exporting: Show loading spinner "Exporting..."
- On error: Show toast "Export failed. Retrying..."
  </action>
  <verify>
    <automated>
      1. npm run build (Next.js build succeeds, no TypeScript errors)
      2. npm run test -- frontend/lib/compliance-dashboard.test.ts (utility function tests)
      3. Manual: Visit http://localhost:3000/app/dashboard/compliance (page loads, shows workers list)
      4. Manual: Type in search box, verify debounce works (no multiple API calls per keystroke)
      5. Manual: Change status dropdown, verify list filters to matching workers
      6. Manual: Click "Export as CSV", verify file downloads with correct filename
      7. Responsive: Resize browser to 768px width, verify filters stack above list
      8. Responsive: Resize to <768px, verify cards display instead of table, filters collapsible
    </automated>
  </verify>
  <done>
    - Dashboard page at /app/dashboard/compliance loads with workers list, filters, alerts
    - Search box filters by first/last name (case-insensitive, debounced)
    - Status dropdown filters to RED/YELLOW/GREEN (0-40%, 41-80%, 81-100%)
    - Sort dropdown sorts by score/name/updated with asc/desc
    - Pagination works (20 per page, page selector)
    - Filters persist in URL query params (shareable links)
    - Active alerts section shows 3-5 most urgent alerts with counts
    - Export buttons trigger CSV/PDF download
    - Responsive: desktop (full table) > tablet (condensed) > mobile (cards with collapsible filters)
    - No horizontal scrolling on any viewport
    - Error messages clear and actionable
  </done>
</task>

<task type="auto">
  <name>Task 3: Quick-action modal + worker profile + document approval (3 hours)</name>
  <files>
    frontend/app/dashboard/compliance/components/WorkerDetailModal.tsx
    backend/src/routes/workers.js (add routes if missing)
  </files>
  <action>
Create modal component for quick coordinator actions on workers.

**File: frontend/app/dashboard/compliance/components/WorkerDetailModal.tsx**
New React component:

Structure:
1. **Modal Header** — Worker name, close button (X)
2. **Worker Profile Section** — Read-only info
   - Name, Email, Phone, Job Title, Status (ACTIVE/INACTIVE/SUSPENDED badge)
   - Last Updated timestamp
3. **Pending Documents Section** — Table of documents awaiting approval
   - Columns: Document Type | Status (PENDING) | Upload Date | Actions (Approve / Reject)
   - Click "Approve" → mark document as APPROVED, update worker compliance score, log to AuditLog, reload list
   - Click "Reject" → show rejection reason input field, submit, log to AuditLog
4. **Worker Actions Section** — Quick actions
   - "Deactivate Worker" button (if status = ACTIVE) — shows confirmation dialog, calls PATCH /api/workers/{id}/status with {status: 'INACTIVE'}, logs to AuditLog
   - "Reactivate Worker" button (if status = INACTIVE) — same pattern
   - "View Full Profile" link → navigates to /app/dashboard/workers/{id}
5. **Modal Footer** — Close button, Save changes indicator

**Props:**
- workerId: string
- onClose: () => void
- onUpdate: () => void (callback to refresh parent list)

**State & Data Fetching:**
- useState: worker, documents, loading, error, submitting, showRejectReason
- useEffect: fetch worker detail + pending documents on mount
- Fetch: GET /api/workers/{id} + filter documents with status='PENDING'

**Approval Flow:**
- User clicks "Approve" on a document
- POST /api/documents/{id}/approve with {}, show "Approving..." spinner
- On success: update local state, show toast "Document approved", reload documents list
- On error: show error toast with message

**Rejection Flow:**
- User clicks "Reject" on a document
- Show input field for rejection reason (required)
- POST /api/documents/{id}/reject with {rejectionReason: string}
- On success: hide reason input, update documents list
- On error: show error toast

**Deactivate Flow:**
- User clicks "Deactivate Worker"
- Show confirmation dialog: "Are you sure? This worker will be marked INACTIVE and cannot be assigned to shifts."
- On confirm: PATCH /api/workers/{id}/status with {status: 'INACTIVE'}
- Callback onUpdate() to refresh parent list
- Close modal

**API Endpoints Used (backend must provide):**
- GET /api/workers/{id} — returns worker object with status, email, phone, jobTitle
- GET /api/workers/{id}/documents — returns array of ComplianceDocument objects (PENDING status)
- POST /api/documents/{id}/approve — marks document as APPROVED, updates compliance score
- POST /api/documents/{id}/reject — marks document as REJECTED, stores rejectionReason
- PATCH /api/workers/{id}/status — updates worker status to ACTIVE/INACTIVE/SUSPENDED

All endpoints require requireAgency + requireRole(['OWNER', 'ADMIN']) middleware.

**CSS:**
- Modal overlay: Tailwind `fixed inset-0 bg-black/50 flex items-center justify-center`
- Modal box: `bg-white rounded-lg p-6 max-w-md w-full`
- Buttons: Primary (approve/save) vs secondary (reject/cancel)
- Loading spinner: reuse from existing components
  </action>
  <verify>
    <automated>
      1. npm run build (TypeScript compiles, no errors)
      2. Manual: Click worker row in dashboard, modal opens with worker details
      3. Manual: Click "Approve" on a pending document, verify POST sent to /api/documents/{id}/approve
      4. Manual: Check AuditLog that approve action logged with userId + documentId
      5. Manual: Refresh dashboard, verify compliance score updated for worker
      6. Manual: Click "Reject", enter reason, submit, verify POST sent + AuditLog entry created
      7. Manual: Click "Deactivate Worker", confirm, verify PATCH sent + worker status changed in list
      8. Manual: Verify modal closes and parent list refreshes after each action
    </automated>
  </verify>
  <done>
    - WorkerDetailModal component opens on worker row click
    - Displays worker profile: name, email, phone, job title, status
    - Shows pending documents with Approve/Reject buttons
    - Approve action: POST to endpoint, logs to AuditLog, updates score, refreshes list
    - Reject action: requires reason field, logs rejection, refreshes list
    - Deactivate: shows confirmation, updates worker status to INACTIVE, logs to AuditLog
    - Modal closes cleanly after actions, parent list refreshes
    - All actions trigger AuditLog entries with userId + action type
  </done>
</task>

<task type="auto">
  <name>Task 4: Testing + performance optimization (2 hours)</name>
  <files>
    backend/tests/compliance-service.test.js
    backend/tests/compliance-routes.test.js
    frontend/lib/compliance-dashboard.test.ts
    frontend/app/dashboard/compliance/__tests__/page.test.tsx
  </files>
  <action>
Write comprehensive tests ensuring all requirements met and no performance regressions.

**File: backend/tests/compliance-service.test.js**
Unit tests for compliance-service.js:

- `calculateScore()` — 
  * Test 1: Worker with 4/5 required docs approved = 80%
  * Test 2: Worker with 0 required docs = 0%
  * Test 3: Worker with 8/8 required docs = 100%
  * Test 4: Score rounds to nearest integer
  * Test 5: Score for different agency isolated (multi-tenant sanity check)

- `aggregateAlerts()` —
  * Test 1: Returns alert for 12 workers expiring 3-7 days (type: 'expiring_soon')
  * Test 2: Returns alert for 5 workers with expired docs (type: 'expired')
  * Test 3: Returns alert for 8 non-compliant workers (score <50%, type: 'non_compliant')
  * Test 4: Alerts aggregated per agency (multi-tenant)

- `generateCSV()` —
  * Test 1: Returns string with correct headers (name, email, score, docs, updated)
  * Test 2: CSV contains all workers
  * Test 3: Scores in CSV match input objects

- `generatePDF()` —
  * Test 1: Returns Buffer object
  * Test 2: PDF contains agency name
  * Test 3: PDF contains all worker names and scores

**File: backend/tests/compliance-routes.test.js**
Integration tests for compliance.js routes:

- `GET /api/agency/compliance/workers` —
  * Test 1: OWNER role succeeds, returns 200 with workers array
  * Test 2: STAFF role gets 403 (permission denied)
  * Test 3: No auth token gets 401
  * Test 4: Filter by status=RED returns only workers with score 0-40
  * Test 5: Search query filters by firstName/lastName
  * Test 6: Pagination works (page 1 returns first 20, page 2 returns next 20)
  * Test 7: Response time <2s with 200 workers (performance gate)
  * Test 8: Cache-Age header present in response

- `POST /api/agency/compliance/export` —
  * Test 1: CSV export succeeds, returns base64 string with filename
  * Test 2: PDF export succeeds, returns base64 string with filename
  * Test 3: Export logged to AuditLog with action='compliance.export'
  * Test 4: Large export (500+ rows) completes without timeout
  * Test 5: Invalid format parameter returns 400

- `GET /api/agency/compliance/alerts` —
  * Test 1: Returns array of alert objects
  * Test 2: Alert counts match actual expiring/expired/non-compliant workers
  * Test 3: Multi-agency isolation (alerts scoped to requesting agency)

**File: frontend/lib/compliance-dashboard.test.ts**
Unit tests for utility functions:

- `filterWorkers()` —
  * Test 1: Returns all workers when no filters
  * Test 2: Search filters to matching firstName (case-insensitive)
  * Test 3: Status='RED' filters to score 0-40%
  * Test 4: Combining search + status filters correctly

- `sortWorkers()` —
  * Test 1: Sort by score descending (highest first)
  * Test 2: Sort by name ascending (A→Z)
  * Test 3: Sort by updated descending (newest first)

- `getStatusColor()` —
  * Test 1: score 0-40 returns 'red'
  * Test 2: score 41-80 returns 'yellow'
  * Test 3: score 81-100 returns 'green'

**File: frontend/app/dashboard/compliance/__tests__/page.test.tsx**
Component tests (React Testing Library):

- Page loads and shows compliance dashboard
- Search input debounces correctly (no API call for first keystroke, calls on 500ms timeout)
- Status dropdown filters list
- Export button triggers CSV download
- Worker row click opens modal
- API error shows error message to user

**Performance Testing:**
- Load test: Measure dashboard response time with 200 workers, assert <2s (R-CD-08 gate)
- N+1 check: Use database query logger, verify only 1 query to fetch workers + scores (not N+1)
- Cache test: Call GET /api/agency/compliance/workers twice, verify second call uses cache (faster)

**Test Commands:**
- npm run test -- backend/tests/compliance-service.test.js
- npm run test -- backend/tests/compliance-routes.test.js
- npm run test -- frontend/lib/compliance-dashboard.test.ts
- npm run test -- frontend/app/dashboard/compliance/__tests__/page.test.tsx
- npm run test:performance — custom perf suite for <2s load gate
  </action>
  <verify>
    <automated>
      1. npm run test (all test suites pass, >80% coverage)
      2. npm run test:performance (dashboard loads <2s with 200 workers)
      3. npm run build (no warnings or errors)
      4. Database query audit: grep backend logs for N+1 patterns (should be zero)
      5. npm run lint (all code passes linting)
    </automated>
  </verify>
  <done>
    - All 10 requirements covered by tests (R-CD-01 through R-CD-10)
    - Unit tests for compliance service (score calculation, export, alerts)
    - Integration tests for all 3 API endpoints (workers, export, alerts)
    - Component tests for dashboard UI and modal
    - Performance test: dashboard loads <2s with 200 workers
    - N+1 query audit: single aggregation query confirmed
    - Test coverage >80% for Phase 5 code
    - All tests passing
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Frontend → Backend API | Coordinator submits search queries, filter criteria, export requests over HTTPS |
| Backend → Database | Worker data, compliance documents, audit logs queried by authenticated backend |
| Coordinator Browser → Worker Data | Compliance scores and document metadata exposed to coordinator (not to worker) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-CD-01 | Spoofing | Coordinator API access | mitigate | `requireRole(['OWNER', 'ADMIN'])` enforced on all endpoints (R-CD-06, R-CD-08). Clerk JWT verified in auth middleware. |
| T-CD-02 | Tampering | Export file modification | mitigate | CSV/PDF generated server-side, no client-side template injection. File hash not exposed to prevent replay. |
| T-CD-03 | Repudiation | Approval/rejection audit trail | mitigate | All document approvals logged to AuditLog with userId, documentId, timestamp, action type (R-CD-07). Non-repudiation via immutable log. |
| T-CD-04 | Information Disclosure | Cross-agency data leak | mitigate | `agencyId` scoped on all queries (requireAgency middleware). Export filtered by requesting agency. SQL injection prevented via Prisma parameterized queries. |
| T-CD-05 | Denial of Service | Large export timeout | mitigate | Export generation wrapped in try-catch, returns 202 Accepted for large exports (500+ rows). Optional progress endpoint (v2). Rate limiting applied to /api/agency/compliance/* (R-CD-10). |
| T-CD-06 | Elevation of Privilege | STAFF approving documents | mitigate | `requireRole(['OWNER', 'ADMIN'])` on document approval endpoints. STAFF role gets 403. Non-compliance logs to Sentry. |

</threat_model>

<verification>
**Phase 5 Acceptance Gate — All 10 Requirements:**

1. ✅ **R-CD-01:** All-workers list loads <2s, shows name/score/docs/last-updated, 20/page pagination
2. ✅ **R-CD-02:** Filter by status (red/yellow/green), search by name, sort by score/name/updated, filters in URL params
3. ✅ **R-CD-03:** Dashboard shows active alerts for expiring (3-7d), expired (0d), non-compliant workers, clickable to filter
4. ✅ **R-CD-04:** Export as CSV (name, email, score, docs_completed, updated) and PDF (agency name, date, all workers)
5. ✅ **R-CD-05:** Scores match Phase 4 formula (completed_required / total_required * 100), unit test verifies
6. ✅ **R-CD-06:** Modal with worker profile, approve/reject buttons, deactivate action, all logged
7. ✅ **R-CD-07:** Read-only audit log view with action/entity/who/when, filterable by action type (from Phase 3 endpoint)
8. ✅ **R-CD-08:** Single aggregation query (no N+1), loads <2s with 200 workers, 60s Redis cache
9. ✅ **R-CD-09:** Responsive: desktop ≥1024px (full table), tablet 768-1023px (stacked), mobile <768px (cards)
10. ✅ **R-CD-10:** Clear error messages (export timeout spinner, permission denied 403, stale data warning)

**Compliance Scoring Test:**
- Dashboard scores ≡ Phase 4 worker portal scores for same worker (unit test assertion)

**Performance Test:**
- Dashboard loads <2s on 4G with 200 workers (benchmark in test suite)

**N+1 Query Audit:**
- Single SQL aggregation query logged; zero N+1 patterns detected

**Mobile Responsiveness:**
- Tested on Chrome DevTools iPad (768px) and mobile (375px) viewports; no horizontal scrolling

**All Actions Logged:**
- Document approvals, rejections, deactivations all create AuditLog entries (verified in test)

**Export Handles Large Datasets:**
- 500+ row export generates without timeout; 202 Accepted returned for long-running exports
</verification>

<success_criteria>
**Phase 5 Complete When:**

1. All 4 tasks executed and passing tests
2. Backend API endpoints (workers, export, alerts) return correct data with proper filtering, sorting, caching
3. Frontend dashboard renders workers list with filters/sort/pagination, responsive on desktop/tablet/mobile
4. Quick-action modal opens, allows approve/reject/deactivate, logs all actions to AuditLog
5. Compliance scores match Phase 4 calculation (unit test passes)
6. Dashboard loads <2s with 200 workers (performance gate passes)
7. Export generates CSV/PDF files, downloads in browser
8. All 10 requirements from SPEC.md satisfied
9. Code passes linting, tests >80% coverage
10. Zero security regressions (STRIDE mitigations implemented)

**Deployment Checklist:**
- [ ] Backend routes registered in server.js
- [ ] Frontend page added to app router
- [ ] Environment variables set (API_URL on frontend, DATABASE_URL on backend)
- [ ] Tests passing locally
- [ ] Code reviewed for N+1 queries, permission checks, error handling
- [ ] Responsive design tested on desktop/tablet/mobile
- [ ] Export tested with large dataset (500+ workers)
- [ ] AuditLog verified for all state-changing actions
</success_criteria>

<output>
After execution, create `.planning/phases/05-coordinator-dashboard/05-PLAN-SUMMARY.md` documenting:
- Implementation artifacts created (files, routes, components)
- Actual test coverage (% by module)
- Performance baseline (actual load time with 200 workers)
- Any blockers or deviations from plan
- Lessons for Phase 6 (audit pack generator, report builder)
</output>
