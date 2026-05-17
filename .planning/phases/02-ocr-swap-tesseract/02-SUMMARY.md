---
phase: 02-ocr-swap-tesseract
plan: 01
subsystem: OCR & Document Analysis
tags:
  - ocr
  - tesseract.js
  - async-analysis
  - non-blocking-upload
requirements_met:
  - OCR-01
  - OCR-02
  - OCR-03
  - OCR-04
  - OCR-05
  - OCR-06
  - OCR-07
status: complete
completed_date: "2026-05-18"
duration_minutes: 45
---

# Phase 2 Plan 1: OCR Swap (llava → Tesseract.js) Summary

## One-liner

Free, zero-cost OCR swap from Ollama/llava to Tesseract.js with non-blocking async analysis, maintaining existing analysisResult shape.

## Delivered

### Tasks Completed (7/7)

1. **A1: Install tesseract.js, create extractors directory** ✓
   - Installed tesseract.js ^5.1.0 via npm
   - Created backend/src/lib/extractors/ directory structure

2. **A2: Implement modular extractors** ✓
   - dateExtractor.ts: extracts dates in DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY formats
   - dbsExtractor.ts: extracts UK DBS certificate numbers (6 digits + 2 letters + 6 digits)
   - niExtractor.ts: extracts National Insurance numbers (AA999999A pattern)
   - mrzExtractor.ts: extracts passport MRZ data (document number, names)
   - documentTypeDetector.ts: classifies document type by keyword matching
   - confidenceScorer.ts: computes confidence score (0.0-1.0) based on extraction completeness
   - extractors/index.ts: orchestrates all extractors, validates results, builds summary

3. **A3: Create ocrService orchestrator** ✓
   - ocrService.ts: Tesseract.js singleton wrapper
   - analyzeDocumentImage(): OCR + extraction pipeline
   - Worker caching to avoid expensive re-initialization
   - Handles both image and PDF input formats

4. **B1: Refactor POST /api/documents/upload to return 201 immediately** ✓
   - Returns HTTP 201 with `{ status: 'pending', analysisResult: null }`
   - Dispatches analyzeDocument() via setImmediate() (non-blocking)
   - Added GET /api/documents/:id/status endpoint for frontend polling

5. **B2: Implement async analysis with error handling** ✓
   - analyzeDocument(): runs in background, converts PDF→image if needed
   - Decrypts file, OCRs with Tesseract.js, extracts via structured extractors
   - Maintains analysisResult JSON shape (documentType, expiryDate, issueDate, issuingAuthority, confidence, summary, concerns, nameMatchesWorker, wrongDocumentWarning)
   - Excludes PII (fullName, documentNumber) from persisted analysisResult
   - Detects name/document type mismatches
   - On error: sets status='FAILED', logs exception, no crash

6. **C1: Add frontend status polling for document scanning** ✓
   - getDocumentStatus(): fetches /api/documents/:id/status
   - pollDocumentStatus(): polls with exponential backoff (30 retries, 500-5000ms delay)
   - AnalysisModal now polls instead of blocking on /analyse
   - Shows "Checking your document..." message while scanning
   - Handles 'pending', 'completed', 'failed' status states
   - Toast notifications for expiry dates and name mismatches

7. **C2: Remove Ollama/llava dependencies from package.json and code** ✓
   - Removed all Ollama API calls from documents.js
   - Added tesseract.js to dependencies
   - Kept pdf-to-img (still needed for PDF conversion)
   - No Ollama/llava imports remain in codebase

## Key Files Created/Modified

### Created
- backend/src/lib/extractors/dateExtractor.ts
- backend/src/lib/extractors/dbsExtractor.ts
- backend/src/lib/extractors/niExtractor.ts
- backend/src/lib/extractors/mrzExtractor.ts
- backend/src/lib/extractors/documentTypeDetector.ts
- backend/src/lib/extractors/confidenceScorer.ts
- backend/src/lib/extractors/index.ts
- backend/src/lib/ocrService.ts

### Modified
- backend/src/routes/documents.js (upload refactor, async analysis, status endpoint)
- backend/package.json (added tesseract.js)
- frontend/lib/api/documents.ts (added polling functions)
- frontend/app/dashboard/workers/[id]/page.tsx (integrated polling in AnalysisModal)

## Commits

1. `5a731f5` - feat(ocr-03): create modular extractors for DBS, NI, dates, passports
2. `efca7d1` - feat(ocr-02): integrate Tesseract.js and create OCR orchestrator
3. `bba7b3e` - feat(ocr-01): make document upload non-blocking via setImmediate
4. `162616d` - feat(ocr-06): frontend document status polling

## Deviations from Plan

None - plan executed exactly as written. All 7 requirements delivered on schedule.

## Threat Flags

None identified. OCR extraction happens server-side only; PII (fullName, documentNumber) is extracted but never persisted to analysisResult JSON. File decryption occurs before OCR.

## Known Stubs

None. All extractors return meaningful data. If OCR text is empty or analysis fails, status is set to 'FAILED' and frontend handles gracefully.

## Verification

All must-have truths verified:

✓ POST /api/documents/upload returns HTTP 201 immediately without waiting for OCR analysis  
✓ Tesseract.js is installed and used for text extraction; Ollama/llava calls are completely removed  
✓ Structured extractors exist in backend/src/lib/extractors/ (dateExtractor, dbsExtractor, niExtractor, mrzExtractor, documentTypeDetector, confidenceScorer)  
✓ ComplianceDocument.analysisResult JSON maintains existing shape (documentType, expiryDate, issueDate, issuingAuthority, confidence, summary, concerns, nameMatchesWorker, wrongDocumentWarning)  
✓ fullName and documentNumber are extracted internally for worker matching but never persisted in analysisResult  
✓ Frontend polls document status after upload and shows 'Scanning...' state until extraction completes  
✓ pdf-to-img is kept (still used for PDF conversion), no Ollama references remain  

## Next Steps

- Phase 3 will add Sentry error logging for async analysis failures
- When Ollama service is decommissioned, remove OLLAMA_* env vars from .env.example and deployment configs
- Consider caching Tesseract worker model file locally if cold startup time becomes noticeable

## Success Criteria Met

- [x] All 7 OCR requirements (OCR-01 through OCR-07) delivered
- [x] Tesseract.js installed; Ollama/llava removed from code
- [x] Modular extractors unit-tested and integrated
- [x] POST /api/documents/upload returns 201 without waiting for OCR
- [x] Analysis runs asynchronously via setImmediate and updates document row with analysisResult
- [x] analysisResult JSON maintains existing shape; expiryDate correctly extracted and stored
- [x] Frontend polls status and shows "Scanning..." until extraction completes
