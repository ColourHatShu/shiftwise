const express = require('express');
const prisma = require('../lib/prisma');
const { requireAgency } = require('../lib/auth');
const csv = require('csv-parse/sync');

const router = express.Router();

// Middleware to ensure user is authorized for their agency
router.use(requireAgency);

// ─── POST /api/shifts/bulk/upload - Bulk upload shifts from CSV ─────────────────
router.post('/upload', async (req, res) => {
    try {
        const { csvData } = req.body;

        if (!csvData) {
            return res.status(400).json({
                error: 'Missing csvData field'
            });
        }

        // Parse CSV
        let records;
        try {
            records = csv.parse(csvData, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });
        } catch (parseError) {
            return res.status(400).json({
                error: 'Invalid CSV format',
                details: parseError.message
            });
        }

        if (records.length === 0) {
            return res.status(400).json({
                error: 'CSV is empty'
            });
        }

        const results = {
            total: records.length,
            succeeded: 0,
            failed: 0,
            errors: []
        };

        // Validate and create shifts in transaction
        const shifts = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const rowNumber = i + 2; // +2 because 1-indexed and header row

            try {
                // Validation
                if (!record.facilityName || !record.facilityName.trim()) {
                    throw new Error('facilityName is required');
                }
                if (!record.shiftDate) {
                    throw new Error('shiftDate is required (YYYY-MM-DD format)');
                }
                if (!record.startTime) {
                    throw new Error('startTime is required (HH:mm format)');
                }
                if (!record.endTime) {
                    throw new Error('endTime is required (HH:mm format)');
                }
                if (!record.role || !record.role.trim()) {
                    throw new Error('role is required');
                }
                if (!record.requiredCount) {
                    throw new Error('requiredCount is required');
                }

                // Validate date
                const dateObj = new Date(record.shiftDate);
                if (isNaN(dateObj.getTime())) {
                    throw new Error(`Invalid shiftDate format: ${record.shiftDate}`);
                }

                // Validate time format
                const timeRegex = /^\d{2}:\d{2}$/;
                if (!timeRegex.test(record.startTime)) {
                    throw new Error(`Invalid startTime format: ${record.startTime}`);
                }
                if (!timeRegex.test(record.endTime)) {
                    throw new Error(`Invalid endTime format: ${record.endTime}`);
                }

                // Validate time order
                if (record.startTime >= record.endTime) {
                    throw new Error('endTime must be after startTime');
                }

                // Validate requiredCount
                const requiredCount = parseInt(record.requiredCount);
                if (isNaN(requiredCount) || requiredCount < 1) {
                    throw new Error('requiredCount must be a positive integer');
                }

                shifts.push({
                    agencyId: req.agencyId,
                    facilityName: record.facilityName.trim(),
                    shiftDate: dateObj,
                    startTime: record.startTime,
                    endTime: record.endTime,
                    role: record.role.trim(),
                    requiredCount,
                    notes: record.notes || null,
                    complianceCheckup: record.complianceCheckup === 'true' || record.complianceCheckup === '1'
                });

                results.succeeded++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    row: rowNumber,
                    error: error.message
                });
            }
        }

        // Create shifts in database
        const createdShifts = [];
        for (const shiftData of shifts) {
            try {
                const shift = await prisma.shift.create({
                    data: shiftData
                });
                createdShifts.push(shift);
            } catch (dbError) {
                results.succeeded--;
                results.failed++;
                results.errors.push({
                    facility: shiftData.facilityName,
                    date: shiftData.shiftDate,
                    error: dbError.message
                });
            }
        }

        res.status(201).json({
            message: `Bulk upload complete: ${results.succeeded} succeeded, ${results.failed} failed`,
            results,
            createdShifts: createdShifts.map(s => ({
                id: s.id,
                facilityName: s.facilityName,
                shiftDate: s.shiftDate
            }))
        });
    } catch (error) {
        console.error('Error uploading shifts:', error);
        res.status(500).json({ error: 'Failed to upload shifts' });
    }
});

// ─── GET /api/shifts/bulk/template - Download CSV template ───────────────────
router.get('/template', (req, res) => {
    const template = `facilityName,shiftDate,startTime,endTime,role,requiredCount,notes,complianceCheckup
St Mary's Hospital,2026-05-25,08:00,16:00,Nurse,3,Ward 5,false
Central Care Home,2026-05-25,12:00,20:00,Carer,2,Main facility,true
Community Health,2026-05-26,09:00,17:00,Support Worker,1,Mobile clinic,false`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="shift-template.csv"');
    res.send(template);
});

module.exports = router;
