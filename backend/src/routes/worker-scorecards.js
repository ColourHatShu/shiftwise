const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency } = require('../lib/auth');

const router = express.Router();

router.use(requireAgency);

/**
 * GET /api/worker-scorecards
 * Reliability scorecard per worker, derived from existing ShiftAssignment data
 * (no extra tracking): how many assignments each worker was given and how they
 * responded (confirmed / declined / pending). `confirmationRate` is the share of
 * *responded* assignments that were confirmed (null when none responded yet).
 * Sorted best-first (highest confirmation rate, then most assignments).
 */
router.get('/', async (req, res) => {
    try {
        const agencyId = req.agencyId;

        const [workers, grouped] = await Promise.all([
            prisma.worker.findMany({
                where: { agencyId },
                select: { id: true, firstName: true, lastName: true },
            }),
            prisma.shiftAssignment.groupBy({
                by: ['workerId', 'workerConfirmation'],
                where: { agencyId },
                _count: { _all: true },
            }),
        ]);

        // Fold the grouped (workerId × confirmation) counts into per-worker totals.
        const stats = new Map();
        for (const row of grouped) {
            const s = stats.get(row.workerId) || { confirmed: 0, declined: 0, pending: 0 };
            const count = (row._count && row._count._all) || 0;
            if (row.workerConfirmation === 'confirmed') s.confirmed += count;
            else if (row.workerConfirmation === 'declined') s.declined += count;
            else s.pending += count;
            stats.set(row.workerId, s);
        }

        const scorecards = workers.map((w) => {
            const s = stats.get(w.id) || { confirmed: 0, declined: 0, pending: 0 };
            const total = s.confirmed + s.declined + s.pending;
            const responded = s.confirmed + s.declined;
            return {
                workerId: w.id,
                firstName: w.firstName,
                lastName: w.lastName,
                totalAssignments: total,
                confirmed: s.confirmed,
                declined: s.declined,
                pending: s.pending,
                confirmationRate: responded > 0 ? Math.round((s.confirmed / responded) * 100) : null,
            };
        });

        // Best-first: highest confirmation rate, nulls (no data) last, then most assignments.
        scorecards.sort((a, b) => {
            if (a.confirmationRate === b.confirmationRate) return b.totalAssignments - a.totalAssignments;
            if (a.confirmationRate === null) return 1;
            if (b.confirmationRate === null) return -1;
            return b.confirmationRate - a.confirmationRate;
        });

        res.json({ data: scorecards });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error building worker scorecards');
        res.status(500).json({ error: 'Failed to build worker scorecards' });
    }
});

module.exports = router;
