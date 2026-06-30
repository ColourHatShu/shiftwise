# Phase 2 Context — OCR Swap (llava → Tesseract.js)

**Date:** 2026-05-18  
**Phase:** 02 — OCR Swap (llava → Tesseract.js)  
**Goal:** Replace Ollama/llava-based AI extraction with free, zero-cost Tesseract.js + regex extractors. Preserve existing analysis result shape so frontend and alert logic work unchanged. Non-blocking upload (201 immediate, extraction async via setImmediate).

---

## Domain

This phase replaces the AI/OCR engine with a free alternative and structured regex extractors. User sees: same features (upload → scan → expiry tracking), but faster (no Ollama round-trip), more reliable (regex on known UK document formats), and zero-cost (Tesseract.js is open-source).

---

## Decisions (Locked)

### OCR Engine Choice: Tesseract.js

**Why:** Ollama/llava requires a separate service, inference latency, and unpredictable output. Tesseract.js is:
- Free, open-source, runs in Node.js process
- Fast for UK healthcare documents (DBS, Right to Work, training certs)
- Deterministic output (plain text, no JSON hallucination)
- No external services or Docker dependency
- Already available: `npm list tesseract.js` in existing codebase

**How to apply:** Replace `pdf-to-img` + Ollama call with:
1. PDF first page → image (reuse existing `pdf-to-img` or `pdfjs` pattern)
2. Image → text via `await Tesseract.recognize(image)`
3. Text → structured data via regex extractors

---

### Non-Blocking Upload Pattern

**Decision:** Upload endpoint returns `HTTP 201` immediately. OCR/extraction happens asynchronously via `setImmediate()`.

**Why:** User doesn't wait for OCR (UX improvement). If OCR fails, we have the file and can retry. Async keeps request/response cycle clean.

**How to apply:**
- `POST /api/documents/upload` returns `{ id, filename, status: 'pending', analysisResult: null }`
- Body: `const extractAsync = () => setImmediate(async () => { const result = await analyzeDocument(...); await prisma.complianceDocument.update({ data: { analysisResult: result } }) }); extractAsync();`
- Frontend polls document status or uses existing review-modal flow to catch when extraction completes

---

### Analysis Result Shape (Unchanged)

**Decision:** Preserve existing `ComplianceDocument.analysisResult` JSON structure so frontend + alert logic work unchanged.

```json
{
  "documentType": "DBS_CERTIFICATE" | "RIGHT_TO_WORK" | "TRAINING_CERT" | "PASSPORT" | "NI_CARD" | "OTHER",
  "expiryDate": "YYYY-MM-DD" | null,
  "issueDate": "YYYY-MM-DD" | null,
  "issuingAuthority": "string" | null,
  "confidence": 0.0-1.0,
  "summary": "human-readable summary",
  "concerns": ["concern1", "concern2"],
  "nameMatchesWorker": boolean,
  "wrongDocumentWarning": boolean
}
```

**Why:** Zero frontend changes. `ComplianceDocument.expiryDate` is already populated from this field, alert logic is already tied to it.

**How to apply:** Each extractor (date, DBS, MRZ, NI, etc.) returns a fragment; merge fragments into this shape.

---

### Structured Extractors (Regex-based)

**Decision:** Create `backend/src/lib/extractors/` with specialized, regex-based parsers for each UK document type. No AI/ML, no fuzzy matching.

**Why:** Tesseract OCR output is plain text; regex on known formats (UK DBS cert numbers, NI numbers, expiry date patterns) is deterministic and fast.

**How to apply:**

```
backend/src/lib/extractors/
├── index.ts              (orchestrate extractors based on document type)
├── dateExtractor.ts      (regex: DD/MM/YYYY, YYYY-MM-DD patterns)
├── dbsExtractor.ts       (DBS cert #: /\d{6}[A-Z]{2}\d{6}/)
├── niExtractor.ts        (NI #: /[A-Z]{2}\d{6}[A-Z]/)
├── mrzExtractor.ts       (Passport MRZ lines 2-3)
├── documentTypeDetector.ts (keyword match: "DBS", "Right to Work", "Training", etc.)
└── confidenceScorer.ts   (keyword presence, format match → 0.0-1.0)
```

Each extractor returns a partial result; main `analyzeDocument()` merges them.

---

### PII Extraction (No Persistence)

**Decision:** Extract `fullName` and `documentNumber` internally for matching against `Worker` record, but **never persist** in `analysisResult` JSON.

