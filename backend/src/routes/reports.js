const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency } = require('../lib/auth');
const pdfService = require('../services/pdfService');

// ─── GET /api/reports/compliance ───────────────────────────────────────────────
// Returns all active workers, their documents, and overall compliance %
router.get('/compliance', requireAgency, async (req, res) => {
    try {
        const workers = await prisma.worker.findMany({
            where: { agencyId: req.agencyId, status: 'ACTIVE' },
            include: {
                complianceDocuments: {
                    include: { documentType: true }
                }
            },
            orderBy: { lastName: 'asc' }
        });

        const activeWorkersCount = workers.length;
        let compliantWorkersCount = 0;

        // Determine if a worker is compliant (has all REQUIRED docs valid)
        // Simplified approach for the report preview
        const reportData = workers.map(worker => {
            const docs = worker.complianceDocuments || [];
            // Let's assume a worker is compliant if they don't have any EXPIRED or REJECTED docs
            // and have at least *some* docs uploaded. A more rigorous check would match against
            // all required slot types, but for now we'll do a basic status sweep.

            const hasIssues = docs.some(d => ['EXPIRED', 'REJECTED'].includes(d.status));
            const isCompliant = !hasIssues && docs.length > 0;

            if (isCompliant) compliantWorkersCount++;

            return {
                id: worker.id,
                name: `${worker.firstName} ${worker.lastName}`,
                role: worker.jobTitle || 'Unassigned',
                isCompliant,
                documents: docs.map(d => ({
                    typeName: d.documentType.name,
                    status: d.status,
                    expiryDate: d.expiryDate
                }))
            };
        });

        const compliancePercentage = activeWorkersCount === 0 ? 0 :
            Math.round((compliantWorkersCount / activeWorkersCount) * 100);

        res.json({
            data: {
                workers: reportData,
                metrics: {
                    totalWorkers: activeWorkersCount,
                    compliantWorkers: compliantWorkersCount,
                    compliancePercentage
                }
            }
        });

    } catch (error) {
        (req.log || logger).error({ err: error }, 'Compliance report error');
        res.status(500).json({ error: 'Failed to generate compliance report' });
    }
});

// ─── GET /api/reports/expiring ────────────────────────────────────────────────
// Returns documents expiring within X days
router.get('/expiring', requireAgency, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);
        // Start of today (UTC) so a document expiring *today* is still included
        // (its midnight timestamp is < the current time; `gte: new Date()` dropped it).
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

        const workers = await prisma.worker.findMany({
            where: { agencyId: req.agencyId, status: 'ACTIVE' },
            include: {
                complianceDocuments: {
                    include: { documentType: true },
                    where: {
                        expiryDate: {
                            not: null,
                            lte: cutoffDate,
                            gte: startOfToday // today + future; excludes already-lapsed
                        }
                    },
                    orderBy: { expiryDate: 'asc' }
                }
            }
        });

        // Flatten and group by urgency
        const expiringDocs = [];
        workers.forEach(w => {
            w.complianceDocuments.forEach(d => {
                const daysUntilExpiry = Math.ceil((new Date(d.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                expiringDocs.push({
                    workerName: `${w.firstName} ${w.lastName}`,
                    workerRole: w.jobTitle || 'Unassigned',
                    documentName: d.documentType.name,
                    expiryDate: d.expiryDate,
                    daysRemaining: daysUntilExpiry,
                    urgency: daysUntilExpiry <= 7 ? 'CRITICAL' : daysUntilExpiry <= 14 ? 'HIGH' : 'MEDIUM'
                });
            });
        });

        // Sort by closest expiry
        expiringDocs.sort((a, b) => a.daysRemaining - b.daysRemaining);

        res.json({ data: expiringDocs });

    } catch (error) {
        (req.log || logger).error({ err: error }, 'Expiring report error');
        res.status(500).json({ error: 'Failed to generate expiring report' });
    }
});

// ─── GET /api/reports/non-compliant ──────────────────────────────────────────
// Returns active workers with missing or expired documents
router.get('/non-compliant', requireAgency, async (req, res) => {
    try {
        const workers = await prisma.worker.findMany({
            where: { agencyId: req.agencyId, status: 'ACTIVE' },
            include: {
                complianceDocuments: {
                    include: { documentType: true }
                }
            }
        });

        const nonCompliantWorkers = [];

        workers.forEach(worker => {
            const docs = worker.complianceDocuments || [];
            const expiredDocs = docs.filter(d => d.status === 'EXPIRED' || (d.expiryDate && new Date(d.expiryDate) < new Date()));
            const rejectedDocs = docs.filter(d => d.status === 'REJECTED');

            // Assume 8 standard slots are required. We'll find missing purely by counting
            // actual implementation should diff against DocumentType table
            const missingCount = Math.max(0, 8 - docs.length);

            if (expiredDocs.length > 0 || rejectedDocs.length > 0 || missingCount > 0) {
                nonCompliantWorkers.push({
                    id: worker.id,
                    name: `${worker.firstName} ${worker.lastName}`,
                    role: worker.jobTitle || 'Unassigned',
                    issues: {
                        expired: expiredDocs.map(d => d.documentType.name),
                        rejected: rejectedDocs.map(d => d.documentType.name),
                        missingCount
                    }
                });
            }
        });

        res.json({ data: nonCompliantWorkers });

    } catch (error) {
        (req.log || logger).error({ err: error }, 'Non-compliant report error');
        res.status(500).json({ error: 'Failed to generate non-compliant report' });
    }
});

// ─── POST /api/reports/generate-pdf ─────────────────────────────────────────
router.post('/generate-pdf', requireAgency, async (req, res) => {
    try {
        const { reportType, reportData, agencyName } = req.body;

        if (!reportType || !reportData) {
            return res.status(400).json({ error: 'Missing report data parameters' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="ShiftWise_Compliance_Report.pdf"');

        // Stream PDF directly to response using pdfkit
        pdfService.generateReportPDF(reportType, reportData, agencyName || 'ShiftWise Agency', res);

    } catch (error) {
        (req.log || logger).error({ err: error }, 'PDF generation error');
        res.status(500).json({ error: 'Failed to generate PDF document' });
    }
});

module.exports = router;
