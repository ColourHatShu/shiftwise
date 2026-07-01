const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency } = require('../lib/auth');

const router = express.Router();

// All shift-template routes are agency-scoped.
router.use(requireAgency);

// ─── GET /api/shift-templates - List the agency's reusable shift templates ────
router.get('/', async (req, res) => {
    try {
        const templates = await prisma.shiftTemplate.findMany({
            where: { agencyId: req.agencyId },
            orderBy: { name: 'asc' },
        });
        res.json({ data: templates });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching shift templates');
        res.status(500).json({ error: 'Failed to fetch shift templates' });
    }
});

// ─── POST /api/shift-templates - Create a reusable shift template ─────────────
router.post('/', async (req, res) => {
    try {
        const { name, facilityName, startTime, endTime, role, requiredCount, complianceCheckup, notes } = req.body;

        if (!name || !facilityName || !startTime || !endTime || !role || requiredCount === undefined) {
            return res.status(400).json({
                error: 'Missing required fields: name, facilityName, startTime, endTime, role, requiredCount',
            });
        }

        const count = parseInt(requiredCount, 10);
        if (Number.isNaN(count) || count < 1) {
            return res.status(400).json({ error: 'requiredCount must be a positive integer' });
        }

        const template = await prisma.shiftTemplate.create({
            data: {
                agencyId: req.agencyId,
                name,
                facilityName,
                startTime,
                endTime,
                role,
                requiredCount: count,
                complianceCheckup: Boolean(complianceCheckup),
                notes: notes || null,
            },
        });

        res.status(201).json({ data: template });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A template with this name already exists' });
        }
        (req.log || logger).error({ err: error }, 'Error creating shift template');
        res.status(500).json({ error: 'Failed to create shift template' });
    }
});

// ─── DELETE /api/shift-templates/:id - Remove a template ──────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Confirm the template belongs to the caller's agency before deleting.
        const existing = await prisma.shiftTemplate.findFirst({
            where: { id, agencyId: req.agencyId },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }

        await prisma.shiftTemplate.delete({ where: { id } });
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error deleting shift template');
        res.status(500).json({ error: 'Failed to delete shift template' });
    }
});

module.exports = router;
