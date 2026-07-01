const express = require('express');
const { requireAgency } = require('../lib/auth');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

const router = express.Router();

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
router.get('/stats', requireAgency, async (req, res) => {
    try {
        const agencyId = req.agencyId;

        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        // Start of today (UTC) so documents expiring *today* are counted as
        // "expiring soon" (their midnight timestamp is < the current time).
        const startOfToday = new Date(now);
        startOfToday.setUTCHours(0, 0, 0, 0);

        const [
            totalWorkers,
            documentsPending,
            expiringSoon,
            compliantWorkers
        ] = await Promise.all([
            // Total workers in this agency
            prisma.worker.count({
                where: { agencyId }
            }),

            // Compliance docs awaiting review
            prisma.complianceDocument.count({
                where: { agencyId, status: 'PENDING' }
            }),

            // Non-expired docs whose expiry is within the next 30 days
            prisma.complianceDocument.count({
                where: {
                    agencyId,
                    status: { not: 'EXPIRED' },
                    expiryDate: { gte: startOfToday, lte: in30Days }
                }
            }),

            // Workers with ACTIVE status and no problem documents. Nothing flips
            // status to EXPIRED (expiry lives in expiryDate), so we must also catch
            // approved-but-past-expiry docs — otherwise expired docs read as compliant.
            prisma.worker.count({
                where: {
                    agencyId,
                    status: 'ACTIVE',
                    complianceDocuments: {
                        none: {
                            OR: [
                                { status: { in: ['EXPIRED', 'REJECTED'] } },
                                { status: 'APPROVED', expiryDate: { lt: startOfToday } }
                            ]
                        }
                    }
                }
            })
        ]);

        res.json({ totalWorkers, documentsPending, expiringSoon, compliantWorkers });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching dashboard stats');
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
