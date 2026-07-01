const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const PDFDocument = require('pdfkit');
const prisma = require('./prisma');
const Sentry = require('@sentry/node');
const { isAuditPackOwnedByAgency } = require('./audit-pack-ownership');

/**
 * Audit Pack Service
 * Generates CQC-ready audit packs, compliance reports, snapshots, and bulk exports
 * Supports custom thresholds, performance optimization, error recovery
 */

const UPLOADS_DIR = path.join(process.cwd(), 'backend', 'uploads', 'audit-packs');
const EXPIRY_DAYS = 7;

// Ensure uploads directory exists
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Generate a single worker audit pack (ZIP)
 * Includes: all docs (PDFs), audit log (CSV), compliance summary (JSON)
 * R-AP-01: One-click <10s generation
 */
async function generateAuditPack(workerId, agencyId) {
  const startTime = Date.now();
  ensureUploadsDir();

  try {
    // Fetch worker details
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        complianceDocuments: {
          include: { documentType: true },
          orderBy: { uploadedAt: 'desc' }
        }
      }
    });

    if (!worker || worker.agencyId !== agencyId) {
      throw new Error('Worker not found or unauthorized');
    }

    // Fetch agency details
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId }
    });

    // Fetch audit logs for this worker
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        agencyId,
        entityId: workerId,
        entity: 'Worker'
      },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    // Also fetch document-related audit logs
    const docAuditLogs = await prisma.auditLog.findMany({
      where: {
        agencyId,
        entity: 'ComplianceDocument',
        entityId: { in: worker.complianceDocuments.map(d => d.id) }
      },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const allAuditLogs = [...auditLogs, ...docAuditLogs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Create ZIP
    const packId = `audit-pack-${agencyId}-${worker.id}-${Date.now()}`;
    const zipPath = path.join(UPLOADS_DIR, `${packId}.zip`);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        try {
          const duration = Date.now() - startTime;
          const fileSize = fs.statSync(zipPath).size;

          // Log success
          Sentry.captureMessage('Audit pack generated successfully', {
            level: 'info',
            tags: { agencyId, workerId, duration, fileSize }
          });

          resolve({
            packId,
            filePath: zipPath,
            fileSize,
            duration,
            expiresAt: new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000),
            docCount: worker.complianceDocuments.length,
            logCount: allAuditLogs.length
          });
        } catch (error) {
          reject(error);
        }
      });

      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      // Add documents metadata
      archive.append(
        Buffer.from(
          JSON.stringify(
            {
              workerId: worker.id,
              workerName: `${worker.firstName} ${worker.lastName}`,
              agencyId,
              agencyName: agency.name,
              generatedAt: new Date().toISOString(),
              documentCount: worker.complianceDocuments.length,
              documents: worker.complianceDocuments.map(d => ({
                id: d.id,
                name: d.fileName,
                type: d.documentType.name,
                status: d.status,
                issueDate: d.issueDate,
                expiryDate: d.expiryDate,
                uploadedAt: d.uploadedAt
              }))
            },
            null,
            2
          )
        ),
        { name: 'documents-manifest.json' }
      );

      // Add audit log CSV
      const csvHeader = ['Timestamp', 'Action', 'Entity', 'Actor Email', 'Changes'];
      const csvRows = allAuditLogs.map(log => [
        new Date(log.createdAt).toISOString(),
        log.action,
        log.entity,
        log.user?.email || 'SYSTEM',
        JSON.stringify(log.metadata || {}).substring(0, 100)
      ]);

      const csvContent = [
        csvHeader.map(h => `"${h}"`).join(','),
        ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      archive.append(Buffer.from(csvContent), { name: 'audit-log.csv' });

      // Add compliance summary
      const summary = {
        workerId: worker.id,
        workerName: `${worker.firstName} ${worker.lastName}`,
        email: worker.email,
        jobTitle: worker.jobTitle,
        status: worker.status,
        complianceScore: calculateWorkerScore(worker),
        totalDocuments: worker.complianceDocuments.length,
        approvedDocuments: worker.complianceDocuments.filter(d => d.status === 'APPROVED').length,
        documentsByStatus: {
          APPROVED: worker.complianceDocuments.filter(d => d.status === 'APPROVED').length,
          PENDING: worker.complianceDocuments.filter(d => d.status === 'PENDING').length,
          REJECTED: worker.complianceDocuments.filter(d => d.status === 'REJECTED').length,
          EXPIRED: worker.complianceDocuments.filter(d => d.status === 'EXPIRED').length
        },
        expiringDocuments: worker.complianceDocuments.filter(d => {
          if (!d.expiryDate) return false;
          const daysUntilExpiry = Math.floor(
            (new Date(d.expiryDate) - new Date()) / (24 * 60 * 60 * 1000)
          );
          return daysUntilExpiry <= 30;
        }).length,
        generatedAt: new Date().toISOString()
      };

      archive.append(Buffer.from(JSON.stringify(summary, null, 2)), { name: 'compliance-summary.json' });

      archive.finalize();
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { agencyId, workerId, context: 'generateAuditPack' }
    });
    throw error;
  }
}

