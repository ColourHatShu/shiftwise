const prisma = require('./prisma');
const logger = require('./logger');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

/**
 * Compliance Service
 * Calculates worker compliance scores, generates exports, and aggregates alerts
 * Formula: (completed_required / total_required) * 100
 */

/**
 * Calculate compliance score for a worker
 * Returns: { score: 0-100, completedDocs: number, totalRequiredDocs: number, status: 'red'|'yellow'|'green' }
 */
async function calculateScore(workerId, agencyId) {
    try {
        // Get all required document types for the agency
        const requiredDocTypes = await prisma.documentType.findMany({
            where: {
                agencyId,
                isRequired: true
            },
            select: { id: true }
        });

        if (requiredDocTypes.length === 0) {
            // No required docs defined
            return { score: 100, completedDocs: 0, totalRequiredDocs: 0, status: 'green' };
        }

        // Count approved, NON-EXPIRED required documents. An expired-but-APPROVED
        // doc must not count as compliant — expiry lives in expiryDate and nothing
        // flips status to EXPIRED, so status alone would report a false green.
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const approvedDocs = await prisma.complianceDocument.count({
            where: {
                workerId,
                agencyId,
                documentTypeId: { in: requiredDocTypes.map(d => d.id) },
                status: 'APPROVED',
                OR: [{ expiryDate: null }, { expiryDate: { gte: startOfToday } }]
            }
        });

        const totalRequired = requiredDocTypes.length;
        const score = Math.round((approvedDocs / totalRequired) * 100);

        // Determine status based on score
        let status = 'red';
        if (score >= 80) status = 'green';
        else if (score >= 50) status = 'yellow';

        return {
            score,
            completedDocs: approvedDocs,
            totalRequiredDocs: totalRequired,
            status
        };
    } catch (error) {
        logger.error({ err: error }, 'Error calculating compliance score');
        throw error;
    }
}

/**
 * Get workers with compliance scores (optimized single query, no N+1)
 * Returns paginated list with scores, counts, last updated
 */
async function getWorkersWithScores(agencyId, options = {}) {
    const {
        page = 1,
        limit = 20,
        search = null,
        statusFilter = null, // 'red', 'yellow', 'green'
        sortBy = 'name', // 'name', 'score', 'updated'
        sortOrder = 'asc'
    } = options;

    const skip = (page - 1) * limit;

    try {
        // Get required document types for this agency
        const requiredDocTypes = await prisma.documentType.findMany({
            where: { agencyId, isRequired: true },
            select: { id: true }
        });

        const requiredDocTypeIds = requiredDocTypes.map(d => d.id);

        // Build where clause
        const where = { agencyId };

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Fetch workers with compliance document aggregates
        let workers = await prisma.worker.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                jobTitle: true,
                status: true,
                updatedAt: true,
                complianceDocuments: {
                    where: {
                        documentTypeId: { in: requiredDocTypeIds }
                    },
                    select: {
                        id: true,
                        status: true,
                        expiryDate: true
                    }
                }
            },
            orderBy: sortBy === 'name'
                ? { firstName: sortOrder }
                : sortBy === 'score'
                ? { id: 'asc' } // Will sort in-memory
                : { updatedAt: sortOrder },
            skip,
            take: limit
        });

        // Calculate scores and add status in-memory
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const workersWithScores = workers.map(worker => {
            // Exclude expired-but-APPROVED docs — an expired document isn't compliant.
            const approvedDocs = worker.complianceDocuments.filter(
                d => d.status === 'APPROVED' && (!d.expiryDate || new Date(d.expiryDate) >= startOfToday)
            ).length;
            const totalRequired = requiredDocTypeIds.length || 1;
            const score = totalRequired > 0 ? Math.round((approvedDocs / totalRequired) * 100) : 100;

            let complianceStatus = 'red';
            if (score >= 80) complianceStatus = 'green';
            else if (score >= 50) complianceStatus = 'yellow';

            return {
                id: worker.id,
                firstName: worker.firstName,
                lastName: worker.lastName,
                email: worker.email,
                jobTitle: worker.jobTitle,
                status: worker.status,
                complianceScore: score,
                complianceStatus,
                completedDocs: approvedDocs,
                totalRequiredDocs: totalRequired,
                lastUpdated: worker.updatedAt,
                hasExpiringDocs: worker.complianceDocuments.some(
                    d => d.expiryDate && new Date(d.expiryDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                )
            };
        });

        // Apply status filter if needed (red/yellow/green)
        let filtered = workersWithScores;
        if (statusFilter) {
            filtered = workersWithScores.filter(w => w.complianceStatus === statusFilter);
        }

        // Sort by score if requested (in-memory after filtering)
        if (sortBy === 'score') {
            filtered.sort((a, b) =>
                sortOrder === 'asc'
                    ? a.complianceScore - b.complianceScore
                    : b.complianceScore - a.complianceScore
            );
        }

        return {
            workers: filtered.slice(0, limit),
            total: filtered.length,
            page,
            limit
        };
    } catch (error) {
        logger.error({ err: error }, 'Error fetching workers with scores');
        throw error;
    }
}

