const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency } = require('../lib/auth');

const router = express.Router();

router.use(requireAgency);

/**
 * GET /api/expiring-documents?days=30
 * The core-promise worklist: a flat, urgency-sorted list of active workers'
 * compliance documents that are already **overdue** or expiring within the next
 * `days` (default 30, clamped 1..365). Most-urgent (soonest/most-overdue) first,
 * each flagged `overdue` with `daysUntilExpiry` (negative = past). Unlike the
 * downloadable expiring report, this includes already-expired docs — an overdue
 * doc is an active compliance breach a coordinator must act on.
 */
router.get('/', async (req, res) => {
    try {
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + days);
        cutoff.setHours(23, 59, 59, 999);

        const docs = await prisma.complianceDocument.findMany({
            where: {
                agencyId: req.agencyId,
                worker: { status: 'ACTIVE' },
                expiryDate: { lte: cutoff }, // <= cutoff also captures already-expired (past dates); null is excluded
            },
            include: {
                worker: { select: { id: true, firstName: true, lastName: true } },
                documentType: { select: { name: true } },
            },
            orderBy: { expiryDate: 'asc' },
        });

        const now = new Date();
        const data = docs.map((d) => {
            const daysUntilExpiry = Math.floor((new Date(d.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                documentId: d.id,
                workerId: d.worker.id,
                workerName: `${d.worker.firstName} ${d.worker.lastName}`.trim(),
                documentType: d.documentType.name,
                expiryDate: d.expiryDate,
                daysUntilExpiry,
                overdue: daysUntilExpiry < 0,
                status: d.status,
            };
        });

        const summary = {
            total: data.length,
            overdue: data.filter((d) => d.overdue).length,
            windowDays: days,
        };

        res.json({ data, summary });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error building expiring-documents worklist');
        res.status(500).json({ error: 'Failed to build expiring-documents worklist' });
    }
});

module.exports = router;
