const express = require('express');
const Sentry = require('@sentry/node');
const { requireAgency, requireRole } = require('../lib/auth');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const {
    calculateScore,
    getWorkersWithScores,
    generateCSV,
    generatePDF,
    aggregateAlerts
} = require('../lib/compliance-service');

const router = express.Router();

// Simple in-memory cache for compliance data (60s TTL)
const cache = new Map();
const CACHE_TTL = 60000; // 60 seconds

function getCacheKey(agencyId, options) {
    const key = `compliance:${agencyId}:${JSON.stringify(options || {})}`;
    return key;
}

function isCacheValid(timestamp) {
    return Date.now() - timestamp < CACHE_TTL;
}

// Apply auth to all routes
router.use(requireAgency);

/**
 * GET /api/agency/compliance/workers
 * Returns all workers with compliance scores, filters, sorting
 * Cache: 60s TTL
 */
router.get('/workers', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const search = req.query.search || null;
        const status = req.query.status || null; // 'red', 'yellow', 'green'
        const sortBy = req.query.sortBy || 'name'; // 'name', 'score', 'updated'
        const sortOrder = req.query.sortOrder || 'asc';

        // Validate pagination
        if (page < 1 || limit < 1) {
            return res.status(400).json({
                error: 'Invalid pagination parameters'
            });
        }

        // Check cache
        const cacheKey = getCacheKey(req.agencyId, {
            page, limit, search, status, sortBy, sortOrder
        });

        if (cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (isCacheValid(cached.timestamp)) {
                return res.json({
                    ...cached.data,
                    cached: true,
                    cacheAge: Date.now() - cached.timestamp
                });
            } else {
                cache.delete(cacheKey);
            }
        }

        // Fetch data
        const result = await getWorkersWithScores(req.agencyId, {
            page,
            limit,
            search,
            statusFilter: status,
            sortBy,
            sortOrder
        });

        // Cache the result
        cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        res.json({
            ...result,
            cached: false,
            cacheAge: 0
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching compliance workers');

        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'compliance-workers-fetch'
            }
        });

        res.status(500).json({ error: 'Failed to fetch workers' });
    }
});

/**
 * POST /api/agency/compliance/export
 * Export compliance data as CSV or PDF
 * Body: { format: 'csv' | 'pdf' }
 */