/**
 * Generate CSV export of compliance data
 */
async function generateCSV(agencyId, options = {}) {
    try {
        const { includeNonCompliant = false } = options;

        const requiredDocTypes = await prisma.documentType.findMany({
            where: { agencyId, isRequired: true },
            select: { id: true }
        });

        const requiredDocTypeIds = requiredDocTypes.map(d => d.id);

        let workers = await prisma.worker.findMany({
            where: { agencyId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                jobTitle: true,
                status: true,
                updatedAt: true,
                complianceDocuments: {
                    where: { documentTypeId: { in: requiredDocTypeIds } },
                    select: { status: true, expiryDate: true }
                }
            }
        });

        // Calculate scores
        const data = workers.map(worker => {
            const approvedDocs = worker.complianceDocuments.filter(d => d.status === 'APPROVED').length;
            const totalRequired = requiredDocTypeIds.length || 1;
            const score = totalRequired > 0 ? Math.round((approvedDocs / totalRequired) * 100) : 100;

            return {
                name: `${worker.firstName} ${worker.lastName}`,
                email: worker.email,
                jobTitle: worker.jobTitle || 'N/A',
                status: worker.status,
                complianceScore: score,
                requiredDocsCompleted: approvedDocs,
                totalRequiredDocs: totalRequired,
                lastUpdated: new Date(worker.updatedAt).toISOString().split('T')[0]
            };
        });

        // Filter non-compliant if requested
        const filtered = includeNonCompliant ? data : data.filter(d => d.complianceScore >= 80);

        const csv = new Parser().parse(filtered);
        return csv;
    } catch (error) {
        logger.error({ err: error }, 'Error generating CSV');
        throw error;
    }
}

/**
 * Generate PDF export of compliance data
 */
