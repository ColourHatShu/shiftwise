const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency, requireRole } = require('../lib/auth');

const router = express.Router();

// Middleware
router.use(requireAgency);
router.use(requireRole(['OWNER', 'ADMIN']));

/**
 * POST /api/shift-requirements
 * Create a new shift requirement template
 * Per R-SA-07
 */
router.post('/', async (req, res) => {
    try {
        const { templateName, requiredDocuments, role, description } = req.body;

        if (!templateName || !Array.isArray(requiredDocuments)) {
            return res.status(400).json({
                error: 'Missing required fields: templateName, requiredDocuments (array)'
            });
        }

        // Check for duplicate template name
        const existing = await prisma.shiftRequirement.findUnique({
            where: {
                agencyId_templateName: {
                    agencyId: req.agencyId,
                    templateName
                }
            }
        });

        if (existing) {
            return res.status(400).json({
                error: 'Template with this name already exists'
            });
        }

        const template = await prisma.shiftRequirement.create({
            data: {
                agencyId: req.agencyId,
                templateName,
                requiredDocuments,
                role: role || null,
                description: description || null
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                agencyId: req.agencyId,
                userId: req.user?.id,
                action: 'shift-requirement.created',
                entity: 'ShiftRequirement',
                entityId: template.id,
                metadata: { templateName }
            }
        });

        res.status(201).json(template);
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error creating shift requirement');
        res.status(500).json({ error: 'Failed to create requirement template' });
    }
});

/**
 * GET /api/shift-requirements
 * List all shift requirement templates for agency
 */
router.get('/', async (req, res) => {
    try {
        const templates = await prisma.shiftRequirement.findMany({
            where: { agencyId: req.agencyId },
            orderBy: { templateName: 'asc' }
        });

        res.json(templates);
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching shift requirements');
        res.status(500).json({ error: 'Failed to fetch requirement templates' });
    }
});

/**
 * PUT /api/shift-requirements/:id
 * Update a shift requirement template
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { templateName, requiredDocuments, role, description } = req.body;

        const template = await prisma.shiftRequirement.findUnique({
            where: { id }
        });

        if (!template || template.agencyId !== req.agencyId) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const updated = await prisma.shiftRequirement.update({
            where: { id },
            data: {
                templateName: templateName || template.templateName,
                requiredDocuments: requiredDocuments || template.requiredDocuments,
                role: role !== undefined ? role : template.role,
                description: description !== undefined ? description : template.description
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                agencyId: req.agencyId,
                userId: req.user?.id,
                action: 'shift-requirement.updated',
                entity: 'ShiftRequirement',
                entityId: id,
                metadata: { templateName: updated.templateName }
            }
        });

        res.json(updated);
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error updating shift requirement');
        res.status(500).json({ error: 'Failed to update requirement template' });
    }
});

/**
 * DELETE /api/shift-requirements/:id
 * Delete a shift requirement template
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const template = await prisma.shiftRequirement.findUnique({
            where: { id }
        });

        if (!template || template.agencyId !== req.agencyId) {
            return res.status(404).json({ error: 'Template not found' });
        }

        await prisma.shiftRequirement.delete({ where: { id } });

        // Audit log
        await prisma.auditLog.create({
            data: {
                agencyId: req.agencyId,
                userId: req.user?.id,
                action: 'shift-requirement.deleted',
                entity: 'ShiftRequirement',
                entityId: id,
                metadata: { templateName: template.templateName }
            }
        });

        res.status(204).send();
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error deleting shift requirement');
        res.status(500).json({ error: 'Failed to delete requirement template' });
    }
});

module.exports = router;
