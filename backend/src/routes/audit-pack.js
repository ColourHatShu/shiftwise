const express = require('express');
const { createWriteStream, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const archiver = require('archiver');
const prisma = require('../lib/prisma');
const { requireAgency, requireRole } = require('../lib/auth');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

// Only OWNER/ADMIN can export audit packs
router.use(requireAgency);
router.use(requireRole(['OWNER', 'ADMIN']));

// ─── POST /api/audit-pack/export - Generate and email audit pack ────────────
router.post('/export', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'Missing required fields: dateFrom, dateTo' });
    }

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format.' });
    }

    // Query audit logs for the date range
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        agencyId: req.agencyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Query workers and their documents
    const workers = await prisma.worker.findMany({
      where: { agencyId: req.agencyId },
      include: {
        complianceDocuments: {
          include: { documentType: true }
        },
        expiryAlerts: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    // Get agency info
    const agency = await prisma.agency.findUnique({
      where: { id: req.agencyId }
    });

    // Create temp directory for ZIP
    const tempDir = join(process.cwd(), 'backend', 'uploads', 'audit-packs');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const packId = `audit-pack-${Date.now()}`;
    const zipPath = join(tempDir, `${packId}.zip`);

    // Create ZIP file
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        try {
          // Send email with download link
          const downloadLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/audit-packs/${packId}`;
          const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          await sendEmail({
            to: req.user.email,
            subject: `Audit Pack Export - ${agency.name}`,
            html: `
              <h2>Audit Pack Export Ready</h2>
              <p>Your audit pack for ${agency.name} (${startDate.toDateString()} to ${endDate.toDateString()}) is ready.</p>
              <p><a href="${downloadLink}">Download Audit Pack</a></p>
              <p>This link expires on ${expiryDate.toDateString()} at ${expiryDate.toTimeString()}.</p>
            `
          });

          res.status(201).json({
            data: {
              id: packId,
              agencyId: req.agencyId,
              dateFrom: startDate,
              dateTo: endDate,
              auditLogCount: auditLogs.length,
              workerCount: workers.length,
              downloadLink,
              expiresAt: expiryDate
            }
          });

          resolve();
        } catch (error) {
          reject(error);
        }
      });

      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      // Add audit log CSV
      const csvLines = [
        'Timestamp,Action,Entity,EntityId,UserId,UserEmail,Changes',
        ...auditLogs.map((log) =>
          [
            log.createdAt.toISOString(),
            log.action,
            log.entityType,
            log.entityId,
            log.userId,
            log.user?.email || 'N/A',
            JSON.stringify(log.changes || {})
          ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      archive.append(Buffer.from(csvLines), { name: 'audit-log.csv' });

      // Add metadata
      const metadata = {
        exportDate: new Date().toISOString(),
        agencyId: req.agencyId,
        agencyName: agency.name,
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        auditLogCount: auditLogs.length,
        workerCount: workers.length,
        exportedBy: req.user.id
      };

      archive.append(Buffer.from(JSON.stringify(metadata, null, 2)), { name: 'metadata.json' });

      // Add worker files
      workers.forEach((worker) => {
        const workerData = {
          id: worker.id,
          firstName: worker.firstName,
          lastName: worker.lastName,
          email: worker.email,
          jobTitle: worker.jobTitle,
          status: worker.status,
          documents: worker.complianceDocuments.map((doc) => ({
            id: doc.id,
            type: doc.documentType.name,
            status: doc.status,
            expiryDate: doc.expiryDate,
            uploadedAt: doc.createdAt
          })),
          alerts: worker.expiryAlerts.map((alert) => ({
            documentType: alert.documentTypeId,
            daysUntilExpiry: alert.daysUntilExpiry,
            alertedAt: alert.createdAt
          }))
        };

        const filename = `workers/${worker.id}-${worker.firstName.toLowerCase()}-${worker.lastName.toLowerCase()}.json`;
        archive.append(Buffer.from(JSON.stringify(workerData, null, 2)), { name: filename });
      });

      archive.finalize();
    });
  } catch (error) {
    console.error('Error exporting audit pack:', error);
    res.status(500).json({ error: 'Failed to export audit pack' });
  }
});

// ─── GET /api/audit-pack/:packId - Download audit pack ───────────────────────
router.get('/:packId', async (req, res) => {
  try {
    const { packId } = req.params;

    const tempDir = join(process.cwd(), 'backend', 'uploads', 'audit-packs');
    const zipPath = join(tempDir, `${packId}.zip`);

    // Check if file exists
    const { existsSync, statSync } = require('fs');
    if (!existsSync(zipPath)) {
      return res.status(404).json({ error: 'Audit pack not found or expired' });
    }

    // Check file age (7 days = 604800000 ms)
    const fileAge = Date.now() - statSync(zipPath).mtimeMs;
    const expiryMs = 7 * 24 * 60 * 60 * 1000;

    if (fileAge > expiryMs) {
      return res.status(410).json({ error: 'Audit pack has expired' });
    }

    // Send file
    res.download(zipPath, `audit-pack-${packId}.zip`, (err) => {
      if (err && !res.headersSent) {
        console.error('Error sending file:', err);
        res.status(500).json({ error: 'Failed to download audit pack' });
      }
    });
  } catch (error) {
    console.error('Error downloading audit pack:', error);
    res.status(500).json({ error: 'Failed to download audit pack' });
  }
});

module.exports = router;
