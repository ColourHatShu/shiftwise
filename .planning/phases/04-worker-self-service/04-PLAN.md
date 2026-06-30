---
phase: 04-worker-self-service
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/app/worker/dashboard/page.tsx
  - frontend/lib/api/worker.ts
  - frontend/lib/worker-compliance.ts
  - frontend/lib/worker-offline.ts
  - backend/src/routes/worker-documents.js
  - backend/src/services/cronService.js
  - backend/src/lib/emailTemplates.js
  - backend/prisma/schema.prisma
autonomous: true
requirements: [R-WP-01, R-WP-02, R-WP-03, R-WP-04, R-WP-05, R-WP-06, R-WP-07, R-WP-08, R-WP-09, R-WP-10]
must_haves:
  truths:
    - "Worker can upload document via camera on mobile (or file picker on desktop) and see it appear instantly"
    - "Worker can view compliance checklist showing required vs. optional documents with visual progress"
    - "Compliance score (0–100%) is displayed with color-coded status (red/yellow/green)"
    - "Worker receives email notifications at 90/60/30/14/7/3/1 day and expiry date milestones"
    - "Rejected documents show coordinator feedback reason; worker can re-upload"
    - "Worker can view compliance status while offline (cached document list)"
    - "Offline upload attempts queue and retry automatically when connection returns"
    - "All worker actions (upload, view) logged to AuditLog with IP and user agent"
    - "Mobile portal loads in <2s on 4G; all touch targets ≥48px"
    - "Document type dropdown populated dynamically from agency configuration"
  artifacts:
    - path: "frontend/app/worker/dashboard/page.tsx"
      provides: "Mobile-first redesign of worker portal with compliance checklist, camera capture, offline support"
      min_lines: 400
    - path: "frontend/lib/worker-compliance.ts"
      provides: "Compliance score calculation and color-coding helpers"
      exports: ["calculateComplianceScore", "getComplianceColor", "getComplianceMessage"]
    - path: "frontend/lib/worker-offline.ts"
      provides: "Offline caching and upload queuing logic"
      exports: ["cacheDocuments", "queueUpload", "getOfflineDocuments", "retryQueuedUploads"]
    - path: "backend/src/routes/worker-documents.js"
      provides: "Enhanced worker document APIs with rejection reason, dynamic doc types, audit logging"
      exports: ["getWorkerDocuments", "uploadWorkerDocument", "getDocumentTypes"]
    - path: "backend/src/services/cronService.js"
      provides: "Extended cron job for multi-milestone worker notifications (90/60/30/14/7/3/1/0 days)"
      min_lines: 400
    - path: "backend/src/lib/emailTemplates.js"
      provides: "Worker-specific email notification template"
      exports: ["getWorkerExpiryTemplate"]
    - path: "backend/prisma/schema.prisma"
      provides: "Updated schema with rejectionReason field (already exists); verified ExpiryAlert unique constraint"
      contains: "rejectionReason String?"
  key_links:
    - from: "frontend/app/worker/dashboard/page.tsx"
      to: "backend/src/routes/worker-documents.js"
      via: "fetch to /api/worker/documents, /api/worker/documents/upload"
      pattern: "getWorkerDocuments.*uploadWorkerDocument"
    - from: "frontend/app/worker/dashboard/page.tsx"
      to: "frontend/lib/worker-compliance.ts"
      via: "calculateComplianceScore, getComplianceColor called during render"
      pattern: "calculateComplianceScore\\(.*documents"
    - from: "frontend/app/worker/dashboard/page.tsx"
      to: "frontend/lib/worker-offline.ts"
      via: "localStorage cache load on mount, queueUpload on network failure"
      pattern: "getOfflineDocuments\\|queueUpload"
    - from: "backend/src/services/cronService.js"
      to: "backend/src/lib/emailTemplates.js"
      via: "sendWorkerExpiryAlert calls getWorkerExpiryTemplate"
      pattern: "getWorkerExpiryTemplate\\(.*daysUntilExpiry"
    - from: "backend/src/routes/worker-documents.js"
      to: "backend/prisma/schema.prisma"
      via: "ComplianceDocument query with rejectionReason, DocumentType query"
      pattern: "findMany.*where.*workerId"

---

## Phase Goal

**As a** healthcare worker (nurse, carer) accessing the system from my phone between shifts, **I want to** upload my compliance documents, see which documents I'm missing, receive reminders before they expire, and understand why a document was rejected, **so that** I stay compliant without a coordinator repeatedly chasing me for documents.

**MVP Success:** Workers self-serve document uploads and compliance tracking; coordinators spend zero time chasing missing documents. Workers receive proactive notifications before expiry.

---

## Overview

Phase 4 delivers a **mobile-first worker self-service portal** with compliance visibility and proactive notifications. This is an MVP vertical slice: once complete, a field worker can upload documents on their phone, see their compliance status at a glance with a visual score, and receive email reminders as deadlines approach—all with offline fallback.

**Mode:** MVP (vertical slices, not horizontal layers). Each feature slice is end-to-end: UI → API → database → notifications.

**Effort Estimate (solo developer):**
- Feature Slice 1 (Camera + Upload): 3–4 hours
- Feature Slice 2 (Compliance Checklist + Score): 3–4 hours
- Feature Slice 3 (Offline Support): 3–4 hours
- Feature Slice 4 (Notifications Pipeline): 4–5 hours
- Feature Slice 5 (Rejection Feedback): 2–3 hours
- Feature Slice 6 (Testing + Verification): 3–4 hours
- **Total:** ~20–24 hours (2.5–3 days of focused work)

**Atomic Commits:** One commit per completed feature slice, plus one final commit after all tests pass.

---

## Feature Slices (Vertical, Execution Order)

### Feature Slice 1: Mobile-First Dashboard Redesign + Camera Capture

**What this delivers:** Complete redesign of worker dashboard optimized for mobile (portrait/landscape, single-column layout, 48px touch targets). "Take Photo" button on mobile opens native device camera. "Choose File" fallback on desktop. Photos optimized client-side before upload.

**User story:** As a worker on my lunch break, I can photograph my passport with my phone's camera and upload it instantly without needing to find a pre-saved PDF.

**Dependency chain:** None (independent start).

**Acceptance:** Portal loads <2s on 4G, single-handed operation possible, camera button works on iPhone 12+ and Android 11+, photo optimization reduces 5MB camera photo to <2MB JPEG.

---

#### Task 1.1: Redesign worker dashboard component for mobile-first (frontend)

**Files:** `frontend/app/worker/dashboard/page.tsx`

**Action:**
Complete rewrite of existing dashboard (227 lines → ~450 lines). Replace current desktop-responsive layout with mobile-first single-column design:

1. **Layout hierarchy (mobile first):** Header → Compliance score badge (prominent, 60px height, color-coded) → Checklist summary (required/optional counts, progress bar) → Upload section (two buttons: "Take Photo" + "Choose File") → Document list (stacked cards, no modals on <480px).

2. **Compliance score display (top):** Large number (0–100) with color background: green (≥100% required docs valid), yellow (100% required but some <30 days to expiry), red (missing required docs or any doc <5 days). Include label: "Your Compliance Score".

