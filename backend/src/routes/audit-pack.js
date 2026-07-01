const express = require('express');
const Sentry = require('@sentry/node');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency, requireRole } = require('../lib/auth');
const {
  generateAuditPack,
  generateComplianceReport,
  generateSnapshot,
  bulkExport,
  downloadAuditPack,
  cleanupExpiredPacks
} = require('../lib/audit-pack-service');

const router = express.Router();

// Only OWNER/ADMIN can export audit packs and reports
router.use(requireAgency);
router.use(requireRole(['OWNER', 'ADMIN']));

/**
 * POST /api/agency/audit-pack/{workerId}
 * R-AP-01: Generate single-worker audit pack (ZIP)
 * <10s generation, contains docs + audit log + compliance summary
 */
router.post('/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    const { agencyId } = req;

    // Validate worker exists and belongs to agency
    const worker = await prisma.worker.findFirst({
      where: { id: workerId, agencyId }
    });

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Generate audit pack
    const pack = await generateAuditPack(workerId, agencyId);

    res.status(201).json({
      success: true,
      data: {
        packId: pack.packId,
        filePath: pack.filePath,
        fileSize: pack.fileSize,
        duration: pack.duration,
        expiresAt: pack.expiresAt,
        docCount: pack.docCount,
        logCount: pack.logCount,
        downloadUrl: `/api/agency/audit-pack/download/${pack.packId}`
      }
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error generating audit pack');
    Sentry.captureException(error, {
      tags: { context: 'auditPackGenerate' }
    });
    res.status(500).json({ error: error.message || 'Failed to generate audit pack' });
  }
});

/**
 * POST /api/agency/audit-pack/bulk
 * R-AP-07: Bulk export for multiple workers
 * <10s for 10+ workers, clear ZIP structure
 */
router.post('/bulk/export', async (req, res) => {
  try {
    const { workerIds } = req.body;
    const { agencyId } = req;

    if (!Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({ error: 'workerIds array required' });
    }

    if (workerIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 workers per bulk export' });
    }

    // Generate bulk export
    const pack = await bulkExport(agencyId, workerIds);

    res.status(201).json({
      success: true,
      data: {
        packId: pack.packId,
        fileSize: pack.fileSize,
        duration: pack.duration,
        expiresAt: pack.expiresAt,
        workerCount: pack.workerCount,
        downloadUrl: `/api/agency/audit-pack/download/${pack.packId}`
      }
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error generating bulk export');
    Sentry.captureException(error, {
      tags: { context: 'bulkExportGenerate' }
    });
    res.status(500).json({ error: error.message || 'Failed to generate bulk export' });
  }
});

/**
 * POST /api/agency/compliance-report
 * R-AP-02: Generate agency-wide compliance report (PDF)
 * <5s for 200 workers, includes all workers + scores
 */
router.post('/report/generate', async (req, res) => {
  try {
    const { agencyId } = req;

    // Generate report
    const result = await generateComplianceReport(agencyId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="compliance-report-${new Date().toISOString().split('T')[0]}.pdf"`
    );

    res.send(result.buffer);
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error generating compliance report');
    Sentry.captureException(error, {
      tags: { context: 'complianceReportGenerate' }
    });
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

/**
 * GET /api/agency/compliance-snapshot
 * R-AP-04: Get compliance snapshot (immutable point-in-time state)
 * Returns JSON snapshot with worker list, scores, document statuses
 */
router.get('/snapshot', async (req, res) => {
  try {
    const { agencyId } = req;

    // Generate snapshot
    const snapshot = await generateSnapshot(agencyId);

    res.status(200).json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error generating snapshot');
    Sentry.captureException(error, {
      tags: { context: 'snapshotGenerate' }
    });
    res.status(500).json({ error: error.message || 'Failed to generate snapshot' });
  }
});

/**
 * GET /api/agency/audit-pack/download/:packId
 * Download an audit pack file
 * Expires after 7 days
 */
router.get('/download/:packId', async (req, res) => {
  try {
    const { packId } = req.params;

    const pack = await downloadAuditPack(packId, req.agencyId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${pack.fileName}"`);

    pack.stream.pipe(res);
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error downloading audit pack');
    Sentry.captureException(error, {
      tags: { context: 'auditPackDownload' }
    });
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message || 'Failed to download audit pack'
    });
  }
});

/**
 * POST /api/agency/audit-pack/cleanup
 * Manual cleanup of expired audit packs
 * (Normally done by cron, but exposed for admin use)
 */
router.post('/cleanup/expired', async (req, res) => {
  try {
    const { agencyId } = req;

    const result = await cleanupExpiredPacks(168); // 7 days

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        message: `Cleaned up ${result.deletedCount} expired audit packs`
      }
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error cleaning up expired packs');
    Sentry.captureException(error, {
      tags: { context: 'cleanupExpiredPacks' }
    });
    res.status(500).json({ error: error.message || 'Failed to cleanup expired packs' });
  }
});

module.exports = router;
