/**
 * Dashboard stats. Locks the "expiring soon" window to start-of-day (so docs
 * expiring today are counted), plus agency-scoping and the response shape.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');
const dashboardRouter = require('../../routes/dashboard');

describe('GET /api/dashboard/stats', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        // Promise.all order: worker.count(total), doc.count(pending), doc.count(expiringSoon), worker.count(compliant)
        prisma.worker = { count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(7) };
        prisma.complianceDocument = { count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(5) };
        app.use('/api/dashboard', dashboardRouter);
    });

    it('returns the four agency-scoped stats', async () => {
        const res = await request(app).get('/api/dashboard/stats');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ totalWorkers: 10, documentsPending: 2, expiringSoon: 5, compliantWorkers: 7 });
        // agency scoping on the counts
        expect(prisma.worker.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ agencyId: 'agency-1' }) }));
    });

    it('excludes workers with an approved-but-expired doc from compliantWorkers', async () => {
        await request(app).get('/api/dashboard/stats');
        // compliantWorkers is the 2nd worker.count call.
        const compliantArg = prisma.worker.count.mock.calls[1][0];
        const none = compliantArg.where.complianceDocuments.none;
        // Must catch approved-but-past-expiry docs, not just the (never-set) EXPIRED status.
        const expiredApproved = none.OR.find((c) => c.status === 'APPROVED');
        expect(expiredApproved).toBeDefined();
        expect(expiredApproved.expiryDate).toHaveProperty('lt');
        expect(expiredApproved.expiryDate.lt.getUTCHours()).toBe(0); // start-of-day boundary
    });

    it('counts "expiring soon" from start-of-day (UTC midnight) so today is included', async () => {
        await request(app).get('/api/dashboard/stats');
        // The expiring-soon count is the 2nd complianceDocument.count call.
        const expiringArg = prisma.complianceDocument.count.mock.calls[1][0];
        const gte = expiringArg.where.expiryDate.gte;
        expect(gte.getUTCHours()).toBe(0);
        expect(gte.getUTCMinutes()).toBe(0);
        expect(gte.getUTCSeconds()).toBe(0);
        expect(expiringArg.where.expiryDate.lte).toBeInstanceOf(Date);
    });

    it('500s gracefully on a DB error', async () => {
        prisma.worker.count = jest.fn().mockRejectedValue(new Error('db down'));
        prisma.complianceDocument.count = jest.fn().mockResolvedValue(0);
        const res = await request(app).get('/api/dashboard/stats');
        expect(res.status).toBe(500);
    });
});