3. **Checklist section:** Simple list showing each document type with checkbox state (✓ APPROVED or ○ PENDING). Label "X of Y required documents complete" with a linear progress bar (<= 480px: full width, >= 768px: flex-based grid).

4. **Upload section:** Two inputs on mobile (<480px), file input only on desktop:
   - **On mobile:** <input type="file" capture="environment" accept="image/*"> label "📷 Take Photo"
   - **On mobile:** <input type="file" accept=".pdf,image/*"> label "📄 Choose File"
   - **On desktop:** Only file picker (capture attribute ignored on desktop anyway)

5. **Typography:** Base 18px on mobile, 16px on tablet+ for readability (currently 16px). Use Tailwind's mobile-first breakpoints (`sm:`, `md:`, `lg:`).

6. **Remove:** CSS module-based styling (current `styles.uploadButton` etc.) → Convert to Tailwind classes for maintainability and mobile-first breakpoint control.

7. **Form reset:** After successful upload, clear form and show success toast: "Upload complete! Processing your document..."

8. **Error handling:** All errors (file too large, invalid type, network timeout, coordinator rejection) shown in error banner at top with specific actionable text. No silent failures.

9. **Offline banner (placeholder):** Show "You're offline. Cached data shown below." when offline (logic in feature slice 3).

10. **Audit logging:** Log document.viewed action when worker views rejection reason (implementation in feature slice 5).

**Per CONTEXT.md:** Use `calculateComplianceScore()` from worker-compliance.ts and `getOfflineDocuments()` from worker-offline.ts (both defined in later slices; this slice assumes they exist and can be imported).

**Verify:**
- Visual inspection: Portal renders properly on iPhone 14 Pro (390px), Samsung Galaxy S21 (360px), iPad (768px+), Desktop (1024px+)
- No horizontal scrolling on mobile
- All buttons ≥48px height
- Lighthouse score ≥75 on "4G Slow" throttle
- Load time <2s on 4G (measure with Lighthouse)

**Done:** Dashboard component complete with mobile-first layout, compliance score display, checklist summary, two upload buttons (camera + file), offline banner placeholder. No styling hacks; pure Tailwind. Compiles without errors. Not yet wired to offline logic.

---

#### Task 1.2: Implement client-side photo optimization + camera button logic (frontend)

**Files:** `frontend/lib/api/worker.ts`, `frontend/app/worker/dashboard/page.tsx` (camera input event handlers)

**Action:**
Add JavaScript to handle camera input and optimize photos before upload:

1. **Photo optimization function (in worker.ts):**
   - New export: `async function optimizePhoto(file: File): Promise<File>`
   - Input: File from `<input type="file" capture="environment">`
   - Process:
     * Read file as Data URL via FileReader
     * Create Canvas; load image onto it
     * Auto-correct EXIF rotation (use exif-js library if available; otherwise document that portrait photos may need manual correction—acceptable for MVP)
     * Resize to max 2MB: if original > 2MB, reduce via Canvas context `drawImage(img, 0, 0, width * 0.8, height * 0.8)`, then export as JPEG with quality 0.8
     * Return new File object (type: `image/jpeg`, name: `{original-name}.jpg`)
   - Error handling: If optimization fails (e.g., canvas size exceeded), return original file and log to Sentry
   
2. **Camera input event handler (in dashboard.tsx):**
   - When user clicks "📷 Take Photo":
     * Click hidden `<input type="file" capture="environment" accept="image/*" id="cameraInput" />`
     * On change event, call `optimizePhoto(file)` → get optimized File
     * Treat optimized file as if user selected via "Choose File" (same upload flow)
   - Show loading toast: "Optimizing photo..."
   - After optimization, auto-populate documentTypeId dropdown if user previously selected one (sticky UX)

3. **Graceful fallback (desktop):**
   - `capture="environment"` attribute ignored on desktop; native file picker opens (expected behavior)
   - "Take Photo" button only visible on mobile (use `hidden md:block` Tailwind class for desktop file input, `block md:hidden` for mobile camera input)

4. **Upload after optimization:**
   - Reuse existing `uploadWorkerDocument(formData)` from worker.ts
   - Optimized photo appended to FormData with same `documentTypeId` as before
   - Backend treats it identically to PDFs/JPEGs (no special handling needed)

**Per CONTEXT.md:** "No external dependencies (no Expo, no react-camera-pro)". Use HTML5 native capture attribute. EXIF rotation may require exif-js (check if already in package.json; if not, defer to Phase 5 with note that portrait photos may upload sideways).

**Verify:**
- Click "Take Photo" on iPhone Safari → device camera opens (actual device test required)
- Photograph test document (e.g., printed card) → camera captures image
- Optimized image is <2MB (check file size before upload)
- Optimized image appears in "Your Documents" list with same styling as PDF uploads
- Click "Choose File" on desktop → file picker opens (not camera)
- Photo optimization works offline (Canvas API is local; no network needed)
- Sentry logs any optimization errors without breaking upload flow

**Done:** Photo optimization working end-to-end. Camera button triggers capture on mobile, gracefully falls back to file picker on desktop. Photos reduced to <2MB JPEG. Worker can upload camera photos and see them in document list with correct encryption and audit trail (backend unchanged; camera photos treated as normal image uploads).

---

### Feature Slice 2: Compliance Checklist + Score Calculation (Frontend)

