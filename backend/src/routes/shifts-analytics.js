const express = require('express');
const prisma = require('../lib/prisma');
const { requireAgency } = require('../lib/auth');

const router = express.Router();

// Middleware to ensure user is authorized for their agency
router.use(requireAgency);

// ─── GET /api/shifts/analytics/dashboard - Get shift analytics ─────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const where = {
            agencyId: req.agencyId
        };

        // Filter by date range
        if (startDate || endDate) {
            where.shiftDate = {};
            if (startDate) {
                where.shiftDate.gte = new Date(startDate);
            }
            if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                where.shiftDate.lte = endDateObj;
            }
        }

        // Get all shifts in range
        const shifts = await prisma.shift.findMany({
            where,
            include: {
                assignments: true
            }
        });

        // Calculate metrics
        const totalShifts = shifts.length;
        const totalPositions = shifts.reduce((sum, s) => sum + s.requiredCount, 0);
        const totalFilled = shifts.reduce((sum, s) => sum + (s.assignments?.length || 0), 0);
        const totalOpen = totalPositions - totalFilled;

        // Group by role
        const byRole = {};
        shifts.forEach(shift => {
            if (!byRole[shift.role]) {
                byRole[shift.role] = {
                    role: shift.role,
                    shifts: 0,
                    positions: 0,
                    filled: 0,
                    open: 0
                };
            }
            const filled = shift.assignments?.length || 0;
            byRole[shift.role].shifts += 1;
            byRole[shift.role].positions += shift.requiredCount;
            byRole[shift.role].filled += filled;
            byRole[shift.role].open += shift.requiredCount - filled;
        });

        // Group by facility
        const byFacility = {};
        shifts.forEach(shift => {
            if (!byFacility[shift.facilityName]) {
                byFacility[shift.facilityName] = {
                    facility: shift.facilityName,
                    shifts: 0,
                    positions: 0,
                    filled: 0,
                    open: 0
                };
            }
            const filled = shift.assignments?.length || 0;
            byFacility[shift.facilityName].shifts += 1;
            byFacility[shift.facilityName].positions += shift.requiredCount;
            byFacility[shift.facilityName].filled += filled;
            byFacility[shift.facilityName].open += shift.requiredCount - filled;
        });

        // Calculate compliance issues
        const complianceIssues = shifts.filter(shift =>
            shift.assignments && shift.assignments.length > 0
        ).reduce((count, shift) => {
            return count; // Would need more data from ComplianceCheckDetails to count actual issues
        }, 0);

        // Utilization rate
        const utilizationRate = totalPositions > 0 ? Math.round((totalFilled / totalPositions) * 100) : 0;

        res.json({
            data: {
                summary: {
                    totalShifts,
                    totalPositions,
                    totalFilled,
                    totalOpen,
                    utilizationRate
                },
                byRole: Object.values(byRole),
                byFacility: Object.values(byFacility)
            }
        });
    } catch (error) {
        console.error('Error fetching shift analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// ─── GET /api/shifts/analytics/heatmap - Worker availability heatmap ──────────
router.get('/heatmap', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const where = {
            agencyId: req.agencyId
        };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) {
                where.date.gte = new Date(startDate);
            }
            if (endDate) {
                where.date.lte = new Date(endDate);
            }
        }

        // Get worker availability
        const availability = await prisma.workerAvailability.findMany({
            where,
            include: {
                worker: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        res.json({
            data: availability
        });
    } catch (error) {
        console.error('Error fetching heatmap:', error);
        res.status(500).json({ error: 'Failed to fetch heatmap' });
    }
});

module.exports = router;
