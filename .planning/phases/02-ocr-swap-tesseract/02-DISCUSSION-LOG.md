# Phase 2 Discussion Log

**Date:** 2026-05-18  
**Participants:** User + Claude (Haiku, Autonomous Mode)  
**Status:** Complete

---

## Summary

Phase 2 scope is fixed (7 OCR requirements: OCR-01 through OCR-07). Gray areas identified and autonomously resolved based on zero-cost constraint and project goals.

---

## Gray Areas Discussed

### 1. OCR Engine Selection

**Question:** Ollama/llava or free alternative?

**Constraints:**
- Zero-cost (no paid APIs)
- Solo developer (no extra infra to maintain)
- Deterministic output (reliability > magic)

**Decision:** Tesseract.js (open-source, free, runs in Node.js process)

**Rationale:** Ollama requires Docker/separate service. Tesseract.js is self-contained, fast for UK healthcare documents, and produces plain text (no hallucination). Regex extractors on known UK formats are more reliable than LLM guessing.

**Outcome:** OCR-02 constraint: `tesseract.js` replaces `pdf-to-img` + Ollama.

---

### 2. Upload Blocking Behavior

**Question:** Should upload block until OCR completes, or return immediately?

**Options:**
- Block: user waits 2-5s, gets full result, simpler code
- Non-blocking: return 201 immediately, extraction async via setImmediate

**Decision:** Non-blocking (setImmediate pattern)

**Rationale:** Better UX (no wait). Failures are isolated. Async aligns with Phase 1 goal ("non-blocking AI scan via setImmediate"). Existing review-modal flow already has polling built in.

**Outcome:** OCR-01 constraint: Upload returns 201 immediately. Analysis is asynchronous via setImmediate.

---

### 3. Analysis Result Shape

**Question:** Change the JSON structure for Tesseract, or preserve existing shape?

**Options:**
- New shape: optimized for Tesseract, but breaks frontend + alert logic
- Preserve: extra merge step in extractors, but zero frontend changes

**Decision:** Preserve existing shape

**Rationale:** Frontend and cron alert logic are already tied to the current `analysisResult` JSON. Changing it requires phase 2+ refactoring. Preserving it means phase 2 is purely backend (OCR swap), not a full rearchitecture.

**Outcome:** OCR-04 constraint: Extract via Tesseract + regex, merge into existing JSON shape.

---

### 4. Extractor Architecture

**Question:** Monolithic analyzeDocument() or modular extractors?

**Options:**
- Monolithic: simpler code, harder to test/extend
- Modular (backend/src/lib/extractors/): one module per document type, cleaner

**Decision:** Modular extractors in `backend/src/lib/extractors/`

**Rationale:** UK healthcare documents have well-defined formats (DBS cert #s, NI numbers, passport MRZ). Regex extractors are testable, reusable, and maintainable. Matches codebase style (e.g., separate lib modules).

**Outcome:** OCR-03 constraint: Structured extractors (dateExtractor, dbsExtractor, niExtractor, mrzExtractor, documentTypeDetector, confidenceScorer) in separate modules.

---

### 5. PII Handling

**Question:** Extract and persist fullName / documentNumber in analysisResult, or internal-only?

**Options:**
- Persist: easier to debug, but PII in audit logs
- Internal-only: extract for worker matching, don't persist

**Decision:** Internal-only (extract, use for `nameMatchesWorker` flag, discard from JSON)

**Rationale:** PII minimization. Analysis result is audit-logged. Storing names there is unnecessary risk. Use the extracted name for matching, set boolean flag, move on.

**Outcome:** OCR-05 constraint: PII extraction is internal; analysisResult keeps only `documentType`, `expiryDate`, etc., not names.

---

### 6. PDF Handling

**Question:** Keep existing PDF-to-image, or replace with new approach?

**Decision:** Reuse existing PDF pattern (pdf-to-img if present, else pdfjs-dist)

**Rationale:** No need to reinvent. First page → image is a solved problem. Feed image to Tesseract.

**Outcome:** OCR-02 constraint: PDF first-page rendering unchanged. OCR is on the image.

---

## Deferred Ideas

- Handwriting recognition (unreliable on forms)
- Barcode/QR code scanning (separate library, not priority)
- Multi-page document processing (Phase 3 or later)
- Tesseract training on UK fonts (if accuracy drops, revisit)
- Async job queue (Bull, Bullmq) instead of setImmediate (keep simple for MVP)
