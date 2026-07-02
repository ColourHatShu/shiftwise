/**
 * Workers CRUD (agency-scoped). Covers validation, duplicate handling,
 * ownership 404s, and the PATCH null-field regression (phone/notes = null
 * must not crash with null.trim()).
 */

const request = require('supertest');
const express = require('express');
const workersRouter = require('../../routes/workers');

// Mutable so a test can exercise role-gating; defaults to OWNER (passes role checks).
let mockCurrentRole = 'OWNER';
jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: mockCurrentRole };
        next();
    },
    // Enforcing mock so requireRole-guarded routes are genuinely tested.
    requireRole: (roles) => (req, res, next) =>
        roles && req.user && !roles.includes(req.user.role)
            ? res.status(403).json({ error: 'Forbidden: insufficient role' })
            : next(),
}));

const prisma = require('../../lib/prisma');

describe('workers routes', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentRole = 'OWNER';
        app = express();
        app.use(express.json());
        prisma.worker = {
            findMany: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        app.use('/api/workers', workersRouter);
    });

    describe('POST /api/workers', () => {
        it('400s on missing required fields', async () => {
            const res = await request(app).post('/api/workers').send({ firstName: 'Jane' });
            expect(res.status).toBe(400);
        });

        it('409s on a duplicate email in the agency', async () => {
            prisma.worker.findUnique.mockResolvedValue({ id: 'existing' });
            const res = await request(app).post('/api/workers').send({
                firstName: 'Jane', lastName: 'Doe', email: 'jane@x.com', jobRole: 'Nurse', startDate: '2026-07-01',
            });
            expect(res.status).toBe(409);
            expect(prisma.worker.create).not.toHaveBeenCalled();
        });

        it('creates a worker (201, agency-scoped, status ACTIVE)', async () => {
            prisma.worker.findUnique.mockResolvedValue(null);
            prisma.worker.create.mockResolvedValue({ id: 'w1', firstName: 'Jane' });
            const res = await request(app).post('/api/workers').send({
                firstName: 'Jane', lastName: 'Doe', email: 'jane@x.com', jobRole: 'Nurse', startDate: '2026-07-01',
            });
            expect(res.status).toBe(201);
            const arg = prisma.worker.create.mock.calls[0][0];
            expect(arg.data).toMatchObject({ agencyId: 'agency-1', status: 'ACTIVE', jobTitle: 'Nurse' });
        });
    });

    describe('GET /api/workers/:id', () => {
        it('404s for a worker not in the agency', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).get('/api/workers/nope');
            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /api/workers/:id', () => {
        it('does not crash when phone and notes are explicitly null (regression)', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1' });
            prisma.worker.update.mockResolvedValue({ id: 'w1', phone: null, notes: null });

            const res = await request(app).patch('/api/workers/w1').send({ phone: null, notes: null });

            expect(res.status).toBe(200);
            const arg = prisma.worker.update.mock.calls[0][0];
            expect(arg.data).toMatchObject({ phone: null, notes: null });
        });

        it('trims string fields and 404s when not in the agency', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).patch('/api/workers/nope').send({ firstName: 'X' });
            expect(res.status).toBe(404);
            expect(prisma.worker.update).not.toHaveBeenCalled();
        });
    });

    describe('DELETE /api/workers/:id', () => {
        it('404s for a worker not in the agency', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).delete('/api/workers/nope');
            expect(res.status).toBe(404);
            expect(prisma.worker.delete).not.toHaveBeenCalled();
        });

        it('deletes an in-agency worker', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1' });
            prisma.worker.delete.mockResolvedValue({});
            const res = await request(app).delete('/api/workers/w1');
            expect(res.status).toBe(200);
        });

        it('403s for a non-admin role (delete is role-gated)', async () => {
            mockCurrentRole = 'MEMBER';
            const res = await request(app).delete('/api/workers/w1');
            expect(res.status).toBe(403);
            expect(prisma.worker.findFirst).not.toHaveBeenCalled();
        });
    });

    describe('PATCH /api/workers/:id/reactivate', () => {
        it('reactivates an in-agency worker for an OWNER/ADMIN (status ACTIVE)', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1', status: 'INACTIVE' });
            prisma.worker.update.mockResolvedValue({ id: 'w1', status: 'ACTIVE' });
            const res = await request(app).patch('/api/workers/w1/reactivate');
            expect(res.status).toBe(200);
            expect(prisma.worker.update.mock.calls[0][0].data).toMatchObject({ status: 'ACTIVE' });
        });

        it('403s for a non-admin role (parity with deactivate)', async () => {
            mockCurrentRole = 'MEMBER';
            const res = await request(app).patch('/api/workers/w1/reactivate');
            expect(res.status).toBe(403);
            expect(prisma.worker.update).not.toHaveBeenCalled();
        });
    });
});
