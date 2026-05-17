const express = require('express');
const prisma = require('../lib/prisma');
const { requireAgency } = require('../lib/auth');

const router = express.Router({ mergeParams: true });

// Middleware to ensure user is authorized for their agency
router.use(requireAgency);

// ─── GET /api/workers/:workerId/availability - Get worker's availability calendar ───
router.get('/', async (req, res) => {
    try {
        const { workerId } = req.params;
        const { startDate, endDate } = req.query;

        // Verify worker belongs to user's agency
        const worker = await prisma.worker.findFirst({
            where: {
                id: workerId,
                agencyId: req.agencyId
            }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const where = {
            workerId,
            agencyId: req.agencyId
        };

        // Filter by date range
        if (startDate || endDate) {
            where.date = {};
            if (startDate) {
                const startDateObj = new Date(startDate);
                if (!isNaN(startDateObj.getTime())) {
                    where.date.gte = startDateObj;
                }
            }
            if (endDate) {
                const endDateObj = new Date(endDate);
                if (!isNaN(endDateObj.getTime())) {
                    endDateObj.setHours(23, 59, 59, 999);
                    where.date.lte = endDateObj;
                }
            }
        }

        const availability = await prisma.workerAvailability.findMany({
            where,
            orderBy: { date: 'asc' }
        });

        res.json({ data: availability });
    } catch (error) {
        console.error('Error fetching worker availability:', error);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// ─── POST /api/workers/:id/availability - Set worker's availability ──────────
router.post('/', async (req, res) => {
    try {
        const { workerId } = req.params;
        const { date, status, notes } = req.body;

        // Validation
        if (!date || !status) {
            return res.status(400).json({
                error: 'Missing required fields: date, status'
            });
        }

        // Validate date format
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        // Validate status
        const validStatuses = ['AVAILABLE', 'UNAVAILABLE', 'ON_LEAVE'];
        if (!validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Verify worker belongs to user's agency
        const worker = await prisma.worker.findFirst({
            where: {
                id: workerId,
                agencyId: req.agencyId
            }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        // Upsert availability (update if exists, create if not)
        const availability = await prisma.workerAvailability.upsert({
            where: {
                workerId_date: {
                    workerId,
                    date: new Date(date)
                }
            },
            update: {
                status: status.toUpperCase(),
                notes
            },
            create: {
                workerId,
                agencyId: req.agencyId,
                date: new Date(date),
                status: status.toUpperCase(),
                notes
            }
        });

        res.status(201).json({ data: availability });
    } catch (error) {
        console.error('Error setting worker availability:', error);
        res.status(500).json({ error: 'Failed to set availability' });
    }
});

// ─── DELETE /api/workers/:id/availability/:date - Delete availability entry ──
router.delete('/:date', async (req, res) => {
    try {
        const { workerId } = req.params;
        let { date } = req.params;

        // If date is part of the URL path, extract it properly
        // The router should handle this correctly based on the parent route

        // Validate date format
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        // Verify worker belongs to user's agency
        const worker = await prisma.worker.findFirst({
            where: {
                id: workerId,
                agencyId: req.agencyId
            }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        await prisma.workerAvailability.delete({
            where: {
                workerId_date: {
                    workerId,
                    date: new Date(date)
                }
            }
        });

        res.json({ message: 'Availability entry deleted successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Availability entry not found' });
        }
        console.error('Error deleting availability:', error);
        res.status(500).json({ error: 'Failed to delete availability' });
    }
});

module.exports = router;