router.post('/export', requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { format = 'csv' } = req.body;

        if (!['csv', 'pdf'].includes(format)) {
            return res.status(400).json({
                error: 'Invalid format. Must be "csv" or "pdf"'
            });
        }

        let data, contentType, filename;

        if (format === 'csv') {
            data = await generateCSV(req.agencyId);
            contentType = 'text/csv';
            filename = `compliance-report-${new Date().toISOString().split('T')[0]}.csv`;
        } else {
            data = await generatePDF(req.agencyId, req.agencyName || 'Agency');
            contentType = 'application/pdf';
            filename = `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
        }

        // Log export action
        try {
            await prisma.auditLog.create({
                data: {
                    agencyId: req.agencyId,
                    userId: req.user?.id,
                    action: `compliance.export-${format}`,
                    entity: 'compliance',
                    entityId: 'export',
                    metadata: { format, timestamp: new Date().toISOString() },
                    ipAddress: req.ip
                }
            });
        } catch (auditError) {
            (req.log || logger).warn({ err: auditError }, 'Failed to log audit entry');
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error exporting compliance data');

        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'compliance-export'
            }
        });

        res.status(500).json({ error: 'Failed to export data' });
    }
});

/**
 * GET /api/agency/compliance/alerts
 * Returns aggregated active alerts for the dashboard
 */
router.get('/alerts', async (req, res) => {
    try {
        const alerts = await aggregateAlerts(req.agencyId);

        res.json({
            data: alerts,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching compliance alerts');

        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'compliance-alerts-fetch'
            }
        });

        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

/**
 * GET /api/agency/compliance/score/:workerId
 * Calculate compliance score for a specific worker
 */
router.get('/score/:workerId', async (req, res) => {
    try {
        const { workerId } = req.params;

        // Verify worker belongs to this agency
        const worker = await prisma.worker.findFirst({
            where: { id: workerId, agencyId: req.agencyId },
            select: { id: true }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const score = await calculateScore(workerId, req.agencyId);

        res.json({ data: score });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error calculating score');

        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'compliance-score-calculate'
            }
        });

        res.status(500).json({ error: 'Failed to calculate score' });
    }
});

/**
 * POST /api/agency/compliance/document/:documentId/approve
 * Approve a compliance document
 */
router.post('/document/:documentId/approve', requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { documentId } = req.params;

        const doc = await prisma.complianceDocument.findFirst({
            where: { id: documentId, agencyId: req.agencyId },
            include: { worker: true }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Update document status
        const updatedDoc = await prisma.complianceDocument.update({
            where: { id: documentId },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date()
            }
        });

        // Log action
        await prisma.auditLog.create({
            data: {
                agencyId: req.agencyId,
                userId: req.user?.id,
                action: 'document.approved',
                entity: 'compliance_document',
                entityId: documentId,
                metadata: {
                    workerId: doc.workerId,
                    documentTypeId: doc.documentTypeId,
                    timestamp: new Date().toISOString()
                },
                ipAddress: req.ip
            }
        });

        // Clear cache
        cache.clear();

        res.json({ data: updatedDoc, message: 'Document approved' });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error approving document');

        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'document-approve'
            }
        });

        res.status(500).json({ error: 'Failed to approve document' });
    }
});

/**
 * POST /api/agency/compliance/document/:documentId/reject
 * Reject a compliance document
 */
router.post('/document/:documentId/reject', requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { documentId } = req.params;
        const { reason = '' } = req.body;

        const doc = await prisma.complianceDocument.findFirst({
            where: { id: documentId, agencyId: req.agencyId },
            include: { worker: true }
        });

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Update document status
        const updatedDoc = await prisma.complianceDocument.update({
            where: { id: documentId },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                reviewedAt: new Date()
            }
        });

        // Log action
        await prisma.auditLog.create({
            data: {
                agencyId: req.agencyId,
                userId: req.user?.id,
                action: 'document.rejected',
                entity: 'compliance_document',
                entityId: documentId,
                metadata: {
                    workerId: doc.workerId,
                    documentTypeId: doc.documentTypeId,
                    reason,
                    timestamp: new Date().toISOString()
                },
                ipAddress: req.ip
            }
        });

        // Clear cache
        cache.clear();

        res.json({ data: updatedDoc, message: 'Document rejected' });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error rejecting document');

        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'document-reject'
            }
        });

        res.status(500).json({ error: 'Failed to reject document' });
    }
});

/**
 * POST /api/agency/compliance/worker/:workerId/deactivate
 * Deactivate a worker
 */
router.post('/worker/:workerId/deactivate', requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { workerId } = req.params;

        const worker = await prisma.worker.findFirst({
            where: { id: workerId, agencyId: req.agencyId }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        // Update worker status
        const updatedWorker = await prisma.worker.update({
            where: { id: workerId },
            data: { status: 'INACTIVE' }
        });

        // Log action
        await prisma.auditLog.create({
            data: {
                agencyId: req.agencyId,
                userId: req.user?.id,
                action: 'worker.deactivated',
                entity: 'worker',
                entityId: workerId,
                metadata: {
                    workerName: `${worker.firstName} ${worker.lastName}`,
                    timestamp: new Date().toISOString()
                },
                ipAddress: req.ip
            }
        });

        // Clear cache
        cache.clear();

        res.json({ data: updatedWorker, message: 'Worker deactivated' });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error deactivating worker');

        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'worker-deactivate'
            }
        });

        res.status(500).json({ error: 'Failed to deactivate worker' });
    }
});

module.exports = router;
