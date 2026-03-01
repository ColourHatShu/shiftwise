const express = require('express');
const { checkExpiriesAndAlert } = require('../services/cronService');
const prisma = require('../lib/prisma');

const router = express.Router();

// ─── GET /api/alerts/test ───────────────────────────────────────────────────
// Intended for admin/developer testing. 
// Manually triggers the automated expiry checker and returns exactly what was sent.
router.get('/test', async (req, res) => {
    try {
        console.log("Triggering manual alerts check via API");
        const { alertsSent, triggeredDocuments } = await checkExpiriesAndAlert();

        res.json({
            message: "Expiry scan completed successfully.",
            alertsSent,
            triggeredDocuments
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Trigger failed internally." });
    }
});

// ─── DELETE /api/alerts/reset-test ──────────────────────────────────────────
// Development utility to clear today's alerts so the cron job can trigger again.
router.delete('/reset-test', async (req, res) => {
    try {
        console.log("Triggering manual alerts reset via API");
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setUTCHours(23, 59, 59, 999);

        // Delete Expiry Alerts logged today
        const alertsDeleted = await prisma.expiryAlert.deleteMany({
            where: {
                createdAt: {
                    gte: todayStart,
                    lte: todayEnd,
                }
            }
        });

        // Delete Audit Logs for alert.expiry_warning_sent today
        const logsDeleted = await prisma.auditLog.deleteMany({
            where: {
                action: 'alert.expiry_warning_sent',
                createdAt: {
                    gte: todayStart,
                    lte: todayEnd,
                }
            }
        });

        res.json({
            message: "Successfully reset today's alert history.",
            deletedRecords: {
                expiryAlerts: alertsDeleted.count,
                auditLogs: logsDeleted.count
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Reset failed internally." });
    }
});

module.exports = router;