async function generatePDF(agencyId, agencyName = 'Agency', options = {}) {
    try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', chunk => buffers.push(chunk));

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('Compliance Report', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(agencyName, { align: 'center' });
        doc.fontSize(10).text(`Generated: ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
        doc.moveDown();

        // Summary
        const requiredDocTypes = await prisma.documentType.findMany({
            where: { agencyId, isRequired: true },
            select: { id: true }
        });

        const requiredDocTypeIds = requiredDocTypes.map(d => d.id);

        const workers = await prisma.worker.findMany({
            where: { agencyId },
            select: {
                firstName: true,
                lastName: true,
                email: true,
                jobTitle: true,
                status: true,
                complianceDocuments: {
                    where: { documentTypeId: { in: requiredDocTypeIds } },
                    select: { status: true }
                }
            }
        });

        const workersWithScores = workers.map(w => {
            const approvedDocs = w.complianceDocuments.filter(d => d.status === 'APPROVED').length;
            const totalRequired = requiredDocTypeIds.length || 1;
            const score = totalRequired > 0 ? Math.round((approvedDocs / totalRequired) * 100) : 100;
            return { ...w, score, approvedDocs, totalRequired };
        });

        const compliantCount = workersWithScores.filter(w => w.score >= 80).length;
        const nonCompliantCount = workers.length - compliantCount;

        doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.fontSize(10).font('Helvetica')
            .text(`Total Workers: ${workers.length}`)
            .text(`Compliant (≥80%): ${compliantCount}`)
            .text(`Non-Compliant: ${nonCompliantCount}`)
            .text(`Overall Compliance: ${workers.length > 0 ? Math.round((compliantCount / workers.length) * 100) : 0}%`);
        doc.moveDown();

        // Workers Table
        doc.fontSize(12).font('Helvetica-Bold').text('Workers', { underline: true });
        doc.fontSize(9).font('Helvetica');

        // Table header
        const startX = 50;
        const startY = doc.y;
        const colWidths = { name: 120, email: 140, score: 60, status: 70 };

        doc.text('Name', startX, startY, { width: colWidths.name });
        doc.text('Email', startX + colWidths.name, startY, { width: colWidths.email });
        doc.text('Score', startX + colWidths.name + colWidths.email, startY, { width: colWidths.score });
        doc.text('Status', startX + colWidths.name + colWidths.email + colWidths.score, startY, { width: colWidths.status });

        // Separator line
        doc.moveTo(startX, startY + 15).lineTo(500, startY + 15).stroke();
        doc.moveDown(2);

        // Rows
        workersWithScores.forEach(worker => {
            const y = doc.y;
            if (y > 700) {
                doc.addPage();
            }
            const name = `${worker.firstName} ${worker.lastName}`;
            doc.fontSize(9).text(name, startX, doc.y, { width: colWidths.name });
            doc.y = y;
            doc.text(worker.email, startX + colWidths.name, y, { width: colWidths.email });
            doc.y = y;
            doc.text(`${worker.score}%`, startX + colWidths.name + colWidths.email, y, { width: colWidths.score });
            doc.y = y;
            doc.text(worker.status, startX + colWidths.name + colWidths.email + colWidths.score, y, { width: colWidths.status });
            doc.moveDown();
        });

        return new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
            doc.end();
        });
    } catch (error) {
        logger.error({ err: error }, 'Error generating PDF');
        throw error;
    }
}

/**
 * Aggregate active alerts for dashboard display
 * Returns: { expiringCount, expiredCount, nonCompliantCount, details: [...] }
 */
async function aggregateAlerts(agencyId) {
    try {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        // Get required document types
        const requiredDocTypes = await prisma.documentType.findMany({
            where: { agencyId, isRequired: true },
            select: { id: true }
        });

        const requiredDocTypeIds = requiredDocTypes.map(d => d.id);

        // Fetch workers with their compliance documents
        const workers = await prisma.worker.findMany({
            where: { agencyId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                complianceDocuments: {
                    select: {
                        id: true,
                        status: true,
                        expiryDate: true,
                        documentTypeId: true,
                        documentType: { select: { name: true } }
                    }
                }
            }
        });

        const alerts = [];

        workers.forEach(worker => {
            const requiredDocs = worker.complianceDocuments.filter(d => requiredDocTypeIds.includes(d.documentTypeId));
            const approvedDocs = requiredDocs.filter(d => d.status === 'APPROVED');

            // Check for expired documents
            const expiredDocs = requiredDocs.filter(d => d.status === 'APPROVED' && d.expiryDate && new Date(d.expiryDate) < now);
            if (expiredDocs.length > 0) {
                alerts.push({
                    type: 'expired',
                    workerId: worker.id,
                    workerName: `${worker.firstName} ${worker.lastName}`,
                    message: `${worker.firstName} ${worker.lastName} has ${expiredDocs.length} expired document(s)`,
                    severity: 'high',
                    timestamp: now
                });
            }

            // Check for expiring soon (within 3 days)
            const expiringSoonDocs = requiredDocs.filter(d =>
                d.status === 'APPROVED' && d.expiryDate &&
                new Date(d.expiryDate) >= now &&
                new Date(d.expiryDate) <= in3Days
            );
            if (expiringSoonDocs.length > 0) {
                alerts.push({
                    type: 'expiring-soon',
                    workerId: worker.id,
                    workerName: `${worker.firstName} ${worker.lastName}`,
                    message: `${worker.firstName} ${worker.lastName} has ${expiringSoonDocs.length} document(s) expiring within 3 days`,
                    severity: 'critical',
                    timestamp: now
                });
            }

            // Check for missing required documents
            if (approvedDocs.length < requiredDocs.length) {
                const missingCount = requiredDocTypeIds.length - approvedDocs.length;
                alerts.push({
                    type: 'missing-docs',
                    workerId: worker.id,
                    workerName: `${worker.firstName} ${worker.lastName}`,
                    message: `${worker.firstName} ${worker.lastName} is missing ${missingCount} required document(s)`,
                    severity: 'medium',
                    timestamp: now
                });
            }
        });

        // Aggregate counts
        const expiringCount = new Set(alerts.filter(a => a.type === 'expiring-soon').map(a => a.workerId)).size;
        const expiredCount = new Set(alerts.filter(a => a.type === 'expired').map(a => a.workerId)).size;
        const nonCompliantCount = new Set(alerts.filter(a => a.type === 'missing-docs').map(a => a.workerId)).size;

        return {
            expiringCount,
            expiredCount,
            nonCompliantCount,
            totalAlerts: alerts.length,
            alerts: alerts.slice(0, 10) // Return top 10 alerts
        };
    } catch (error) {
        logger.error({ err: error }, 'Error aggregating alerts');
        throw error;
    }
}

module.exports = {
    calculateScore,
    getWorkersWithScores,
    generateCSV,
    generatePDF,
    aggregateAlerts
};
