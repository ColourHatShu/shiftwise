/**
 * Compliance readiness endpoint. Covers the empty-agency guard (an agency with
 * no workers must not read as "green / ready"), div-by-zero safety, and the
 * green/red/yellow status logic.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../lib/prisma');
jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
}));

const prisma = require('../../lib/prisma');
const checklistRouter = require('../../routes/compliance-checklist');

const past = new Date(Date.now() - 86400000);
const future = new Date(Date.now() + 30 * 86400000);

describe('GET /api/.../readiness', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.worker = { findMany: jest.fn() };
        prisma.documentType = { findMany: jest.fn() };
        app.use('/api/compliance', checklistRouter);
    });

    it('does NOT report an empty agency as green/ready (0 workers)', async () => {
        prisma.worker.findMany.mockResolvedValue([]);
        prisma.documentType.findMany.mockResolvedValue([{ id: 'dt1' }]);
        const res = await request(app).get('/api/compliance/readiness');
        expect(res.status).toBe(200);
        expect(res.body.data.readyForCQC).toBe(false);
        expect(res.body.data.status).toBe('yellow');
        expect(res.body.data.totalWorkers).toBe(0);
        expect(res.body.data.compliancePercentage).toBe(0); // no NaN
    });

    it('is green when all workers are compliant and nothing is expired', async () => {
        prisma.documentType.findMany.mockResolvedValue([{ id: 'dt1' }]);
        prisma.worker.findMany.mockResolvedValue([
            { complianceDocuments: [{ documentTypeId: 'dt1', status: 'APPROVED', expiryDate: future }] },
        ]);
        const res = await request(app).get('/api/compliance/readiness');
        expect(res.body.data).toMatchObject({ status: 'green', readyForCQC: true, compliantWorkers: 1, totalWorkers: 1 });
    });

    it('is red when a document is expired', async () => {
        prisma.documentType.findMany.mockResolvedValue([{ id: 'dt1' }]);
        prisma.worker.findMany.mockResolvedValue([
            { complianceDocuments: [{ documentTypeId: 'dt1', status: 'APPROVED', expiryDate: past }] },
        ]);
        const res = await request(app).get('/api/compliance/readiness');
        expect(res.body.data.status).toBe('red');
        expect(res.body.data.expiredDocuments).toBe(1);
    });

    it('is yellow when a worker is non-compliant but nothing is expired', async () => {
        prisma.documentType.findMany.mockResolvedValue([{ id: 'dt1' }]);
        prisma.worker.findMany.mockResolvedValue([
            { complianceDocuments: [] }, // missing the required doc → not compliant, none expired
        ]);
        const res = await request(app).get('/api/compliance/readiness');
        expect(res.body.data.status).toBe('yellow');
        expect(res.body.data.readyForCQC).toBe(false);
    });
});
