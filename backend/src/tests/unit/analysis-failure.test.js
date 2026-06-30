/**
 * Unit tests for recordAnalysisFailure — ensures document OCR/analysis failures
 * are visible (Sentry) and auditable (audit log) without leaking PII, and never
 * throw out of the background job.
 */

jest.mock('../../lib/prisma');
jest.mock('@sentry/node');

const prisma = require('../../lib/prisma');
const Sentry = require('@sentry/node');
const { recordAnalysisFailure } = require('../../lib/analysis-failure');

const DOC = { id: 'doc-1', agencyId: 'agency-1' };

describe('recordAnalysisFailure', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.complianceDocument = { update: jest.fn().mockResolvedValue({}) };
        prisma.auditLog = { create: jest.fn().mockResolvedValue({}) };
        Sentry.captureException = jest.fn();
    });

    it('marks the document FAILED', async () => {
        await recordAnalysisFailure(DOC, 'Decryption failed', new Error('bad key'));
        expect(prisma.complianceDocument.update).toHaveBeenCalledWith({
            where: { id: 'doc-1' },
            data: { status: 'FAILED', analysisResult: null },
        });
    });

    it('writes a document.ai_analysis_failed audit entry with the reason and no PII', async () => {
        await recordAnalysisFailure(DOC, 'OCR analysis error: timeout', new Error('x'));
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                agencyId: 'agency-1',
                action: 'document.ai_analysis_failed',
                entity: 'ComplianceDocument',
                entityId: 'doc-1',
                metadata: { reason: 'OCR analysis error: timeout' },
            }),
        });
        // Guard against PII leaking into the audit metadata.
        const meta = prisma.auditLog.create.mock.calls[0][0].data.metadata;
        expect(meta).not.toHaveProperty('fullName');
        expect(meta).not.toHaveProperty('documentNumber');
    });

    it('captures the error to Sentry when one is provided', async () => {
        const err = new Error('boom');
        await recordAnalysisFailure(DOC, 'Analysis exception', err);
        expect(Sentry.captureException).toHaveBeenCalledWith(
            err,
            expect.objectContaining({ tags: expect.objectContaining({ documentId: 'doc-1', agencyId: 'agency-1' }) })
        );
    });

    it('does not call Sentry when there is no error object (handled rejection)', async () => {
        await recordAnalysisFailure(DOC, 'Unsupported file type: .exe');
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).toHaveBeenCalled(); // still audited
    });

    it('never throws even if the DB writes fail', async () => {
        prisma.complianceDocument.update.mockRejectedValue(new Error('db down'));
        prisma.auditLog.create.mockRejectedValue(new Error('db down'));
        await expect(recordAnalysisFailure(DOC, 'Decryption failed', new Error('x'))).resolves.toBeUndefined();
    });
});
