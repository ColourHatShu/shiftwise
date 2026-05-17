const express = require('express');
const { requireAgency } = require('../lib/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// ─── GET /api/workers ─────────────────────────────────────────────────────────
router.get('/', requireAgency, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [workers, total] = await Promise.all([
            prisma.worker.findMany({
                where: { agencyId: req.agencyId },
                orderBy: { firstName: 'asc' },
                skip,
                take: limit
            }),
            prisma.worker.count({ where: { agencyId: req.agencyId } })
        ]);

        const totalPages = Math.ceil(total / limit);

        res.json({
            data: workers,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
});

// ─── GET /api/workers/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAgency, async (req, res) => {
    try {
        const { id } = req.params;
        const worker = await prisma.worker.findFirst({
            where: { id, agencyId: req.agencyId }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        res.json({ data: worker });
    } catch (error) {
        console.error('Error fetching worker:', error);
        res.status(500).json({ error: 'Failed to fetch worker details' });
    }
});

// ─── POST /api/workers ────────────────────────────────────────────────────────
router.post('/', requireAgency, async (req, res) => {
    try {
        const { firstName, lastName, email, phone, jobRole, startDate, notes } = req.body;

        if (!firstName || !lastName || !email || !jobRole || !startDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check for duplicate email within this agency
        const existingWorker = await prisma.worker.findUnique({
            where: { agencyId_email: { agencyId: req.agencyId, email } }
        });

        if (existingWorker) {
            return res.status(409).json({ error: 'A worker with this email already exists in your agency' });
        }

        const worker = await prisma.worker.create({
            data: {
                agencyId: req.agencyId,
                firstName,
                lastName,
                email,
                phone: phone || null,
                jobTitle: jobRole,
                startDate: new Date(startDate),
                notes: notes || null,
                status: 'ACTIVE'
            }
        });

        res.status(201).json({ data: worker });
    } catch (error) {
        console.error('Error creating worker:', error);
        res.status(500).json({ error: 'Failed to create worker' });
    }
});

// ─── PATCH /api/workers/:id/reactivate ───────────────────────────────────────
router.patch('/:id/reactivate', requireAgency, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const existingWorker = await prisma.worker.findFirst({
            where: { id, agencyId: req.agencyId }
        });

        if (!existingWorker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const updatedWorker = await prisma.worker.update({
            where: { id },
            data: { status: 'ACTIVE' }
        });

        res.json({ message: 'Worker reactivated successfully', data: updatedWorker });
    } catch (error) {
        console.error('Error reactivating worker:', error);
        res.status(500).json({ error: 'Failed to reactivate worker' });
    }
});

// ─── PATCH /api/workers/:id/deactivate ───────────────────────────────────────
router.patch('/:id/deactivate', requireAgency, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const existingWorker = await prisma.worker.findFirst({
            where: { id, agencyId: req.agencyId }
        });

        if (!existingWorker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const updatedWorker = await prisma.worker.update({
            where: { id },
            data: { status: 'INACTIVE' }
        });

        res.json({ message: 'Worker deactivated successfully', data: updatedWorker });
    } catch (error) {
        console.error('Error deactivating worker:', error);
        res.status(500).json({ error: 'Failed to deactivate worker' });
    }
});

// ─── PATCH /api/workers/:id ───────────────────────────────────────────────────
router.patch('/:id', requireAgency, async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, phone, jobRole, startDate, notes, isActive } = req.body;

        // Verify ownership
        const existingWorker = await prisma.worker.findFirst({
            where: { id, agencyId: req.agencyId }
        });

        if (!existingWorker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        // Build update payload
        const updateData = {};
        if (firstName) updateData.firstName = firstName.trim();
        if (lastName) updateData.lastName = lastName.trim();
        if (email) updateData.email = email.trim().toLowerCase();
        if (phone !== undefined) updateData.phone = phone.trim(); // Allow emptying
        if (jobRole) updateData.jobTitle = jobRole.trim();
        if (startDate) updateData.startDate = new Date(startDate);
        if (notes !== undefined) updateData.notes = notes.trim();

        const updatedWorker = await prisma.worker.update({
            where: { id },
            data: updateData
        });

        res.json({ message: 'Worker updated successfully', data: updatedWorker });

    } catch (error) {
        console.error('Error updating worker:', error);
        // Handle unique constraint violations
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to update worker' });
    }
});

// ─── DELETE /api/workers/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAgency, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership before deleting
        const existingWorker = await prisma.worker.findFirst({
            where: { id, agencyId: req.agencyId }
        });

        if (!existingWorker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        // Deleting the worker cascades into terminating ComplianceDocuments
        // and ExpiryAlerts organically due to onDelete: Cascade rules.
        await prisma.worker.delete({
            where: { id }
        });

        res.json({ message: 'Worker and associated documents permanently deleted.' });
    } catch (error) {
        console.error('Error deleting worker:', error);
        res.status(500).json({ error: 'Failed to delete worker' });
    }
});

module.exports = router;
