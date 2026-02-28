const express = require('express');
const { verifyToken } = require('@clerk/backend');
const prisma = require('../lib/prisma');

const router = express.Router();

// ─── Shared token verifier ────────────────────────────────────────────────────
const getAgencyId = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    const token = authHeader.split(' ')[1];
    let payload;
    try {
        payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
            authorizedParties: ['http://localhost:3000'],
            clockSkewInMs: 300000
        });
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { clerkId: payload.sub }
    });

    if (!user?.agencyId) {
        res.status(403).json({ error: 'No agency found' });
        return null;
    }

    return user.agencyId;
};

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const agencyId = await getAgencyId(req, res);
        if (!agencyId) return;

        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
                    expiryDate: { gte: now, lte: in30Days }
                }
            }),

            // Workers with ACTIVE status and no EXPIRED or REJECTED documents
            prisma.worker.count({
                where: {
                    agencyId,
                    status: 'ACTIVE',
                    complianceDocuments: {
                        none: { status: { in: ['EXPIRED', 'REJECTED'] } }
                    }
                }
            })
        ]);

        res.json({ totalWorkers, documentsPending, expiringSoon, compliantWorkers });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
