const express = require('express');
const prisma = require('../lib/prisma');
const { requireAgency } = require('../lib/auth');

const router = express.Router();

// All document-type management is agency-scoped.
router.use(requireAgency);

// ─── GET /api/document-types - List the agency's compliance document types ─────
router.get('/', async (req, res) => {
    try {
        const docTypes = await prisma.documentType.findMany({
            where: { agencyId: req.agencyId },
            orderBy: { name: 'asc' },
        });
        res.json({ data: docTypes });
    } catch (error) {
        console.error('Error fetching document types:', error);
        res.status(500).json({ error: 'Failed to fetch document types' });
    }
});

// ─── POST /api/document-types - Create a document type ─────────────────────────
router.post('/', async (req, res) => {
    try {
        const { name, description, isRequired, hasExpiry, expiryWarningDays } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }
        const warn = expiryWarningDays === undefined ? 30 : parseInt(expiryWarningDays, 10);
        if (Number.isNaN(warn) || warn < 0) {
            return res.status(400).json({ error: 'expiryWarningDays must be a non-negative integer' });
        }

        const docType = await prisma.documentType.create({
            data: {
                agencyId: req.agencyId,
                name: name.trim(),
                description: description || null,
                isRequired: isRequired === undefined ? true : Boolean(isRequired),
                hasExpiry: hasExpiry === undefined ? true : Boolean(hasExpiry),
                expiryWarningDays: warn,
            },
        });
        res.status(201).json({ data: docType });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A document type with this name already exists' });
        }
        console.error('Error creating document type:', error);
        res.status(500).json({ error: 'Failed to create document type' });
    }
});

// ─── PATCH /api/document-types/:id - Update a document type ─────────────────────
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.documentType.findFirst({ where: { id, agencyId: req.agencyId } });
        if (!existing) {
            return res.status(404).json({ error: 'Document type not found' });
        }

        const { name, description, isRequired, hasExpiry, expiryWarningDays } = req.body;
        const data = {};
        if (name !== undefined) {
            if (!String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
            data.name = String(name).trim();
        }
        if (description !== undefined) data.description = description || null;
        if (isRequired !== undefined) data.isRequired = Boolean(isRequired);
        if (hasExpiry !== undefined) data.hasExpiry = Boolean(hasExpiry);
        if (expiryWarningDays !== undefined) {
            const w = parseInt(expiryWarningDays, 10);
            if (Number.isNaN(w) || w < 0) return res.status(400).json({ error: 'expiryWarningDays must be a non-negative integer' });
            data.expiryWarningDays = w;
        }

        const updated = await prisma.documentType.update({ where: { id }, data });
        res.json({ data: updated });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A document type with this name already exists' });
        }
        console.error('Error updating document type:', error);
        res.status(500).json({ error: 'Failed to update document type' });
    }
});

// ─── DELETE /api/document-types/:id - Delete (blocked if documents use it) ──────
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.documentType.findFirst({ where: { id, agencyId: req.agencyId } });
        if (!existing) {
            return res.status(404).json({ error: 'Document type not found' });
        }

        const inUse = await prisma.complianceDocument.count({ where: { documentTypeId: id } });
        if (inUse > 0) {
            return res.status(409).json({ error: `Cannot delete: ${inUse} document(s) use this type. Remove them first.` });
        }

        await prisma.documentType.delete({ where: { id } });
        res.json({ message: 'Document type deleted successfully' });
    } catch (error) {
        console.error('Error deleting document type:', error);
        res.status(500).json({ error: 'Failed to delete document type' });
    }
});

module.exports = router;
