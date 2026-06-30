const express = require('express');
const prisma = require('../lib/prisma');
const { requireAgency } = require('../lib/auth');

const router = express.Router();

// Middleware to ensure user is authorized for their agency
router.use(requireAgency);

// ─── POST /api/shifts - Create a new shift ────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const {
            facilityName,
            shiftDate,
            startTime,
            endTime,
            role,
            requiredCount,
            complianceCheckup = false,
            notes
        } = req.body;

        // Validation
        if (!facilityName || !shiftDate || !startTime || !endTime || !role || requiredCount === undefined) {
            return res.status(400).json({
                error: 'Missing required fields: facilityName, shiftDate, startTime, endTime, role, requiredCount'
            });
        }

        // Validate date format
        const dateObj = new Date(shiftDate);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                error: 'Invalid shiftDate format. Use YYYY-MM-DD'
            });
        }

        // Validate time format (HH:mm)
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            return res.status(400).json({
                error: 'Invalid time format. Use HH:mm'
            });
        }

        // Validate requiredCount is positive integer
        if (!Number.isInteger(requiredCount) || requiredCount < 1) {
            return res.status(400).json({
                error: 'requiredCount must be a positive integer'
            });
        }

        const shift = await prisma.shift.create({
            data: {
                agencyId: req.agencyId,
                facilityName,
                shiftDate: new Date(shiftDate),
                startTime,
                endTime,
                role,
                requiredCount,
                complianceCheckup,
                notes
            }
        });

        res.status(201).json({ data: shift });
    } catch (error) {
        console.error('Error creating shift:', error);
        res.status(500).json({ error: 'Failed to create shift' });
    }
});

// ─── GET /api/shifts - List shifts for agency ────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, role, facilityName } = req.query;

        const where = {
            agencyId: req.agencyId
        };

        // Filter by date range
        if (startDate || endDate) {
            where.shiftDate = {};
            if (startDate) {
                const startDateObj = new Date(startDate);
                if (!isNaN(startDateObj.getTime())) {
                    where.shiftDate.gte = startDateObj;
                }
            }
            if (endDate) {
                const endDateObj = new Date(endDate);
                if (!isNaN(endDateObj.getTime())) {
                    // Set to end of day
                    endDateObj.setHours(23, 59, 59, 999);
                    where.shiftDate.lte = endDateObj;
                }
            }
        }

        // Filter by role
        if (role) {
            where.role = { contains: role, mode: 'insensitive' };
        }

        // Filter by facility name
        if (facilityName) {
            where.facilityName = { contains: facilityName, mode: 'insensitive' };
        }

        const shifts = await prisma.shift.findMany({
            where,
            orderBy: { shiftDate: 'asc' },
            include: {
                assignments: {
                    include: {
                        worker: { select: { id: true, firstName: true, lastName: true, email: true } }
                    }
                }
            }
        });

        res.json({ data: shifts });
    } catch (error) {
        console.error('Error fetching shifts:', error);
        res.status(500).json({ error: 'Failed to fetch shifts' });
    }
});

// ─── GET /api/shifts/:id - Get a specific shift ───────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const shift = await prisma.shift.findFirst({
            where: {
                id,
                agencyId: req.agencyId
            },
            include: {
                assignments: {
                    include: {
                        worker: { select: { id: true, firstName: true, lastName: true, email: true } }
                    }
                }
            }
        });

        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        res.json({ data: shift });
    } catch (error) {
        console.error('Error fetching shift:', error);
        res.status(500).json({ error: 'Failed to fetch shift' });
    }
});

// ─── PATCH /api/shifts/:id - Update a shift ──────────────────────────────────
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { facilityName, startTime, endTime, role, requiredCount, complianceCheckup, notes } = req.body;

        // Validate that shift belongs to user's agency
        const existingShift = await prisma.shift.findFirst({
            where: {
                id,
                agencyId: req.agencyId
            }
        });

        if (!existingShift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Build update data (only include provided fields)
        const updateData = {};
        if (facilityName !== undefined) updateData.facilityName = facilityName;
        if (startTime !== undefined) {
            const timeRegex = /^\d{2}:\d{2}$/;
            if (!timeRegex.test(startTime)) {
                return res.status(400).json({ error: 'Invalid startTime format. Use HH:mm' });
            }
            updateData.startTime = startTime;
        }
        if (endTime !== undefined) {
            const timeRegex = /^\d{2}:\d{2}$/;
            if (!timeRegex.test(endTime)) {
                return res.status(400).json({ error: 'Invalid endTime format. Use HH:mm' });
            }
            updateData.endTime = endTime;
        }
        if (role !== undefined) updateData.role = role;
        if (requiredCount !== undefined) {
            if (!Number.isInteger(requiredCount) || requiredCount < 1) {
                return res.status(400).json({ error: 'requiredCount must be a positive integer' });
            }
            updateData.requiredCount = requiredCount;
        }
        if (complianceCheckup !== undefined) updateData.complianceCheckup = complianceCheckup;
        if (notes !== undefined) updateData.notes = notes;

        const shift = await prisma.shift.update({
            where: { id },
            data: updateData,
            include: {
                assignments: {
                    include: {
                        worker: { select: { id: true, firstName: true, lastName: true, email: true } }
                    }
                }
            }
        });

        res.json({ data: shift });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Shift not found' });
        }
        console.error('Error updating shift:', error);
        res.status(500).json({ error: 'Failed to update shift' });
    }
});

// ─── DELETE /api/shifts/:id - Delete a shift ─────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verify shift belongs to user's agency
        const existingShift = await prisma.shift.findFirst({
            where: {
                id,
                agencyId: req.agencyId
            }
        });

        if (!existingShift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Delete associated assignments first (or cascade delete handles this)
        await prisma.shift.delete({
            where: { id }
        });

        res.json({ message: 'Shift deleted successfully' });
    } catch (error) {
        console.error('Error deleting shift:', error);
        res.status(500).json({ error: 'Failed to delete shift' });
    }
});

module.exports = router;
