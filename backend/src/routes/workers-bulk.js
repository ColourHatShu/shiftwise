const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency } = require('../lib/auth');
const csv = require('csv-parse/sync');

const router = express.Router();

router.use(requireAgency);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── POST /api/workers/bulk/upload - Bulk-create workers from CSV ──────────────
router.post('/upload', async (req, res) => {
    try {
        const { csvData } = req.body;
        if (!csvData || !csvData.trim()) {
            return res.status(400).json({ error: 'CSV is empty' });
        }

        let records;
        try {
            records = csv.parse(csvData, { columns: true, skip_empty_lines: true, trim: true });
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid CSV format', details: parseError.message });
        }
        if (records.length === 0) {
            return res.status(400).json({ error: 'CSV is empty' });
        }

        const results = { total: records.length, succeeded: 0, failed: 0, errors: [] };
        const toCreate = [];

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const rowNumber = i + 2; // 1-indexed + header row
            try {
                if (!r.firstName || !r.firstName.trim()) throw new Error('firstName is required');
                if (!r.lastName || !r.lastName.trim()) throw new Error('lastName is required');
                if (!r.email || !r.email.trim()) throw new Error('email is required');
                if (!EMAIL_RE.test(r.email.trim())) throw new Error(`Invalid email: ${r.email}`);

                let startDate = null;
                if (r.startDate && r.startDate.trim()) {
                    const d = new Date(r.startDate);
                    if (isNaN(d.getTime())) throw new Error(`Invalid startDate format: ${r.startDate}`);
                    startDate = d;
                }

                toCreate.push({
                    rowNumber,
                    data: {
                        agencyId: req.agencyId,
                        firstName: r.firstName.trim(),
                        lastName: r.lastName.trim(),
                        email: r.email.trim().toLowerCase(),
                        phone: r.phone ? r.phone.trim() : null,
                        jobTitle: r.jobTitle ? r.jobTitle.trim() : null,
                        niNumber: r.niNumber ? r.niNumber.trim() : null,
                        startDate,
                    },
                });
            } catch (error) {
                results.failed++;
                results.errors.push({ row: rowNumber, error: error.message });
            }
        }

        const created = [];
        for (const { rowNumber, data } of toCreate) {
            try {
                const worker = await prisma.worker.create({ data });
                created.push({ id: worker.id, firstName: worker.firstName, lastName: worker.lastName, email: worker.email });
                results.succeeded++;
            } catch (dbError) {
                results.failed++;
                results.errors.push({
                    row: rowNumber,
                    error: dbError.code === 'P2002' ? `A worker with email ${data.email} already exists` : dbError.message,
                });
            }
        }

        res.status(201).json({
            message: `Bulk upload complete: ${results.succeeded} succeeded, ${results.failed} failed`,
            results,
            createdWorkers: created,
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error bulk-uploading workers');
        res.status(500).json({ error: 'Failed to upload workers' });
    }
});

// ─── GET /api/workers/bulk/template - Download a CSV template ──────────────────
router.get('/template', (req, res) => {
    const template = `firstName,lastName,email,phone,jobTitle,startDate,niNumber
Jane,Doe,jane.doe@example.com,07700900001,Nurse,2026-01-15,QQ123456C
John,Smith,john.smith@example.com,07700900002,Carer,2026-02-01,`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="worker-template.csv"');
    res.send(template);
});

module.exports = router;