**What this delivers:** Helpers for calculating compliance score (0–100%) based on required documents. Frontend-side logic reads document list and DocumentType configurations, computes score, color-codes status. No backend changes needed for score calculation (it's UI sugar). Supports dynamic document type list (populated from `/api/worker/document-types` endpoint).

**User story:** As a worker, I can see a clear "3 of 5 required documents complete" checklist with a visual score so I know exactly what I'm missing.

**Dependency chain:** Requires `getWorkerDocuments()` to return documents; requires backend endpoint `/api/worker/document-types` (added in task 2.2).

**Acceptance:** Score calculated correctly, color-coded accurately, checklist matches document types configured for agency, no backend latency added.

---

#### Task 2.1: Create worker-compliance.ts helper library (frontend)

**Files:** `frontend/lib/worker-compliance.ts`

**Action:**
New file with pure functions for compliance scoring and status. No state; no API calls; called from dashboard component:

```typescript
// Exported functions:

/**
 * Calculate compliance score (0–100).
 * Input: Array of documents, Array of document types.
 * Output: { score: number, completed: number, required: number }
 */
export function calculateComplianceScore(
  documents: Document[],
  documentTypes: DocumentType[]
): { score: number; completed: number; required: number } {
  // Logic:
  // - Filter documentTypes where isRequired = true → required[]
  // - For each required doc type, find a document with matching documentTypeId where status='APPROVED' and expiryDate > today
  // - completed = count of matched documents
  // - required = count of required document types
  // - score = (completed / required) * 100, or 0 if required = 0
}

/**
 * Determine color-code for compliance status.
 * Input: documents, required count
 * Output: 'red' | 'yellow' | 'green'
 * 
 * Logic:
 * - Red: score < 100 OR any APPROVED doc < 5 days to expiry OR any doc is EXPIRED
 * - Yellow: score = 100 AND at least one APPROVED doc between 5–30 days to expiry
 * - Green: score = 100 AND all APPROVED docs > 30 days to expiry
 */
export function getComplianceColor(
  documents: Document[],
  score: number,
  requiredCount: number
): 'red' | 'yellow' | 'green' {
  // Implementation...
}

/**
 * Human-readable message for compliance status.
 * Input: color, score
 * Output: string like "Your compliance is up to date" or "2 documents are expiring soon"
 */
export function getComplianceMessage(color: 'red' | 'yellow' | 'green', score: number): string {
  // Implementation...
}

/**
 * Helper to check if a document is expired or expiring.
 * Input: document
 * Output: 'expired' | 'critical' (< 5 days) | 'warning' (5–30 days) | 'safe' (> 30 days)
 */
export function getDocumentUrgency(document: Document): 'expired' | 'critical' | 'warning' | 'safe' {
  // Implementation...
}
```

**Per CONTEXT.md:** "Calculation: `(completed_required / total_required) * 100`. Color code: Red if score < 100 or any document < 30 days to expiry. Yellow if score = 100 and at least one document between 5–30 days. Green if score = 100 and all documents > 30 days."

**Verify:**
- Unit test (add to frontend/tests or Jest config):
  - calculateComplianceScore([3 approved docs], [5 required types]) → score = 60, completed = 3, required = 5
  - getComplianceColor([all green], score=100) → 'green'
  - getComplianceColor([1 doc expires in 5 days], score=100) → 'yellow'
  - getComplianceColor([1 required doc missing], score=80) → 'red'
- All tests pass. No runtime errors.

**Done:** Compliance scoring library complete. Deterministic, testable, no dependencies on API state.

---

#### Task 2.2: Add GET /api/worker/document-types endpoint (backend)

**Files:** `backend/src/routes/worker-documents.js`

**Action:**
Add new GET endpoint to fetch agency's document types (sorted: required first, then optional):

```javascript
/**
 * GET /api/worker/document-types
 * Returns list of document types configured for the worker's agency.
 * Sorted: required documents first, then optional.
 */
async function getDocumentTypes(req, res) {
  try {
    const { agencyId } = req.worker;

    const docTypes = await prisma.documentType.findMany({
      where: { agencyId },
      select: {
        id: true,
        name: true,
        isRequired: true,
        expiryWarningDays: true,
        hasExpiry: true
      },
      orderBy: [
        { isRequired: 'desc' },  // Required first
        { name: 'asc' }           // Then alphabetical
      ]
    });

    // If agency has zero document types, return empty array with hint
    res.status(200).json({
      documentTypes: docTypes,
      message: docTypes.length === 0 
        ? "No document types configured. Contact your coordinator."
        : undefined
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { agencyId: req.worker?.agencyId, context: 'worker.get-document-types' }
    });
    res.status(500).json({ error: 'Failed to fetch document types' });
  }
}

// Export from module
module.exports = { ..., getDocumentTypes };
```

**Wire into backend router (worker-documents.js or main server.js):**
```javascript
router.get('/worker/document-types', workerAuthMiddleware, getDocumentTypes);
```

**Verify:**
```
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/worker/document-types
→ { "documentTypes": [
     { "id": "...", "name": "DBS Check", "isRequired": true, "expiryWarningDays": 30 },
     { "id": "...", "name": "Passport", "isRequired": true, ... },
     { "id": "...", "name": "CV", "isRequired": false, ... }
   ] }
```

**Done:** Backend endpoint returns agency's document types, sorted by required status. Frontend can now populate dropdown dynamically.

---

#### Task 2.3: Wire compliance score into dashboard component (frontend)

**Files:** `frontend/app/worker/dashboard/page.tsx`

**Action:**
Integrate score calculation and display into dashboard redesign:

1. **Load document types on mount:**
   ```typescript
   useEffect(() => {
     const loadDocumentTypes = async () => {
       const types = await fetch('/api/worker/document-types').then(r => r.json());
       setDocumentTypes(types.documentTypes);
     };
     loadDocumentTypes();
   }, []);
   ```

2. **Calculate score after documents load:**
   ```typescript
   const { score, completed, required } = useMemo(
     () => calculateComplianceScore(documents, documentTypes),
     [documents, documentTypes]
   );
   ```

3. **Display score prominently:**
   - Large badge at top: `<div className="text-5xl font-bold">{score}</div>%`
   - Background color: call `getComplianceColor(documents, score, required)` → apply Tailwind bg-red-100, bg-yellow-100, or bg-green-100
   - Below badge: `{getComplianceMessage(color, score)}`
   - Below message: `<p>{completed} of {required} required documents complete</p>`
   - Progress bar: `<div className="w-full h-2 bg-gray-200"><div style={{width: `${(completed / required) * 100}%`}} className="bg-green-500" /></div>`

4. **Checklist section (after score):**
   - For each documentType in documentTypes:
     * Find if a PENDING or APPROVED document with matching documentTypeId exists
     * Render checkbox: ✓ if found and APPROVED, ○ if PENDING/REJECTED, × if missing
     * Label: `{documentType.name} {documentType.isRequired ? '(Required)' : '(Optional)'}`
     * If found, show expiry status: `Expires in {daysUntilExpiry} days` with urgency color

5. **Document upload dropdown:** Populate `<select>` with documentTypes.map(dt => <option value={dt.id}>{dt.name}</option>)

**Per CONTEXT.md:** No backend score endpoint needed; frontend calculates on-the-fly from document list + type configs.

**Verify:**
- Load dashboard → score displayed at top with correct color
- Upload document → score recalculated, badge color updates if needed
- Reject document in coordinator UI → worker portal refreshes, score decreases
- Dropdown shows all agency document types, sorted (required first)
- Lighthouse: still ≥75 on 4G throttle

**Done:** Compliance score visible, color-coded, and responsive to document changes. Checklist shows required vs. optional. Dropdown dynamically populated.

---

### Feature Slice 3: Offline Data Caching + Queued Upload Retry

**What this delivers:** localStorage-based caching of document list. Offline detection banner. Queued uploads stored locally and retried automatically when connection returns (polling every 10s).

**User story:** As a worker on a train with spotty coverage, I can see my compliance status from a previous load, and if I accidentally try to upload while offline, the upload queues and retries automatically when I regain signal.

**Dependency chain:** Requires getWorkerDocuments() to populate cache. No backend changes.

**Acceptance:** Offline banner appears when offline. Documents visible from cache. Queued upload persists and retries without user intervention. Cache expires after 1h.

---

#### Task 3.1: Create worker-offline.ts helper library (frontend)

**Files:** `frontend/lib/worker-offline.ts`

**Action:**
New file with offline utilities (caching, queuing, retry logic):

```typescript
/**
 * Cache document list in localStorage.
 * Input: documents array
 * Output: none (side effect: localStorage write)
 */
export function cacheDocuments(documents: Document[]): void {
  const cacheData = {
    documents,
    timestamp: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
  };
  localStorage.setItem('worker_docs_cache', JSON.stringify(cacheData));
}

/**
 * Retrieve cached document list if valid (not expired).
 * Output: Document[] or null if cache expired/missing
 */
export function getOfflineDocuments(): Document[] | null {
  const cached = localStorage.getItem('worker_docs_cache');
  if (!cached) return null;
  
  const { documents, expiresAt } = JSON.parse(cached);
  if (Date.now() > expiresAt) {
    localStorage.removeItem('worker_docs_cache');
    return null;
  }
  return documents;
}

/**
 * Queue a failed upload for retry.
 * Input: file, documentTypeId
 * Output: queueId (uuid)
 * 
 * Logic:
 * - Max 1 queued upload (overwrites previous if exists)
 * - Store in localStorage['worker_uploads_queue'] as JSON: { id, file (base64), documentTypeId, timestamp }
 */
export function queueUpload(file: File, documentTypeId: string): string {
  const queueId = generateUUID();
  // Read file as base64 and store
  const reader = new FileReader();
  reader.onload = () => {
    const queueData = {
      id: queueId,
      fileName: file.name,
      fileBase64: reader.result as string,
      documentTypeId,
      timestamp: Date.now()
    };
    localStorage.setItem('worker_uploads_queue', JSON.stringify(queueData));
  };
  reader.readAsDataURL(file);
  return queueId;
}

/**
 * Clear queued upload after successful retry.
 */
export function clearQueuedUpload(): void {
  localStorage.removeItem('worker_uploads_queue');
}

/**
 * Poll for queued upload and retry when online.
 * Called when navigator.onLine becomes true.
 * Input: uploadFunction (the async function to call with FormData)
 * Output: Promise<{ success: boolean; message: string }>
 * 
 * Logic:
 * - Get queued upload from localStorage
 * - Convert base64 back to File
 * - Create FormData with file + documentTypeId
 * - Call uploadFunction(formData)
 * - On success: clearQueuedUpload(), return { success: true }
 * - On failure: leave in queue, return { success: false, message: error }
 */
export async function retryQueuedUploads(uploadFunction: (formData: FormData) => Promise<any>): Promise<{ success: boolean; message: string }> {
  const queued = localStorage.getItem('worker_uploads_queue');
  if (!queued) return { success: true, message: 'No queued uploads' };

  try {
    const { fileName, fileBase64, documentTypeId } = JSON.parse(queued);
    const file = base64ToFile(fileBase64, fileName);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentTypeId', documentTypeId);

    await uploadFunction(formData);
    clearQueuedUpload();
    return { success: true, message: 'Cached upload complete!' };
  } catch (error) {
    return { success: false, message: `Retry failed: ${error.message}` };
  }
}

/**
 * Monitor online/offline status and trigger retry when online.
 * Call once on component mount.
 */
export function startOfflineMonitoring(retryCallback: () => void): () => void {
  const handleOnline = () => {
    console.log('[Offline Monitor] Connection restored');
    retryCallback();
  };

  window.addEventListener('online', handleOnline);
  
  // Return cleanup function
  return () => window.removeEventListener('online', handleOnline);
}

// Helper utilities
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function base64ToFile(base64: string, fileName: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new File([u8arr], fileName, { type: mime });
}
```

**Verify:**
- Unit tests:
  - cacheDocuments(docs) → localStorage['worker_docs_cache'] contains valid JSON
  - getOfflineDocuments() → returns cached docs if not expired
  - getOfflineDocuments() → returns null if cache expired
  - queueUpload(file, type) → localStorage['worker_uploads_queue'] contains file base64
  - retryQueuedUploads() → on success, queue cleared
- All tests pass. No runtime errors.

**Done:** Offline helpers library complete. Caching, queuing, and retry logic implemented.

---

#### Task 3.2: Integrate offline logic into dashboard component (frontend)

**Files:** `frontend/app/worker/dashboard/page.tsx`

**Action:**
Wire offline detection and caching into the dashboard:

1. **On component mount, load from cache if offline:**
   ```typescript
   useEffect(() => {
     const loadDocuments = async () => {
       if (!navigator.onLine) {
         const cached = getOfflineDocuments();
         if (cached) {
           setDocuments(cached);
           setIsOffline(true);
           return; // Don't try to fetch
         }
       }
       // Normal fetch flow...
       const data = await getWorkerDocuments();
       setDocuments(data.documents || []);
       cacheDocuments(data.documents || []);
     };
     loadDocuments();
   }, []);
   ```

2. **Monitor online/offline status:**
   ```typescript
   useEffect(() => {
     const unsubscribe = startOfflineMonitoring(async () => {
       setIsOffline(false);
       // Refresh document list now that online
       await loadDocuments();
       // Try to retry queued upload
       const result = await retryQueuedUploads(uploadWorkerDocument);
       if (result.success) {
         showToast('Cached upload complete!', 'success');
       }
     });

     const handleOffline = () => setIsOffline(true);
     window.addEventListener('offline', handleOffline);

     return () => {
       unsubscribe();
       window.removeEventListener('offline', handleOffline);
     };
   }, []);
   ```

3. **Show offline banner:**
   ```typescript
   {isOffline && (
     <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
       You're offline. Cached data shown below.
     </div>
   )}
   ```

4. **On upload failure (network error), queue instead of failing:**
   ```typescript
   const handleFileUpload = async (e) => {
     try {
       // ... validation ...
       await uploadWorkerDocument(formData);
     } catch (err) {
       if (!navigator.onLine || err.message.includes('network')) {
         // Queue for retry
         const queueId = queueUpload(file, documentTypeId);
         showToast('Upload queued. Will retry when online.', 'info');
         // Show optimistic document with status='PENDING'
         setDocuments([...documents, { id: queueId, status: 'PENDING', ... }]);
       } else {
         setError(err.message);
       }
     }
   };
   ```

5. **Cache after successful upload:**
   ```typescript
   // After refreshing document list post-upload:
   cacheDocuments(refreshedDocs);
   ```

**Verify:**
- Open dashboard while online → documents load and cached
- Toggle offline (DevTools Network tab → Offline) → "You're offline" banner appears
- Offline, refresh page → documents still visible from cache
- Offline, try to upload → error toast "Upload queued. Will retry when online."
- Queued document appears in list with PENDING status
- Toggle back online (DevTools → Online) → automatic retry of queued upload
- Queued upload succeeds → "Cached upload complete!" toast, queued doc removed, real doc appears
- Offline banner disappears when online
- Lighthouse: still ≥75 on 4G throttle

**Done:** Offline caching and upload queuing fully integrated. Workers can see cached documents while offline, upload attempts queue and retry automatically, no user intervention needed.

---

### Feature Slice 4: Multi-Milestone Pre-Expiry Notifications

**What this delivers:** Extended cron job that generates worker notifications at 90, 60, 30, 14, 7, 3, 1 day, and expiry date milestones. New worker-specific email template. Reuses existing FailedAlert DLQ and Resend infrastructure.

**User story:** As a worker, I receive a friendly email reminding me that my DBS Check expires in 7 days, and I get another email on the expiry date itself so I don't miss the deadline.

**Dependency chain:** Requires existing cronService.js structure, ExpiryAlert table, Resend email service. Worker model already has email field.

**Acceptance:** Worker receives 8 notifications over document lifecycle (90, 60, 30, 14, 7, 3, 1, 0 days). No duplicates on same day. Failed emails queued in FailedAlert DLQ with hourly retry. Email template responsive and includes call-to-action.

---

#### Task 4.1: Extend cronService.js to generate worker notifications (backend)

**Files:** `backend/src/services/cronService.js`

**Action:**
Modify the existing `checkExpiriesAndAlert` function to create ExpiryAlerts for both coordinators AND workers at the specified milestones. Key changes:

1. **Update TARGET_DAYS_UNTIL_EXPIRY:**
   ```javascript
   const TARGET_DAYS_UNTIL_EXPIRY = [90, 60, 30, 14, 7, 3, 1, 0];
   ```

2. **In the document loop, after calculating daysRemaining:**
   ```javascript
   // Check if this document is at a milestone day
   if (!TARGET_DAYS_UNTIL_EXPIRY.includes(daysRemaining)) continue;

   // Already sends coordinator alert (existing code)
   // Now ALSO create worker alert...
   ```

3. **Add worker alert creation:**
   ```javascript
   try {
     // Coordinator email (existing)
     await sendExpiryAlert(doc.agency.email, fullWorkerName, ...);

     // NEW: Worker email
     const workerEmail = doc.worker.email; // Worker model has email field
     await sendWorkerExpiryAlert(workerEmail, doc.worker.firstName, doc.documentType.name, doc.expiryDate, daysRemaining);

     // Record both alerts
     await prisma.expiryAlert.create({
       data: {
         agencyId: doc.agencyId,
         workerId: doc.workerId,
         complianceDocumentId: doc.id,
         alertDate: new Date(),
         alertDateOnly: alertDateToday,
         daysUntilExpiry: daysRemaining,
         isSent: true,
         sentAt: new Date()
       }
     });
   } catch (err) {
     // Existing error handling + DLQ logic
   }
   ```

4. **Use unique constraint on (complianceDocumentId, daysUntilExpiry, alertDateOnly):**
   - Existing constraint prevents duplicate alerts per (document, threshold, day)
   - If cron runs twice on the same day for same document at same milestone, second run catches P2002 and skips gracefully

5. **Logging:** Add audit log for worker alerts:
   ```javascript
   await prisma.auditLog.create({
     data: {
       agencyId: doc.agencyId,
       userId: null, // System action (no user)
       action: 'alert.worker_expiry_warning_sent',
       entity: 'ComplianceDocument',
       entityId: doc.id,
       metadata: {
         workerName: fullWorkerName,
         documentType: doc.documentType.name,
         daysRemaining: daysRemaining,
         recipient: doc.worker.email
       }
     }
   });
   ```

**Per CONTEXT.md:** "Extend `checkExpiriesAndAlert` to also generate worker notifications. Use existing unique constraint to prevent duplicates."

**Verify:**
- Test cron run with document expiring in exactly 7 days:
  - Coordinator alert created (existing)
  - Worker alert created (new)
  - ExpiryAlert record in DB with daysUntilExpiry=7
  - No duplicate if cron runs again same day
- Test with document expiring in 0 days (today):
  - Both alerts created
  - daysUntilExpiry=0 recorded
- Sentry logs any email failures
- FailedAlert table populated on send failure

**Done:** cronService extended to generate worker notifications at all 8 milestones. No duplicate alerts per document per day. Failed alerts queued in DLQ.

---

#### Task 4.2: Create worker-specific email template (backend)

**Files:** `backend/src/lib/emailTemplates.js` (new file or addition to existing)

**Action:**
Add function to generate worker-friendly pre-expiry notification email:

```javascript
/**
 * Generate email template for worker pre-expiry notification.
 * Input: workerFirstName, documentType, expiryDate, daysUntilExpiry
 * Output: HTML string (responsive, mobile-friendly)
 */
function getWorkerExpiryTemplate(workerFirstName, documentType, expiryDate, daysUntilExpiry) {
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-GB');
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.shiftwise.io';
  
  const urgencyText = daysUntilExpiry === 0 
    ? 'Your document has EXPIRED TODAY' 
    : `Your ${documentType} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`;

  const subject = daysUntilExpiry === 0
    ? `[URGENT] Your ${documentType} has expired`
    : `[Action Required] Your ${documentType} expires in ${daysUntilExpiry} days`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .content { padding: 20px 0; }
        .cta-button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer { font-size: 12px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
        .urgency-red { color: #dc2626; }
        .urgency-yellow { color: #ea580c; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ShiftWise Compliance Reminder</h1>
        </div>
        
        <div class="content">
          <p>Hi ${workerFirstName},</p>
          
          <p class="${daysUntilExpiry === 0 ? 'urgency-red' : 'urgency-yellow'}">
            <strong>${urgencyText}</strong>
          </p>
          
          <p>
            Your <strong>${documentType}</strong> expires on <strong>${formattedDate}</strong>.
            ${daysUntilExpiry === 0 
              ? 'You must upload a renewal immediately to continue working on shifts.'
              : `You have ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} to renew this document.`
            }
          </p>
          
          <p>
            <a href="${portalUrl}/worker/dashboard" class="cta-button">View Your Compliance Status</a>
          </p>
          
          <p>
            If you have any questions, please contact your coordinator.
          </p>
        </div>
        
        <div class="footer">
          <p>
            This is an automated message from ShiftWise. 
            <a href="${portalUrl}/worker/dashboard/preferences" style="color: #2563eb; text-decoration: none;">Manage notification preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

module.exports = { ..., getWorkerExpiryTemplate };
```