/**
 * Generate agency-wide compliance report (PDF)
 * R-AP-02: PDF report <5s, includes all workers + scores
 */
async function generateComplianceReport(agencyId) {
  const startTime = Date.now();

  try {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId }
    });

    // Fetch all workers with compliance data
    const workers = await prisma.worker.findMany({
      where: { agencyId },
      include: {
        complianceDocuments: {
          include: { documentType: true },
          where: { documentType: { isRequired: true } }
        }
      },
      orderBy: { firstName: 'asc' }
    });

    const requiredDocTypes = await prisma.documentType.findMany({
      where: { agencyId, isRequired: true },
      select: { id: true }
    });

    const workersWithScores = workers.map(w => ({
      ...w,
      complianceScore: calculateWorkerComplianceScore(w, requiredDocTypes),
      compliant: calculateWorkerComplianceScore(w, requiredDocTypes) >= 80
    }));

    const compliantCount = workersWithScores.filter(w => w.compliant).length;
    const overallCompliance = Math.round((compliantCount / workers.length) * 100) || 0;

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Compliance Report', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(agency.name, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toISOString().split('T')[0]}`, {
      align: 'center'
    });
    doc.fontSize(10).text(`Report Date: ${new Date().toDateString()}`, { align: 'center' });
    doc.moveDown();

    // Summary Stats
    doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Workers: ${workers.length}`);
    doc.text(`Compliant Workers (≥80%): ${compliantCount}`);
    doc.text(`Non-Compliant Workers: ${workers.length - compliantCount}`);
    doc.text(`Overall Compliance: ${overallCompliance}%`);
    doc.moveDown(2);

    // Workers Table
    doc.fontSize(12).font('Helvetica-Bold').text('Worker Details', { underline: true });
    doc.fontSize(9).font('Helvetica');

    const tableTop = doc.y;
    const colWidths = { name: 100, email: 110, score: 60, docs: 50, status: 70 };
    const startX = 50;

    // Header row
    const headerY = doc.y;
    doc.text('Name', startX, headerY, { width: colWidths.name });
    doc.text('Email', startX + colWidths.name, headerY, { width: colWidths.email });
    doc.text('Score', startX + colWidths.name + colWidths.email, headerY, { width: colWidths.score });
    doc.text('Docs', startX + colWidths.name + colWidths.email + colWidths.score, headerY, { width: colWidths.docs });
    doc.text(
      'Status',
      startX + colWidths.name + colWidths.email + colWidths.score + colWidths.docs,
      headerY,
      { width: colWidths.status }
    );

    // Separator
    doc.moveTo(startX, headerY + 15).lineTo(500, headerY + 15).stroke();
    doc.moveDown(2);

    // Data rows
    workersWithScores.forEach(worker => {
      if (doc.y > 750) {
        doc.addPage();
      }

      const y = doc.y;
      const name = `${worker.firstName} ${worker.lastName}`;
      const approvedCount = worker.complianceDocuments.filter(d => d.status === 'APPROVED').length;
      const statusText = worker.compliant ? 'OK' : 'REVIEW';

      doc.fontSize(9);
      doc.text(name, startX, y, { width: colWidths.name });
      doc.y = y;
      doc.text(worker.email || '', startX + colWidths.name, y, { width: colWidths.email });
      doc.y = y;
      doc.text(`${worker.complianceScore}%`, startX + colWidths.name + colWidths.email, y, {
        width: colWidths.score
      });
      doc.y = y;
      doc.text(
        `${approvedCount}/${requiredDocTypes.length}`,
        startX + colWidths.name + colWidths.email + colWidths.score,
        y,
        { width: colWidths.docs }
      );
      doc.y = y;
      doc.text(
        statusText,
        startX + colWidths.name + colWidths.email + colWidths.score + colWidths.docs,
        y,
        { width: colWidths.status }
      );
      doc.moveDown();
    });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        const duration = Date.now() - startTime;
        Sentry.captureMessage('Compliance report generated successfully', {
          level: 'info',
          tags: { agencyId, duration, workerCount: workers.length }
        });

        resolve({
          buffer: Buffer.concat(buffers),
          duration,
          workerCount: workers.length,
          compliantCount,
          overallCompliance
        });
      });

      doc.on('error', reject);
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { agencyId, context: 'generateComplianceReport' }
    });
    throw error;
  }
}

/**
 * Generate compliance snapshot (immutable point-in-time view)
 * R-AP-04: Snapshot captures state, immutable, timestamped
 */
async function generateSnapshot(agencyId) {
  try {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId }
    });

    const workers = await prisma.worker.findMany({
      where: { agencyId },
      include: {
        complianceDocuments: {
          include: { documentType: true }
        }
      }
    });

    const requiredDocTypes = await prisma.documentType.findMany({
      where: { agencyId, isRequired: true }
    });

    const snapshot = {
      agencyId,
      agencyName: agency.name,
      asOfDate: new Date().toISOString(),
      workerCount: workers.length,
      requiredDocumentTypes: requiredDocTypes.map(dt => ({ id: dt.id, name: dt.name })),
      workers: workers.map(w => ({
        id: w.id,
        name: `${w.firstName} ${w.lastName}`,
        email: w.email,
        jobTitle: w.jobTitle,
        status: w.status,
        complianceScore: calculateWorkerComplianceScore(w, requiredDocTypes),
        documents: w.complianceDocuments.map(d => ({
          id: d.id,
          typeId: d.documentTypeId,
          typeName: d.documentType.name,
          status: d.status,
          expiryDate: d.expiryDate,
          uploadedAt: d.uploadedAt
        }))
      })),
      summary: {
        totalWorkers: workers.length,
        compliantWorkers: workers.filter(
          w =>
            calculateWorkerComplianceScore(w, requiredDocTypes) >= 80
        ).length,
        overallCompliance: Math.round(
          (workers.filter(
            w =>
              calculateWorkerComplianceScore(w, requiredDocTypes) >= 80
          ).length /
            workers.length) *
            100
        ) || 0
      }
    };

    return snapshot;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { agencyId, context: 'generateSnapshot' }
    });
    throw error;
  }
}

/**
 * Bulk export audit packs for multiple workers
 * R-AP-07: Bulk download for 10+ workers, clear ZIP structure
 */
async function bulkExport(agencyId, workerIds) {
  const startTime = Date.now();
  ensureUploadsDir();

  try {
    if (!Array.isArray(workerIds) || workerIds.length === 0) {
      throw new Error('At least one worker ID required');
    }

    // Verify all workers belong to agency
    const workers = await prisma.worker.findMany({
      where: { agencyId, id: { in: workerIds } },
      include: { complianceDocuments: { include: { documentType: true } } }
    });

    if (workers.length !== workerIds.length) {
      throw new Error('Some workers not found or unauthorized');
    }

    // Create bulk ZIP
    const packId = `bulk-export-${agencyId}-${Date.now()}`;
    const zipPath = path.join(UPLOADS_DIR, `${packId}.zip`);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        try {
          const duration = Date.now() - startTime;
          const fileSize = fs.statSync(zipPath).size;

          Sentry.captureMessage('Bulk export completed successfully', {
            level: 'info',
            tags: { agencyId, workerCount: workers.length, duration }
          });

          resolve({
            packId,
            filePath: zipPath,
            fileSize,
            duration,
            workerCount: workers.length,
            expiresAt: new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)
          });
        } catch (error) {
          reject(error);
        }
      });

      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      // Add manifest
      const manifest = {
        agencyId,
        generatedAt: new Date().toISOString(),
        workerCount: workers.length,
        workers: workers.map(w => ({
          id: w.id,
          name: `${w.firstName} ${w.lastName}`,
          folder: `workers/${w.id}-${w.firstName.toLowerCase()}-${w.lastName.toLowerCase()}`
        }))
      };

      archive.append(Buffer.from(JSON.stringify(manifest, null, 2)), { name: 'MANIFEST.json' });

      // Add each worker's data
      workers.forEach(worker => {
        const workerFolder = `workers/${worker.id}-${worker.firstName.toLowerCase()}-${worker.lastName.toLowerCase()}`;

        const workerSummary = {
          workerId: worker.id,
          name: `${worker.firstName} ${worker.lastName}`,
          email: worker.email,
          jobTitle: worker.jobTitle,
          status: worker.status,
          complianceScore: calculateWorkerScore(worker),
          documentCount: worker.complianceDocuments.length,
          generatedAt: new Date().toISOString()
        };

        archive.append(Buffer.from(JSON.stringify(workerSummary, null, 2)), {
          name: `${workerFolder}/summary.json`
        });
      });

      archive.finalize();
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { agencyId, workerCount: workerIds.length, context: 'bulkExport' }
    });
    throw error;
  }
}

/**
 * Helper: Calculate compliance score for a worker
 */
function calculateWorkerScore(worker) {
  if (!worker.complianceDocuments || worker.complianceDocuments.length === 0) {
    return 0;
  }

  const approvedCount = worker.complianceDocuments.filter(d => d.status === 'APPROVED').length;
  return Math.round((approvedCount / worker.complianceDocuments.length) * 100);
}

/**
 * Helper: Calculate compliance score with required doc types
 */
function calculateWorkerComplianceScore(worker, requiredDocTypes) {
  if (!requiredDocTypes || requiredDocTypes.length === 0) {
    return 100;
  }

  const requiredIds = requiredDocTypes.map(dt => dt.id);
  const requiredDocs = worker.complianceDocuments.filter(d => requiredIds.includes(d.documentTypeId));
  const approvedCount = requiredDocs.filter(d => d.status === 'APPROVED').length;

  return Math.round((approvedCount / requiredDocTypes.length) * 100);
}

/**
 * Download audit pack file
 */
async function downloadAuditPack(packId, agencyId, expiryHours = 168) {
  try {
    // Reject packs that don't belong to the caller's agency (same message as
    // a missing file so we don't leak whether another agency's pack exists).
    if (!isAuditPackOwnedByAgency(packId, agencyId)) {
      throw new Error('Audit pack not found');
    }

    const zipPath = path.join(UPLOADS_DIR, `${packId}.zip`);

    if (!fs.existsSync(zipPath)) {
      throw new Error('Audit pack not found');
    }

    const stats = fs.statSync(zipPath);
    const fileAgeMs = Date.now() - stats.mtimeMs;
    const expiryMs = expiryHours * 60 * 60 * 1000;

    if (fileAgeMs > expiryMs) {
      fs.unlinkSync(zipPath);
      throw new Error('Audit pack has expired');
    }

    return {
      filePath: zipPath,
      fileName: `${packId}.zip`,
      stream: fs.createReadStream(zipPath)
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { packId, context: 'downloadAuditPack' }
    });
    throw error;
  }
}

/**
 * Clean up expired audit packs
 */
async function cleanupExpiredPacks(expiryHours = 168) {
  try {
    ensureUploadsDir();
    const files = fs.readdirSync(UPLOADS_DIR);
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = fs.statSync(filePath);
      const fileAgeMs = Date.now() - stats.mtimeMs;
      const expiryMs = expiryHours * 60 * 60 * 1000;

      if (fileAgeMs > expiryMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    return { deletedCount };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { context: 'cleanupExpiredPacks' }
    });
    throw error;
  }
}

module.exports = {
  generateAuditPack,
  generateComplianceReport,
  generateSnapshot,
  bulkExport,
  downloadAuditPack,
  isAuditPackOwnedByAgency,
  cleanupExpiredPacks
};
