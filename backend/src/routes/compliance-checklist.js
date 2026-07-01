const express = require('express');
const Sentry = require('@sentry/node');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency, requireRole } = require('../lib/auth');

const router = express.Router();

// Only OWNER/ADMIN can view compliance checks
router.use(requireAgency);
router.use(requireRole(['OWNER', 'ADMIN']));

/**
 * GET /api/agency/compliance/cqc-checklist
 * R-AP-05: CQC Readiness Checklist
 * Shows coordinator what's needed for CQC inspection
 * Red/yellow/green status
 */
router.get('/cqc-checklist', async (req, res) => {
  try {
    const { agencyId } = req;

    // Fetch agency data
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId }
    });

    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Fetch all workers with compliance data
    const workers = await prisma.worker.findMany({
      where: { agencyId },
      include: {
        complianceDocuments: {
          include: { documentType: true }
        }
      }
    });

    // Fetch required document types
    const requiredDocTypes = await prisma.documentType.findMany({
      where: { agencyId, isRequired: true }
    });

    // Calculate compliance metrics
    const metrics = {
      totalWorkers: workers.length,
      compliantWorkers: 0,
      nonCompliantWorkers: 0,
      expiringDocumentsCount: 0,
      expiredDocumentsCount: 0
    };

    const workerChecks = workers.map(worker => {
      // Calculate compliance score
      const requiredIds = requiredDocTypes.map(dt => dt.id);
      const requiredDocs = worker.complianceDocuments.filter(d =>
        requiredIds.includes(d.documentTypeId)
      );
      const approvedCount = requiredDocs.filter(d => d.status === 'APPROVED').length;
      const compliantScore =
        requiredDocTypes.length > 0
          ? Math.round((approvedCount / requiredDocTypes.length) * 100)
          : 100;

      // Check for expiring/expired documents
      const expiringDocs = worker.complianceDocuments.filter(d => {
        if (!d.expiryDate) return false;
        const daysUntilExpiry = Math.floor(
          (new Date(d.expiryDate) - new Date()) / (24 * 60 * 60 * 1000)
        );
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
      });

      const expiredDocs = worker.complianceDocuments.filter(d => {
        if (!d.expiryDate) return false;
        const daysUntilExpiry = Math.floor(
          (new Date(d.expiryDate) - new Date()) / (24 * 60 * 60 * 1000)
        );
        return daysUntilExpiry < 0;
      });

      metrics.expiringDocumentsCount += expiringDocs.length;
      metrics.expiredDocumentsCount += expiredDocs.length;

      if (compliantScore >= 80) {
        metrics.compliantWorkers++;
      } else {
        metrics.nonCompliantWorkers++;
      }

      // Determine status
      let status = 'red';
      if (compliantScore >= 80 && expiringDocs.length === 0 && expiredDocs.length === 0) {
        status = 'green';
      } else if (compliantScore >= 50) {
        status = 'yellow';
      }

      return {
        workerId: worker.id,
        name: `${worker.firstName} ${worker.lastName}`,
        email: worker.email,
        status,
        compliantScore,
        totalDocs: requiredDocTypes.length,
        approvedDocs: approvedCount,
        expiringDocs: expiringDocs.length,
        expiredDocs: expiredDocs.length,
        issues: [
          ...(compliantScore < 80
            ? [`Missing ${requiredDocTypes.length - approvedCount} required documents`]
            : []),
          ...(expiringDocs.length > 0 ? [`${expiringDocs.length} documents expiring within 30 days`] : []),
          ...(expiredDocs.length > 0 ? [`${expiredDocs.length} documents have expired`] : [])
        ]
      };
    });

    // Calculate overall status
    const overallCompliance = metrics.totalWorkers > 0
      ? Math.round((metrics.compliantWorkers / metrics.totalWorkers) * 100)
      : 0;

    let overallStatus = 'red';
    if (overallCompliance >= 90 && metrics.expiredDocumentsCount === 0) {
      overallStatus = 'green';
    } else if (overallCompliance >= 70) {
      overallStatus = 'yellow';
    }

    // Generate actionable checklist
    const checklist = {
      agencyName: agency.name,
      generatedAt: new Date().toISOString(),
      overallStatus,
      overallCompliance,
      readyForCQC: overallStatus === 'green',
      metrics,
      workerChecks,
      actionItems: [
        ...(metrics.nonCompliantWorkers > 0
          ? [
              {
                priority: 'HIGH',
                action: `Review ${metrics.nonCompliantWorkers} non-compliant workers`,
                description: 'These workers do not meet compliance requirements',
                affectedWorkers: workerChecks
                  .filter(w => w.compliantScore < 80)
                  .map(w => w.name)
              }
            ]
          : []),
        ...(metrics.expiredDocumentsCount > 0
          ? [
              {
                priority: 'CRITICAL',
                action: `Address ${metrics.expiredDocumentsCount} expired documents immediately`,
                description: 'Cannot place workers on shift with expired documents',
                affectedWorkers: workerChecks
                  .filter(w => w.expiredDocs > 0)
                  .map(w => w.name)
              }
            ]
          : []),
        ...(metrics.expiringDocumentsCount > 0
          ? [
              {
                priority: 'MEDIUM',
                action: `Renew ${metrics.expiringDocumentsCount} documents expiring within 30 days`,
                description: 'Proactively renew to avoid compliance gaps',
                affectedWorkers: workerChecks
                  .filter(w => w.expiringDocs > 0)
                  .map(w => w.name)
              }
            ]
          : [])
      ]
    };

    res.status(200).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error fetching CQC checklist');
    Sentry.captureException(error, {
      tags: { context: 'cqcChecklistFetch' }
    });
    res.status(500).json({ error: error.message || 'Failed to fetch CQC checklist' });
  }
});

/**
 * GET /api/agency/compliance/readiness
 * Quick readiness status (simplified version of CQC checklist)
 */
router.get('/readiness', async (req, res) => {
  try {
    const { agencyId } = req;

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

    let compliantCount = 0;
    let expiredCount = 0;

    workers.forEach(worker => {
      const requiredIds = requiredDocTypes.map(dt => dt.id);
      const requiredDocs = worker.complianceDocuments.filter(d =>
        requiredIds.includes(d.documentTypeId)
      );
      const approvedCount = requiredDocs.filter(d => d.status === 'APPROVED').length;

      if (
        requiredDocTypes.length > 0 &&
        Math.round((approvedCount / requiredDocTypes.length) * 100) >= 80
      ) {
        compliantCount++;
      }

      const hasExpired = worker.complianceDocuments.some(d => {
        if (!d.expiryDate) return false;
        return new Date(d.expiryDate) < new Date();
      });

      if (hasExpired) {
        expiredCount++;
      }
    });

    const readyForCQC = expiredCount === 0 && compliantCount === workers.length;
    const status = readyForCQC ? 'green' : expiredCount > 0 ? 'red' : 'yellow';

    res.status(200).json({
      success: true,
      data: {
        status,
        readyForCQC,
        compliantWorkers: compliantCount,
        totalWorkers: workers.length,
        compliancePercentage: Math.round((compliantCount / workers.length) * 100) || 0,
        expiredDocuments: expiredCount
      }
    });
  } catch (error) {
    (req.log || logger).error({ err: error }, 'Error fetching readiness');
    Sentry.captureException(error, {
      tags: { context: 'readinessFetch' }
    });
    res.status(500).json({ error: error.message || 'Failed to fetch readiness' });
  }
});

module.exports = router;
