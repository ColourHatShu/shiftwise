/**
 * Expiring-documents worklist — overdue + soon-expiring compliance docs.
 */

const request = require('supertest');
const express = require('express');
const expiringRouter = require('../../routes/expiring-documents');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe('GET /api/expiring-documents', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.complianceDocument = { findMany: jest.fn() };
        app.use('/api/expiring-documents', expiringRouter);
    });

    it('flattens docs with daysUntilExpiry + overdue flag and a summary', async () => {
        prisma.complianceDocument.findMany.mockResolvedValue([
            { id: 'd1', expiryDate: daysFromNow(-3), status: 'APPROVED', worker: { id: 'w1', firstName: 'Jane', lastName: 'Doe' }, documentType: { name: 'DBS' } },
            { id: 'd2', expiryDate: daysFromNow(10), status: 'APPROVED', worker: { id: 'w2', firstName: 'John', lastName: 'Smith' }, documentType: { name: 'RTW' } },
        ]);

        const res = await request(app).get('/api/expiring-documents');

        expect(res.status).toBe(200);
        const byId = Object.fromEntries(res.body.data.map((d) => [d.documentId, d]));
        expect(byId.d1).toMatchObject({ workerName: 'Jane Doe', documentType: 'DBS', overdue: true });
        expect(byId.d1.daysUntilExpiry).toBeLessThan(0);
        expect(byId.d2).toMatchObject({ workerName: 'John Smith', overdue: false });
        expect(res.body.summary).toMatchObject({ total: 2, overdue: 1, windowDays: 30 });
    });

    it('clamps the days window (1..365) and queries active workers only', async () => {
        prisma.complianceDocument.findMany.mockResolvedValue([]);
        const res = await request(app).get('/api/expiring-documents?days=99999');
        expect(res.body.summary.windowDays).toBe(365);
        const arg = prisma.complianceDocument.findMany.mock.calls[0][0];
        expect(arg.where.agencyId).toBe('agency-1');
        expect(arg.where.worker).toEqual({ status: 'ACTIVE' });
        expect(arg.where.expiryDate).toHaveProperty('lte');
        expect(arg.orderBy).toEqual({ expiryDate: 'asc' });
    });

    it('defaults the window to 30 days', async () => {
        prisma.complianceDocument.findMany.mockResolvedValue([]);
        const res = await request(app).get('/api/expiring-documents');
        expect(res.body).toEqual({ data: [], summary: { total: 0, overdue: 0, windowDays: 30 } });
    });

    it('500s gracefully on a DB error', async () => {
        prisma.complianceDocument.findMany.mockRejectedValue(new Error('db down'));
        const res = await request(app).get('/api/expiring-documents');
        expect(res.status).toBe(500);
    });
});
