/**
 * Compliance state-changing endpoints (approve / reject document, deactivate
 * worker). These are compliance-critical + role-gated; this suite locks their
 * agency-scoped authorization (404 for out-of-agency targets) and happy paths.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../lib/prisma');
jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../lib/compliance-service', () => ({
    calculateScore: jest.fn(),
    getWorkersWithScores: jest.fn(),
    generateCSV: jest.fn(),
    generatePDF: jest.fn(),
    aggregateAlerts: jest.fn(),
}));
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
}));

const prisma = require('../../lib/prisma');
const complianceRouter = require('../../routes/compliance');

describe('compliance state-changing endpoints', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.complianceDocument = { findFirst: jest.fn(), update: jest.fn() };
        prisma.worker = { findFirst: jest.fn(), update: jest.fn() };
        prisma.auditLog = { create: jest.fn().mockResolvedValue({}) };
        app.use('/api/compliance', complianceRouter);
    });

    describe('POST /document/:documentId/approve', () => {
        it('404s for a document not in the agency', async () => {
            prisma.complianceDocument.findFirst.mockResolvedValue(null);
            const res = await request(app).post('/api/compliance/document/d1/approve');
            expect(res.status).toBe(404);
            expect(prisma.complianceDocument.update).not.toHaveBeenCalled();
        });

        it('approves an in-agency document', async () => {
            prisma.complianceDocument.findFirst.mockResolvedValue({ id: 'd1', workerId: 'w1', documentTypeId: 't1', agencyId: 'agency-1' });
            prisma.complianceDocument.update.mockResolvedValue({ id: 'd1', status: 'APPROVED' });
            const res = await request(app).post('/api/compliance/document/d1/approve');
            expect(res.status).toBe(200);
            expect(prisma.complianceDocument.update.mock.calls[0][0].data).toMatchObject({ status: 'APPROVED' });
            expect(prisma.auditLog.create).toHaveBeenCalled();
        });
    });

    describe('POST /document/:documentId/reject', () => {
        it('404s for a document not in the agency', async () => {
            prisma.complianceDocument.findFirst.mockResolvedValue(null);
            const res = await request(app).post('/api/compliance/document/d1/reject').send({ reason: 'blurry' });
            expect(res.status).toBe(404);
        });

        it('rejects an in-agency document with the given reason', async () => {
            prisma.complianceDocument.findFirst.mockResolvedValue({ id: 'd1', workerId: 'w1', documentTypeId: 't1', agencyId: 'agency-1' });
            prisma.complianceDocument.update.mockResolvedValue({ id: 'd1', status: 'REJECTED' });
            const res = await request(app).post('/api/compliance/document/d1/reject').send({ reason: 'blurry scan' });
            expect(res.status).toBe(200);
            expect(prisma.complianceDocument.update.mock.calls[0][0].data).toMatchObject({ status: 'REJECTED', rejectionReason: 'blurry scan' });
        });
    });

    describe('POST /worker/:workerId/deactivate', () => {
        it('404s for a worker not in the agency', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).post('/api/compliance/worker/w1/deactivate');
            expect(res.status).toBe(404);
            expect(prisma.worker.update).not.toHaveBeenCalled();
        });

        it('deactivates an in-agency worker (status INACTIVE)', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', firstName: 'Jane', lastName: 'Doe', agencyId: 'agency-1' });
            prisma.worker.update.mockResolvedValue({ id: 'w1', status: 'INACTIVE' });
            const res = await request(app).post('/api/compliance/worker/w1/deactivate');
            expect(res.status).toBe(200);
            expect(prisma.worker.update.mock.calls[0][0].data).toMatchObject({ status: 'INACTIVE' });
        });
    });
});
