const express = require('express');
const { checkExpiriesAndAlert } = require('../services/cronService');
const logger = require('../lib/logger');
const prisma = require('../lib/prisma');
const { requireAgency, requireRole } = require('../lib/auth');

const router = express.Router();

// All alert admin endpoints require an authenticated OWNER/ADMIN (BLOCKER-fix: previously unauthenticated, cross-tenant deletes).
router.use(requireAgency);
router.use(requireRole(['OWNER', 'ADMIN']));

// Block in production unless explicitly enabled — these are developer test utilities only.
const isDevMode = () =>
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_ALERT_TEST_ENDPOINTS === 'true';

// ─── GET /api/alerts/test ───────────────────────────────────────────────────
// Manually triggers the automated expiry checker. Restricted to the caller's agency.
router.get('/test', async (req, res) => {
    if (!isDevMode()) {
        return res.status(403).json({ error: 'Test endpoints are disabled in production.' });
    }
    try {
        (req.log || logger).info({ userId: req.userId, agencyId: req.agencyId }, 'Manual alerts check triggered');
        const { alertsSent, triggeredDocuments } = await checkExpiriesAndAlert({ agencyId: req.agencyId });

        res.json({
            message: 'Expiry scan completed successfully.',
            alertsSent,
            triggeredDocuments,
        });
    } catch (err) {
        (req.log || logger).error({ err }, 'Alerts operation failed');
        res.status(500).json({ error: 'Trigger failed internally.' });
    }
});

// ─── DELETE /api/alerts/reset-test ──────────────────────────────────────────
// Clears today's alerts for the CALLER'S agency only (BLOCKER-fix: previously cross-tenant).
router.delete('/reset-test', async (req, res) => {
    if (!isDevMode()) {
        return res.status(403).json({ error: 'Test endpoints are disabled in production.' });
    }
    try {
        (req.log || logger).info({ userId: req.userId, agencyId: req.agencyId }, 'Manual alerts reset triggered');
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setUTCHours(23, 59, 59, 999);

        const alertsDeleted = await prisma.expiryAlert.deleteMany({
            where: {
                createdAt: { gte: todayStart, lte: todayEnd },
                complianceDocument: { agencyId: req.agencyId },
            },
        });

        const logsDeleted = await prisma.auditLog.deleteMany({
            where: {
                action: 'alert.expiry_warning_sent',
                createdAt: { gte: todayStart, lte: todayEnd },
                agencyId: req.agencyId,
            },
        });

        res.json({
            message: "Successfully reset today's alert history for your agency.",
            deletedRecords: {
                expiryAlerts: alertsDeleted.count,
                auditLogs: logsDeleted.count,
            },
        });
    } catch (err) {
        (req.log || logger).error({ err }, 'Alerts operation failed');
        res.status(500).json({ error: 'Reset failed internally.' });
    }
});

module.exports = router;
