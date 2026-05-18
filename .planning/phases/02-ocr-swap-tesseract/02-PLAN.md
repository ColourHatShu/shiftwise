---
phase: 02-ocr-swap-tesseract
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/lib/extractors/index.ts
  - backend/src/lib/extractors/dateExtractor.ts
  - backend/src/lib/extractors/dbsExtractor.ts
  - backend/src/lib/extractors/niExtractor.ts
  - backend/src/lib/extractors/mrzExtractor.ts
  - backend/src/lib/extractors/documentTypeDetector.ts
  - backend/src/lib/extractors/confidenceScorer.ts
  - backend/src/routes/documents.js
  - backend/src/lib/ocrService.ts
  - backend/package.json
  - frontend/lib/api/documents.ts
  - frontend/components/DocumentUpload.tsx
  - frontend/app/dashboard/workers/[id]/page.tsx
autonomous: false
requirements:
  - OCR-01
  - OCR-02
  - OCR-03
  - OCR-04
  - OCR-05
  - OCR-06
  - OCR-07

must_haves:
  truths:
    - "POST /api/documents/upload returns HTTP 201 immediately without waiting for OCR analysis"
    - "Tesseract.js is installed and used for text extraction; Ollama/llava calls are completely removed"
    - "Structured extractors exist in backend/src/lib/extractors/ (dateExtractor, dbsExtractor, niExtractor, mrzExtractor, documentTypeDetector, confidenceScorer)"
    - "ComplianceDocument.analysisResult JSON maintains existing shape (documentType, expiryDate, issueDate, issuingAuthority, confidence, summary, concerns, nameMatchesWorker, wrongDocumentWarning)"
    - "fullName and documentNumber are extracted internally for worker matching but never persisted in analysisResult"
    - "Frontend polls document status after upload and shows 'Scanning...' state until extraction completes"
    - "pdf-to-img, Ollama config, and llava references are completely removed from package.json and codebase"
---

# Phase 2 Plan — OCR Swap (llava → Tesseract.js)

**Goal:** Replace Ollama/llava with free Tesseract.js + regex extractors. Preserve analysis result shape. Non-blocking upload with async OCR via setImmediate.

**Requirements:** 7 (OCR-01 through OCR-07)

**Task Structure:** 7 tasks grouped into 3 categories, dependency-ordered

## Task Breakdown (execution order)

### A: Foundation — Extractors Setup (3 tasks)
- **A1** (auto): Install tesseract.js, create `backend/src/lib/extractors/` directory structure
- **A2** (TDD): Implement modular extractors (dateExtractor, dbsExtractor, niExtractor, mrzExtractor, documentTypeDetector, confidenceScorer)
- **A3** (auto): Create `backend/src/lib/ocrService.ts` orchestrator that calls Tesseract + routes to extractors

### B: Integration — Upload & Analysis (2 tasks)
- **B1** (auto): Refactor `POST /api/documents/upload` to return 201 immediately; dispatch `analyzeDocument()` via setImmediate
- **B2** (TDD): Implement async analysis with error handling (set `analysisResult: null` on failure, log to audit trail)

### C: Frontend & Cleanup (2 tasks)
- **C1** (auto): Update frontend polling: document status endpoint returns `{ status: 'pending'|'completed'|'failed', analysisResult: {...} }`
- **C2** (auto): Remove Ollama/llava dependencies: delete `pdf-to-img` refs, remove Ollama env vars, verify no llava imports remain

## Dependency Graph

```
A1 → A2 → A3 → B1 → B2
                     └── C1
                     └── C2
```

**Key blocking edges:**
- A2 must finish before A3 (extractors must exist before orchestrator wires them)
- A3 must finish before B1 (ocrService must exist before upload refactor)
- B2 must finish before C1 (async analysis must work before frontend polls status)

## Verification Gates (automated + manual)

