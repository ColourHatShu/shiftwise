/**
 * Alert admin/test endpoints. Locks the security hardening: production guard
 * (403 unless dev), and agency-scoping on the trigger + reset (a prior BLOCKER
 * was cross-tenant/unauthenticated).
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../services/cronService', () => ({ checkExpiriesAndAlert: jest.fn() }));
jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.userId = 'user-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
}));

const { checkExpiriesAndAlert } = require('../../services/cronService');
const prisma = require('../../lib/prisma');
const alertsRouter = require('../../routes/alerts');

describe('alerts admin endpoints', () => {
    let app;
    const originalEnv = process.env.NODE_ENV;
    const originalFlag = process.env.ALLOW_ALERT_TEST_ENDPOINTS;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = 'test'; // dev mode (isDevMode true)
        delete process.env.ALLOW_ALERT_TEST_ENDPOINTS;
        app = express();
        app.use(express.json());
        prisma.expiryAlert = { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) };
        prisma.auditLog = { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) };
        app.use('/api/alerts', alertsRouter);
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        if (originalFlag === undefined) delete process.env.ALLOW_ALERT_TEST_ENDPOINTS;
        else process.env.ALLOW_ALERT_TEST_ENDPOINTS = originalFlag;
    });

    describe('GET /test', () => {
        it('triggers the expiry scan scoped to the caller\'s agency', async () => {
            checkExpiriesAndAlert.mockResolvedValue({ alertsSent: 2, triggeredDocuments: [] });
            const res = await request(app).get('/api/alerts/test');
            expect(res.status).toBe(200);
            expect(checkExpiriesAndAlert).toHaveBeenCalledWith({ agencyId: 'agency-1' });
        });

        it('403s in production (test endpoints disabled)', async () => {
            process.env.NODE_ENV = 'production';
            const res = await request(app).get('/api/alerts/test');
            expect(res.status).toBe(403);
            expect(checkExpiriesAndAlert).not.toHaveBeenCalled();
        });
    });

    describe('DELETE /reset-test', () => {
        it('deletes only the caller-agency\'s alerts for today', async () => {
            const res = await request(app).delete('/api/alerts/reset-test');
            expect(res.status).toBe(200);
            expect(res.body.deletedRecords).toEqual({ expiryAlerts: 3, auditLogs: 2 });
            // expiry alerts scoped via the related document's agency
            expect(prisma.expiryAlert.deleteMany.mock.calls[0][0].where.complianceDocument).toEqual({ agencyId: 'agency-1' });
            // audit logs scoped by agencyId
            expect(prisma.auditLog.deleteMany.mock.calls[0][0].where.agencyId).toBe('agency-1');
        });

        it('403s in production', async () => {
            process.env.NODE_ENV = 'production';
            const res = await request(app).delete('/api/alerts/reset-test');
            expect(res.status).toBe(403);
            expect(prisma.expiryAlert.deleteMany).not.toHaveBeenCalled();
        });
    });
});
