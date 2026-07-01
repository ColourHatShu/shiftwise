const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency } = require('../lib/auth');

const router = express.Router();

router.use(requireAgency);

/**
 * GET /api/shift-coverage
 * Coverage status for upcoming shifts (shiftDate >= today), derived from existing
 * Shift + ShiftAssignment data (no extra tracking). For each shift: how many
 * workers are required vs assigned vs confirmed, the shortfall (required − confirmed,
 * floored at 0), and a status:
 *   - 'filled'       confirmed >= required
 *   - 'understaffed' some confirmed, but fewer than required
 *   - 'unfilled'     no confirmed workers yet
 * Sorted soonest-first so coordinators act on the most urgent gaps.
 */
router.get('/', async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const shifts = await prisma.shift.findMany({
            where: { agencyId: req.agencyId, shiftDate: { gte: today } },
            include: { assignments: { select: { workerConfirmation: true } } },
            orderBy: { shiftDate: 'asc' },
        });

        const coverage = shifts.map((s) => {
            const assignedCount = s.assignments.length;
            const confirmedCount = s.assignments.filter((a) => a.workerConfirmation === 'confirmed').length;
            const shortfall = Math.max(s.requiredCount - confirmedCount, 0);
            let status;
            if (confirmedCount >= s.requiredCount) status = 'filled';
            else if (confirmedCount === 0) status = 'unfilled';
            else status = 'understaffed';

            return {
                shiftId: s.id,
                facilityName: s.facilityName,
                shiftDate: s.shiftDate,
                role: s.role,
                requiredCount: s.requiredCount,
                assignedCount,
                confirmedCount,
                shortfall,
                status,
            };
        });

        const summary = {
            totalUpcoming: coverage.length,
            needingAttention: coverage.filter((c) => c.shortfall > 0).length,
        };

        res.json({ data: coverage, summary });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error building shift coverage');
        res.status(500).json({ error: 'Failed to build shift coverage' });
    }
});

module.exports = router;
