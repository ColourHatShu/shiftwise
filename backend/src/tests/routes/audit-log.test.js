/**
 * GET /api/audit-log — pagination clamping (no unbounded `take`).
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'a1';
        req.user = { id: 'u1', role: 'OWNER' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
}));

const prisma = require('../../lib/prisma');
const auditLogRouter = require('../../routes/audit-log');

describe('GET /api/audit-log — pagination clamp', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.auditLog = {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        };
        app.use('/api/audit-log', auditLogRouter);
    });

    it('clamps an oversized limit to 100', async () => {
        const res = await request(app).get('/api/audit-log?limit=99999');
        expect(res.status).toBe(200);
        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
        expect(res.body.pagination.limit).toBe(100);
    });

    it('uses the default limit (50) when none is provided', async () => {
        await request(app).get('/api/audit-log');
        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });

    it('honors a valid in-range limit', async () => {
        await request(app).get('/api/audit-log?limit=25');
        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
    });

    it('floors a negative/zero limit to 1', async () => {
        await request(app).get('/api/audit-log?limit=-5');
        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
    });

    it('clamps page to >= 1 so skip is never negative', async () => {
        await request(app).get('/api/audit-log?page=0&limit=10');
        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });
});