**Requirements met:**
- [ ] Responsive design (works on mobile)
- [ ] Includes document type, expiry date, days remaining
- [ ] Clear call-to-action button to worker portal
- [ ] Unsubscribe link (via Resend's built-in footer)
- [ ] Professional tone

**Verify:**
- Check template renders correctly in Resend preview
- Send test email to worker → appears in inbox on iPhone + desktop
- Click "View Your Compliance Status" → redirects to worker dashboard
- Subject line clear: "[Action Required] Your DBS Check expires in 7 days"
- Template responsive on mobile (no horizontal scroll)

**Done:** Worker-specific email template created, tested, and ready for cron integration.

---

#### Task 4.3: Wire sendWorkerExpiryAlert into emailService (backend)

**Files:** `backend/src/lib/nodemailer.js` (or similar email service file)

**Action:**
Add function to send worker notification email via Resend:

```javascript
/**
 * Send pre-expiry alert email to worker.
 * Input: workerEmail, workerFirstName, documentType, expiryDate, daysUntilExpiry
 * Output: Promise (resolves on success, rejects on failure)
 */
async function sendWorkerExpiryAlert(workerEmail, workerFirstName, documentType, expiryDate, daysUntilExpiry) {
  const { subject, html } = getWorkerExpiryTemplate(workerFirstName, documentType, expiryDate, daysUntilExpiry);

  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@shiftwise.io',
      to: workerEmail,
      subject,
      html,
      headers: {
        'X-Email-Type': 'worker-expiry-alert'
      }
    });

    console.log(`[Email Service] Sent worker expiry alert to ${workerEmail} for ${documentType}: ${daysUntilExpiry} days`);
    return response;
  } catch (error) {
    console.error(`[Email Service] Failed to send worker alert to ${workerEmail}:`, error);
    throw error; // Let caller handle (cron will catch and add to FailedAlert DLQ)
  }
}

module.exports = { ..., sendWorkerExpiryAlert };
```

**Wire into cronService:**
```javascript
// In cronService.js
const { sendExpiryAlert, sendWorkerExpiryAlert } = require('../lib/nodemailer');

// In checkExpiriesAndAlert loop:
await sendWorkerExpiryAlert(
  doc.worker.email,
  doc.worker.firstName,
  doc.documentType.name,
  doc.expiryDate,
  daysRemaining
);
```

**Verify:**
- Test with a document expiring in 7 days:
  - sendWorkerExpiryAlert called with correct params
  - Email sent to worker's email address
  - Subject line correct: "[Action Required] ..."
  - Body includes document type, expiry date, days remaining, CTA button
- Test failure handling:
  - Network error caught and logged to Sentry
  - Error re-thrown so cron adds to FailedAlert DLQ
- Resend email delivery confirmed (check Resend dashboard for delivery stats)

**Done:** Worker email notifications sending successfully at all 8 milestones. Failed alerts captured in DLQ for hourly retry.

---

### Feature Slice 5: Document Rejection with Coordinator Feedback

**What this delivers:** When a coordinator rejects a document, they add a brief reason (max 100 chars). Worker sees the reason in the portal and can re-upload. The rejectionReason field already exists in the schema; just need UI + backend wiring.

**User story:** As a worker, when my passport photo is rejected, I see the reason ("Photo quality too low") and know exactly how to fix it. I can re-upload immediately.

**Dependency chain:** Requires existing coordinator approval UI (Phase 3 artifact). Requires rejectionReason column in ComplianceDocument (already in schema).

**Acceptance:** Coordinator can add rejection reason (UI), worker sees it on rejected documents, worker can re-upload same document type, audit trail captures action.

---

#### Task 5.1: Update worker document list to show rejection reason (frontend)

**Files:** `frontend/app/worker/dashboard/page.tsx`

**Action:**
Enhance document card display to show rejection reason when status='REJECTED':

```typescript
// In document card render:
{doc.status === 'REJECTED' && doc.rejectionReason && (
  <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-500">
    <p className="text-sm font-semibold text-red-700">Rejected</p>
    <p className="text-sm text-red-600 mt-1">{doc.rejectionReason}</p>
    <button
      onClick={() => {
        // Focus upload form, pre-select this doc type
        document.getElementById('documentTypeId')?.focus();
        setSelectedDocType(doc.documentTypeId);
        showToast('Ready to re-upload. Choose file and submit.', 'info');
      }}
      className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
    >
      Re-upload
    </button>
  </div>
)}
```

2. **Update Document interface to include rejectionReason:**
   ```typescript
   interface Document {
     id: string;
     fileName: string;
     docType: string;
     status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
     expiryDate: string | null;
     daysUntilExpiry: number | null;
     expiryColor: 'green' | 'yellow' | 'red' | 'gray';
     uploadedAt: string;
     rejectionReason?: string; // NEW
     documentTypeId: string; // NEW (for re-upload link)
   }
   ```

3. **Update getWorkerDocuments API client (worker.ts) to return rejectionReason:**
   ```typescript
   // API should now return rejectionReason in document object
   ```

4. **Audit log:** When worker views rejection reason, log action:
   ```typescript
   // When document card rendered with rejection reason visible:
   useEffect(() => {
     if (doc.status === 'REJECTED' && doc.rejectionReason) {
       // Log document.viewed action asynchronously
       fetch(`/api/audit-log/log`, {
         method: 'POST',
         body: JSON.stringify({
           action: 'document.rejection_reason_viewed',
           entity: 'ComplianceDocument',
           entityId: doc.id,
           metadata: { reason: doc.rejectionReason }
         })
       }).catch(err => console.error('Audit log failed:', err));
     }
   }, [doc.id]);
   ```

**Verify:**
- Coordinator rejects document with reason "Photo too blurry"
- Worker views dashboard → rejected document shows reason
- Worker clicks "Re-upload" → upload form scrolls into view with doc type pre-selected
- Worker re-uploads → new document created (old rejected version stays in audit log)
- Audit log shows document.rejection_reason_viewed action with timestamp

**Done:** Worker can see rejection reason and re-upload. Audit trail captures feedback viewing.

---

#### Task 5.2: Ensure backend returns rejectionReason in worker document list (backend)

**Files:** `backend/src/routes/worker-documents.js`

**Action:**
Update the getWorkerDocuments function to include rejectionReason in the response:

```javascript
// In getWorkerDocuments, in the enrichedDocs.map():
return {
  id: doc.id,
  fileName: doc.fileName,
  docType: doc.documentType.name,
  status: doc.status,
  expiryDate: doc.expiryDate,
  daysUntilExpiry,
  expiryColor: getExpiryColor(doc.expiryDate),
  uploadedAt: doc.uploadedAt,
  rejectionReason: doc.rejectionReason, // NEW
  documentTypeId: doc.documentTypeId, // NEW
};
```

**Verify:**
```
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/worker/documents
→ Returns documents with rejectionReason and documentTypeId fields
```

**Done:** Worker API returns rejection reason; frontend can display it.

---

#### Task 5.3: Ensure coordinator rejection workflow includes reason field (backend)

**Files:** `backend/src/routes/worker-documents.js` or coordinator document approval route

**Action:**
Verify that the document approval endpoint accepts an optional `rejectionReason` field on reject:

```javascript
/**
 * PATCH /api/worker/documents/:id
 * Body: { action: 'approve' | 'reject', rejectionReason?: string }
 */
async function updateWorkerDocumentStatus(req, res) {
  try {
    const { action, rejectionReason } = req.body;
    const { id } = req.params;
    const { agencyId } = req.user;

    if (action === 'reject') {
      // Validate rejectionReason if provided
      if (rejectionReason && rejectionReason.length > 100) {
        return res.status(400).json({ error: 'Rejection reason must be <= 100 characters' });
      }

      const updated = await prisma.complianceDocument.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || null,
          reviewedAt: new Date()
        }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          agencyId,
          action: 'document.rejected',
          entity: 'ComplianceDocument',
          entityId: id,
          metadata: { rejectionReason: rejectionReason || 'No reason provided' }
        }
      });

      res.status(200).json({ message: 'Document rejected', document: updated });
    }
    // ... rest of logic
  } catch (error) {
    // ... error handling
  }
}
```

**Note:** The exact coordinator UI for adding rejection reason is in Phase 3 (coordinator dashboard). Phase 4 just ensures the backend accepts and stores it. Coordinator frontend can add a textarea field: `<textarea maxLength={100} placeholder="Reason for rejection (optional)" name="rejectionReason" />`

**Verify:**
```
PATCH /api/worker/documents/{docId}
Body: { action: 'reject', rejectionReason: 'Photo quality too low' }
→ Document status set to REJECTED
→ rejectionReason stored in DB
→ Audit log created with reason
→ Worker next load sees rejection reason in portal
```

**Done:** Rejection workflow complete. Worker receives feedback and can re-upload.

---

### Feature Slice 6: Testing + Verification

**What this delivers:** Unit tests for compliance scoring, offline caching, and notification logic. E2E test for happy path (worker uploads → gets approved → receives notification). Mobile device testing on real devices. Lighthouse performance verification. All Phase 4 requirements validated.

**User story (meta):** As a developer, I can verify that Phase 4 meets all acceptance criteria and works correctly on real devices.

**Dependency chain:** Requires all 5 previous slices to be complete.

**Acceptance:** 80%+ coverage on business logic, E2E happy path passes, Lighthouse ≥75 on 4G, mobile device testing confirmed.

---

#### Task 6.1: Unit tests for compliance scoring and offline helpers (frontend)

**Files:** `frontend/tests/worker-compliance.test.ts`, `frontend/tests/worker-offline.test.ts`

**Action:**
Create Jest test suites for helper libraries. See feature slice implementation sections for specific test cases.

**Run tests:**
```bash
npm test -- worker-compliance.test.ts worker-offline.test.ts --coverage
```

**Coverage target:** 80%+ for business logic functions.

**Verify:**
- All tests pass. Coverage report shows ≥80% for:
  - calculateComplianceScore
  - getComplianceColor
  - cacheDocuments, getOfflineDocuments
  - queueUpload, clearQueuedUpload

**Done:** Unit tests pass. Offline and scoring logic verified.

---

#### Task 6.2: E2E happy path test (worker upload → approval → notification) (backend integration test)

**Files:** `backend/src/tests/integration/worker-e2e.test.js`

**Action:**
Create integration test that verifies the full happy path. See feature slice implementation sections for specific test steps.

**Run test:**
```bash
npm test -- backend/src/tests/integration/worker-e2e.test.js
```

**Verify:**
- All steps pass:
  1. Document types fetched dynamically
  2. Upload returns 201
  3. Document visible in list
  4. Approval status reflected
  5. Notification generated at 30-day milestone
  6. Audit logs capture all actions

**Done:** E2E happy path verified end-to-end.

---

#### Task 6.3: Mobile device testing on real devices (manual, checkpoint)

**Files:** None (manual verification)

**What-built:** Complete Phase 4 implementation (all 5 previous slices).

**How-to-verify:**
Test the live deployed (or local) worker dashboard on real devices. See feature slice 1 for specific test steps and devices.

**Resume-signal:** "All devices tested, no blocking issues" or describe any issues found.

**Done:** Mobile and desktop verified on real devices.

---

#### Task 6.4: Verify all Phase 4 acceptance criteria (checkpoint)

**Files:** None (verification checklist)

**What-built:** Complete Phase 4 implementation.

**How-to-verify:**
Go through each of the 10 requirements from SPEC.md and confirm acceptance criteria are met. See feature slice sections for specific verification steps.

**Resume-signal:** "All 10 requirements verified ✓" or list any gaps to be addressed.

**Done:** All Phase 4 acceptance criteria confirmed met. Ready for production.

---

## Atomic Commits

After each feature slice completes and passes verification, create an atomic commit:

```bash
# After Slice 1
git add frontend/app/worker/dashboard/page.tsx frontend/lib/api/worker.ts
git commit -m "feat(04-worker-portal): mobile redesign + camera capture

- Complete redesign of worker dashboard for mobile-first (single column, <2s 4G load)
- Camera capture button on mobile opens native device camera
- Client-side photo optimization (EXIF rotation, <2MB JPEG)
- All touch targets ≥48px (WCAG mobile standard)
- Graceful fallback to file picker on desktop"

# After Slice 2
git add frontend/lib/worker-compliance.ts backend/src/routes/worker-documents.js
git commit -m "feat(04-worker-portal): compliance score + checklist + doc types API

- Compliance score calculation (0–100%) based on required documents
- Color-coded status: red/yellow/green with dynamic messages
- Document checklist shows required vs. optional with progress bar
- New GET /api/worker/document-types endpoint
- Dynamic dropdown population from agency configuration"

# After Slice 3
git add frontend/lib/worker-offline.ts frontend/app/worker/dashboard/page.tsx
git commit -m "feat(04-worker-portal): offline caching + queued upload retry

- localStorage-based caching of document list (1h expiry)
- Offline banner when navigator.onLine = false
- Failed uploads queue in localStorage and retry on reconnect
- Auto-retry polling every 10s when connection restored
- Max 1 queued upload per session (no queue buildup)"

# After Slice 4
git add backend/src/services/cronService.js backend/src/lib/emailTemplates.js backend/src/lib/nodemailer.js
git commit -m "feat(04-worker-portal): multi-milestone pre-expiry notifications

- Extended cronService to generate worker alerts at 90/60/30/14/7/3/1/0 day milestones
- Worker-specific email template (responsive, includes CTA button)
- Reuses existing FailedAlert DLQ for failed email retry (hourly)
- Unique constraint prevents duplicate alerts per document per day
- Audit log captures notification sent action"

# After Slice 5
git add frontend/app/worker/dashboard/page.tsx backend/src/routes/worker-documents.js
git commit -m "feat(04-worker-portal): rejection feedback + re-upload

- Coordinator can add optional rejectionReason (≤100 chars) when rejecting
- Worker sees rejection reason on rejected document card
- 'Re-upload' button focuses form and pre-selects document type
- Rejection reason captured in audit log for compliance
- Worker can upload new version of same document type"

# After Slice 6
git add frontend/tests/worker-compliance.test.ts frontend/tests/worker-offline.test.ts backend/src/tests/integration/worker-e2e.test.js
git commit -m "test(04-worker-portal): unit + E2E tests + mobile verification

- Unit tests: compliance scoring, offline caching (80%+ coverage)
- E2E test: worker upload → coordinator approval → notification happy path
- Mobile device testing on iPhone 12+, Samsung Galaxy S20+, iPad
- Lighthouse Performance ≥75 on 4G throttle
- All Phase 4 acceptance criteria verified"
```

---

## Dependencies & Reusable Assets

**From Phase 1–3 (already exist, no changes needed):**
- `backend/src/lib/auth.js` — Unified auth helpers (workerAuthMiddleware)
- `backend/src/lib/encryption.js` — AES-256-GCM encrypt/decrypt
- `backend/src/lib/nodemailer.js` — Resend email service (extend with worker template)
- `backend/prisma/schema.prisma` — ExpiryAlert, FailedAlert, AuditLog, Worker, DocumentType, ComplianceDocument models
- `backend/src/services/cronService.js` — Daily 08:00 cron job infrastructure (extend, don't replace)
- `frontend/lib/api/worker.ts` — Existing worker API client helpers (update to return rejectionReason)

**From existing worker portal:**
- `backend/src/routes/worker-auth.js` — OTP + JWT (keep as-is)
- `frontend/app/worker-signin/page.tsx` — Worker login flow (keep as-is)
- Tailwind CSS styling (mobile-first breakpoints already in project)
- react-hot-toast for notifications (already in dependencies)

**No new dependencies required.** All work fits within existing tech stack.

---

## Performance Targets

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Portal load time (4G) | <2s | Lighthouse DevTools, 4G Slow throttle |
| Compliance score calc | instant (client-side) | No network call, synchronous Math |
| Document upload | <500ms return (async OCR) | Measure HTTP 201 response time |
| Offline cache load | instant | From localStorage, no await |
| Notification send latency | <5s from cron trigger | Sentry logs sendWorkerExpiryAlert duration |
| Touch target size | ≥48px | DevTools mobile inspection |
| File size post-optimization | <2MB | Check optimized file size before upload |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Offline caching stale data | Medium | Worker sees outdated docs | Cache expires after 1h; refresh button shown |
| Multi-milestone cron overload | Low | Resend rate limit | Free tier ~5k/month; <100 emails/sec during daily spike. Sentry monitors latency. |
| EXIF rotation not auto-corrected | Low | Camera photos upload sideways | HTML5 canvas auto-correction used; if fails, user can rotate manually (defer Vision API to Phase 5). |
| Network interruption during upload | Medium | User frustrated by retry queue | Auto-retry polling every 10s; notify on success. Max 1 queued upload (simpler UX). |
| Compliance score formula changes mid-phase | Low | Refactor needed | Formula is simple; if agency custom logic needed, move to backend API in Phase 5. |
| Coordinator UI for rejection reason not ready | Medium | Feature blocked | Defer rejection-reason UI to Phase 5 if Phase 3 coordinator dashboard not complete. Backend accepts it; frontend displays it. |

---

## Verification Checklist

- [ ] All 6 feature slices complete and tested
- [ ] Unit tests pass: 80%+ coverage (compliance scoring, offline helpers)
- [ ] E2E happy path test passes (upload → approval → notification)
- [ ] Mobile device testing done (iPhone, Android, tablet, desktop)
- [ ] Lighthouse Performance ≥75 on 4G throttle
- [ ] All 10 SPEC.md requirements verified met
- [ ] Atomic commits created after each slice
- [ ] Zero unhandled errors in Sentry
- [ ] Offline caching confirmed working (test without network)
- [ ] Notification emails delivered and clickable
- [ ] Rejection feedback workflow end-to-end tested
- [ ] Audit log captures all worker actions
- [ ] No breaking changes to existing APIs
- [ ] Documentation updated if needed (CLAUDE.md)

---

## Success Criteria

**Phase 4 Complete When:**

1. **User-Facing Features:**
   - ✓ Worker can take photo on mobile, upload instantly, see it in document list with encryption
   - ✓ Compliance score (0–100%) displayed prominently with color-coded status
   - ✓ Checklist shows "X of Y required documents complete" with visual progress
   - ✓ Worker receives email reminders at 90/60/30/14/7/3/1 day and expiry date milestones
   - ✓ Rejected documents show reason; worker can re-upload
   - ✓ Offline: document list visible without internet; uploads queue and retry automatically

2. **Quality & Performance:**
   - ✓ Portal loads <2s on 4G
   - ✓ All touch targets ≥48px (WCAG mobile)
   - ✓ Lighthouse Performance ≥75 on 4G throttle
   - ✓ No horizontal scrolling on mobile
   - ✓ Works on iPhone 12+, Samsung Galaxy S20+, iPad, desktop

3. **Testing & Audit:**
   - ✓ Unit tests: 80%+ coverage (compliance, offline)
   - ✓ E2E happy path: upload → approval → notification
   - ✓ All worker actions logged to AuditLog with timestamp, IP, user agent
   - ✓ Zero unhandled errors in Sentry
   - ✓ Notification pipeline tested: 8 milestones, no duplicates, DLQ retry works

4. **Code Quality:**
   - ✓ No silent failures; all errors shown with actionable messages
   - ✓ All 10 SPEC.md acceptance criteria verified met
   - ✓ Atomic commits for each feature slice
   - ✓ Code follows project conventions (Tailwind, TypeScript, Prisma patterns)

---

## Next Steps (After Phase 4 Complete)

- [ ] User testing with real workers (usability feedback)
- [ ] Coordinator dashboard enhancements (Phase 5): rejection reason UI, bulk ops, filtering
- [ ] Advanced notifications (Phase 5): Push notifications, SMS, digest mode, worker preferences
- [ ] Document versioning (Phase 5): History timeline, show all rejected versions
- [ ] Service Worker upgrade (Phase 5): True offline-first PWA for workers with poor connectivity
- [ ] Performance optimization (Phase 5): Image CDN, code splitting, service worker caching
- [ ] Analytics (Phase 5): Track worker engagement, notification click-through rates, adoption metrics

---

## Appendix: Code References

**Critical files to read before starting:**

1. `./frontend/app/worker/dashboard/page.tsx` — Current implementation (227 lines, desktop-first)
2. `./backend/src/routes/worker-documents.js` — Worker upload/download API
3. `./backend/src/services/cronService.js` — Cron job infrastructure
4. `./backend/prisma/schema.prisma` — Data models (Worker, DocumentType, ComplianceDocument, ExpiryAlert)
5. `.planning/04-CONTEXT.md` — Implementation decisions (mobile-first, camera capture, offline, notifications, rejection feedback)
6. `.planning/04-SPEC.md` — 10 locked requirements with acceptance criteria

**API Endpoints (backend provides, frontend consumes):**

| Endpoint | Method | Purpose | Auth | Status |
|----------|--------|---------|------|--------|
| `/api/worker/documents` | GET | Fetch worker's documents | JWT | Existing (enhance: add rejectionReason) |
| `/api/worker/documents/upload` | POST | Upload new document | JWT | Existing |
| `/api/worker/document-types` | GET | Fetch agency document types | JWT | **New** (Task 2.2) |
| `/api/documents/:id/download` | GET | Download encrypted document | JWT | Existing |
| `/api/audit-log` | GET | Fetch agency audit log | JWT (admin) | Existing |

**Schemas (Prisma):**

- `ComplianceDocument` — id, agencyId, workerId, documentTypeId, status, expiryDate, rejectionReason, encryptionAlgorithm, ...
- `DocumentType` — id, agencyId, name, isRequired, expiryWarningDays, hasExpiry
- `ExpiryAlert` — id, agencyId, workerId, complianceDocumentId, daysUntilExpiry, alertDate, alertDateOnly, isSent, @@unique([complianceDocumentId, daysUntilExpiry, alertDateOnly])
- `Worker` — id, agencyId, firstName, lastName, email, phone, status, ...
- `AuditLog` — id, agencyId, userId, action, entity, entityId, metadata, createdAt, ...

---

*Phase 4 PLAN.md locked and ready for execution. Start with Feature Slice 1 (Mobile + Camera). Reference CONTEXT.md and SPEC.md for any clarifications during implementation.*