**Why:** PII minimization. Analysis result is audit-logged and queryable; names should not be stored there.

**How to apply:**
- `analyzeDocument()` extracts name + doc number
- Use for `Worker.name` matching → set `nameMatchesWorker: true/false`
- Do NOT write name/number to `analysisResult` JSON
- Return only `{ documentType, expiryDate, ..., nameMatchesWorker, wrongDocumentWarning }`

---

### PDF Handling

**Decision:** Reuse existing PDF-to-image logic (if present). If not, use `pdfjs-dist` to extract first page as image, then OCR.

**Why:** PDFs need rasterization for Tesseract. Existing codebase may already have this pattern.

**How to apply:**
- Check if `pdf-to-img` or similar exists in current code
- If yes: use it
- If no: install `pdfjs-dist`, extract first page canvas, convert to PNG buffer, feed to Tesseract
- No dependency on Ollama

---

### Async Error Handling

**Decision:** If OCR/extraction fails, set `analysisResult: null`, `analysisError: { code, message }` in a new optional field (or log to audit trail).

**Why:** Upload still succeeds; admin can retry or manually review. Non-blocking async means failures are isolated.

**How to apply:**
- Wrap `extractAsync()` in try/catch
- On error: `await prisma.complianceDocument.update({ data: { analysisResult: null } })` (or add `analysisError` field if schema allows)
- Log to console + Sentry (Phase 3)
- Frontend shows "Scan failed, manual review required"

---

### Removal of Ollama/llava Dependencies

**Decision:** Delete `pdf-to-img`, `fetchWithRetry` (if only used for Ollama), Ollama config from `package.json` once new pipeline is live and tested.

**Why:** Clean up dead code. Reduce image size, dependencies, attack surface.

**How to apply:**
- After OCR-07 task: `npm uninstall pdf-to-img` (or keep if still used elsewhere)
- Remove `OLLAMA_BASE_URL`, `OLLAMA_MODEL` from `.env.example`
- Remove Ollama call from `backend/src/routes/documents.js`
- Verify `npm audit` still passes

---

## Code Context

### Existing Assets

**Document upload endpoint** (`backend/src/routes/documents.js`):
- `POST /api/documents/upload` — handles file + worker metadata
- Currently calls `analyzeDocument()` which hits Ollama
- Will refactor to call async Tesseract-based `analyzeDocument()`

**Analysis result** in schema (`backend/prisma/schema.prisma`):
- `ComplianceDocument.analysisResult Json?` — already exists, shape locked
- `ComplianceDocument.expiryDate DateTime?` — computed from analysisResult.expiryDate
- Alert logic keyed off expiryDate

**Existing extractors** (if any):
- Check `backend/src/lib/` for patterns (regex, date parsing, etc.)
- Reuse existing utility functions (date normalization, etc.)

---

## Canonical References

- `.planning/REQUIREMENTS.md` — OCR-01 through OCR-07
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria
- `backend/src/routes/documents.js` — upload endpoint, analyzeDocument call
- `backend/prisma/schema.prisma` — ComplianceDocument shape
- `backend/src/lib/encryption.js` — patterns for structured modules (reuse this style for extractors)
- `backend/src/services/cronService.js` — uses `expiryDate` for alert logic (verify it works with null expiryDate during extraction)

---

## Specifics / Notes

**Tesseract.js setup:**
- `npm install tesseract.js`
- Initialize worker: `const { createWorker } = require('tesseract.js')` (or import)
- First-page PDF → image can use existing pattern or `pdfjs-dist` for parsing
- OCR is CPU-bound; setImmediate defers heavy work

**Backward compatibility:**
- Existing documents with old Ollama-extracted analysisResult continue working (no schema migration needed)
- New uploads follow Tesseract + regex pattern
- Analysis result shape is identical; no frontend changes

**Testing strategy:**
- Unit tests for each extractor (test regex on sample OCR'd text)
- Integration test: upload real DBS/Right to Work scans, verify expiryDate extracted
- Frontend polling: verify status transitions from `pending` → `completed` or `failed`

---

## Deferred Ideas

- Handwriting recognition (Tesseract can attempt, but unreliable on UK forms)
- Barcode/QR code scanning (separate library, out of scope)
- Multi-page document processing (Phase 3 or later)
- Tesseract training on UK-specific fonts (if accuracy drops)
- Async job queue (Bull, Bullmq) instead of setImmediate — keep simple for now

