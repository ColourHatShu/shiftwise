const prisma = require('./prisma');
const Sentry = require('@sentry/node');

/**
 * Record a document OCR/analysis failure in a way that's visible + auditable:
 *   1. mark the document FAILED,
 *   2. capture the error to Sentry (if one was thrown),
 *   3. write a `document.ai_analysis_failed` audit entry (reason only — NO PII).
 *
 * Never throws — failure handling must not crash the background analysis job.
 * `doc` must carry { id, agencyId }.
 */
async function recordAnalysisFailure(doc, reason, error = null) {
    console.error(`[Async OCR] ${reason} (document ${doc.id})`, error && error.message ? `- ${error.message}` : '');

    if (error) {
        try {
            Sentry.captureException(error, {
                tags: { documentId: doc.id, agencyId: doc.agencyId, context: 'document.ai-analysis' },
                extra: { reason },
            });
        } catch (e) {
            // Telemetry must never crash the job.
            console.error('[Async OCR] Sentry capture failed:', e.message);
        }
    }

    try {
        await prisma.complianceDocument.update({
            where: { id: doc.id },
            data: { status: 'FAILED', analysisResult: null },
        });
    } catch (e) {
        console.error(`[Async OCR] Failed to set FAILED status for ${doc.id}:`, e.message);
    }

    try {
        await prisma.auditLog.create({
            data: {
                agencyId: doc.agencyId,
                userId: null,
                action: 'document.ai_analysis_failed',
                entity: 'ComplianceDocument',
                entityId: doc.id,
                metadata: { reason }, // reason only — never log extracted PII
            },
        });
    } catch (e) {
        console.error(`[Async OCR] Failed to write analysis-failure audit for ${doc.id}:`, e.message);
    }
}

/**
 * Record a detected identity mismatch (the name OCR-extracted from a document
 * doesn't match the worker it was uploaded for) as a `document.identity_mismatch_detected`
 * audit entry. Names only (expected vs detected) — never document numbers or
 * other extracted PII. Never throws. `doc` must carry { id, agencyId }.
 */
async function recordIdentityMismatch(doc, worker, detectedName) {
    const expectedName = `${worker.firstName || ''} ${worker.lastName || ''}`.trim();
    console.warn(`[Async OCR] Identity mismatch on document ${doc.id}: expected "${expectedName}", detected "${detectedName}"`);
    try {
        await prisma.auditLog.create({
            data: {
                agencyId: doc.agencyId,
                userId: null,
                action: 'document.identity_mismatch_detected',
                entity: 'ComplianceDocument',
                entityId: doc.id,
                metadata: { expectedName, detectedName }, // names only — no document numbers / other PII
            },
        });
    } catch (e) {
        console.error(`[Async OCR] Failed to write identity-mismatch audit for ${doc.id}:`, e.message);
    }
}

module.exports = { recordAnalysisFailure, recordIdentityMismatch };
