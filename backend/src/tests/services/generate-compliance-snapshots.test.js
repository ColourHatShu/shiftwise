/**
 * generateComplianceSnapshots must not record expired-but-APPROVED docs as
 * compliant — otherwise historical compliance snapshots are falsely green
 * (same class as the live compliance-score bug).
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../services/emailService', () => ({ sendExpiryAlert: jest.fn(), sendWorkerExpiryAlert: jest.fn() }));
jest.mock('../../lib/prisma');

const prisma = require('../../lib/prisma');
const { generateComplianceSnapshots } = require('../../services/cronService');

const past = new Date(Date.now() - 5 * 86400000);
const future = new Date(Date.now() + 30 * 86400000);

const worker = (id, expiryDate) => ({
    id, firstName: id, lastName: 'X', email: `${id}@x.com`, jobTitle: 'Nurse', status: 'ACTIVE',
    complianceDocuments: [{ id: `d-${id}`, documentTypeId: 'dt1', status: 'APPROVED', expiryDate, documentType: { name: 'DBS' }, uploadedAt: new Date() }],
});

describe('generateComplianceSnapshots — expiry-aware scoring', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.agency = { findMany: jest.fn().mockResolvedValue([{ id: 'agency-1', name: 'Acme', isActive: true }]) };
        prisma.documentType = { findMany: jest.fn().mockResolvedValue([{ id: 'dt1', name: 'DBS', isRequired: true }]) };
        prisma.worker = { findMany: jest.fn().mockResolvedValue([worker('expired', past), worker('valid', future)]) };
        prisma.complianceSnapshot = { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) };
    });

    it('excludes expired-approved docs from the snapshot score + compliant count', async () => {
        await generateComplianceSnapshots();
        const snapshot = prisma.complianceSnapshot.create.mock.calls[0][0].data.data;
        const byId = Object.fromEntries(snapshot.workers.map((w) => [w.id, w]));
        expect(byId.expired.complianceScore).toBe(0);  // expired → not counted
        expect(byId.valid.complianceScore).toBe(100);  // valid → counted
        expect(snapshot.summary.compliantWorkers).toBe(1); // only the valid worker
    });
});