| Task | Gate Type | Command/How |
|------|-----------|------------|
| A1 | Automated | npm list tesseract.js → installed; find backend/src/lib/extractors/ → directory exists |
| A2 | Unit test | extractors.test.ts: dateExtractor on "23/05/2025", dbsExtractor on "123456AB789012", etc. → correct results |
| A3 | Unit test | ocrService.test.ts: mock Tesseract, verify orchestrator merges extractor results into analysisResult shape |
| B1 | Integration test | POST /api/documents/upload returns 201 with `{ id, analysisResult: null, status: 'pending' }` |
| B2 | Integration test | After 2-3s, document status → `completed`, analysisResult has expiryDate extracted |
| C1 | Automated | grep -r "pdf-to-img\|Ollama\|llava" backend/src/ → 0 matches (post-C2) |
| C2 | Automated | npm audit → no unresolved vulnerabilities; package.json has no `pdf-to-img` or Ollama config |

## Atomic Commits (7 total)

1. `feat(ocr-03): create modular extractors for DBS, NI, dates, passports` (A1+A2)
2. `feat(ocr-02): integrate Tesseract.js and create OCR orchestrator` (A3)
3. `feat(ocr-01): make document upload non-blocking via setImmediate` (B1)
4. `feat(ocr-01,ocr-04,ocr-05): async analysis with existing analysisResult shape` (B2)
5. `feat(ocr-06): frontend document status polling` (C1)
6. `chore(ocr-07): remove Ollama/llava dependencies` (C2)

## Key Gotchas

- **Tesseract.js initialization:** First call is slow (worker startup). Cache the worker instance globally or use a singleton.
- **PDF-to-image:** Check existing codebase for pdf-to-img usage. If it's only in the old Ollama path, delete it entirely; if used elsewhere, keep it.
- **Async error handling:** setImmediate errors won't bubble to the request/response cycle. Wrap in try/catch, log to Sentry (Phase 3) or audit trail, update document row to mark failure.
- **Status field on ComplianceDocument:** May need to add `status: 'pending' | 'completed' | 'failed'` to schema if not present. Check schema before B1.
- **Empty analysisResult during extraction:** expiryDate will be null while extraction is in progress. Alert logic should skip null expiryDates (already does in Phase 1).
- **Confidence scoring:** Regex matching has varying confidence (date format match = high, keyword presence = medium, text length = low). Extractor should return 0.0-1.0; merge into final confidence.
- **Deferred Ollama removal:** Only delete pdf-to-img if confirmed it's not used elsewhere (grep for it first in C2).

## Files Touched (by task)

| Task | Files |
|------|-------|
| A1 | package.json (install tesseract.js) |
| A2 | backend/src/lib/extractors/{index,dateExtractor,dbsExtractor,niExtractor,mrzExtractor,documentTypeDetector,confidenceScorer}.ts, backend/src/tests/unit/extractors.test.ts |
| A3 | backend/src/lib/ocrService.ts, backend/src/tests/unit/ocrService.test.ts |
| B1 | backend/src/routes/documents.js (refactor upload endpoint) |
| B2 | backend/src/routes/documents.js (add async analysis + error handling), backend/src/tests/integration/ocr.test.ts |
| C1 | frontend/lib/api/documents.ts (add status polling), frontend/components/DocumentUpload.tsx (show scan status), backend/src/routes/documents.js (add status endpoint) |
| C2 | backend/src/routes/documents.js (remove Ollama call), package.json (remove pdf-to-img, Ollama env vars), .env.example |

## Success Criteria (End of Phase)

1. ✓ Tesseract.js installed; Ollama/llava removed from dependencies
2. ✓ Modular extractors exist and are unit-tested (dateExtractor, dbsExtractor, niExtractor, etc.)
3. ✓ POST /api/documents/upload returns 201 without waiting for OCR
4. ✓ Analysis runs asynchronously via setImmediate and updates document row with analysisResult
5. ✓ analysisResult JSON maintains existing shape; expiryDate is correctly extracted and stored
6. ✓ Frontend polls status and shows "Scanning..." until extraction completes
7. ✓ All 7 OCR requirements (OCR-01 through OCR-07) delivered

All 7 REQs delivered, all success criteria met, zero dependencies on Ollama.

