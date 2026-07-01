/**
 * Worker availability CRUD (coordinator-facing, agency-scoped).
 * Covers authorization (404 for out-of-agency workers), input validation,
 * and the GET / POST(upsert) / DELETE happy paths.
 */

const request = require('supertest');
const express = require('express');
const availabilityRouter = require('../../routes/worker-availability');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');

describe('worker-availability routes', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.worker = { findFirst: jest.fn() };
        prisma.workerAvailability = { findMany: jest.fn(), upsert: jest.fn(), delete: jest.fn() };
        app.use('/api/workers/:workerId/availability', availabilityRouter);
    });

    describe('GET /', () => {
        it('returns availability for an in-agency worker', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1' });
            prisma.workerAvailability.findMany.mockResolvedValue([
                { id: 'a1', workerId: 'w1', date: new Date('2026-07-10'), status: 'AVAILABLE' },
            ]);

            const res = await request(app).get('/api/workers/w1/availability');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(prisma.workerAvailability.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ workerId: 'w1', agencyId: 'agency-1' }) })
            );
        });

        it('404s when the worker is not in the agency', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).get('/api/workers/other/availability');
            expect(res.status).toBe(404);
            expect(prisma.workerAvailability.findMany).not.toHaveBeenCalled();
        });

        it('applies a date-range filter when provided', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1' });
            prisma.workerAvailability.findMany.mockResolvedValue([]);
            await request(app).get('/api/workers/w1/availability').query({ startDate: '2026-07-01', endDate: '2026-07-31' });
            const arg = prisma.workerAvailability.findMany.mock.calls[0][0];
            expect(arg.where.date).toHaveProperty('gte');
            expect(arg.where.date).toHaveProperty('lte');
        });
    });

    describe('POST /', () => {
        it('400s on missing fields', async () => {
            const res = await request(app).post('/api/workers/w1/availability').send({ date: '2026-07-10' });
            expect(res.status).toBe(400);
        });

        it('400s on an invalid status', async () => {
            const res = await request(app).post('/api/workers/w1/availability').send({ date: '2026-07-10', status: 'MAYBE' });
            expect(res.status).toBe(400);
        });

        it('404s when the worker is not in the agency', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).post('/api/workers/other/availability').send({ date: '2026-07-10', status: 'AVAILABLE' });
            expect(res.status).toBe(404);
            expect(prisma.workerAvailability.upsert).not.toHaveBeenCalled();
        });

        it('upserts availability for an in-agency worker (201, status upper-cased)', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1' });
            prisma.workerAvailability.upsert.mockResolvedValue({ id: 'a1', workerId: 'w1', status: 'ON_LEAVE' });
            const res = await request(app).post('/api/workers/w1/availability').send({ date: '2026-07-10', status: 'on_leave', notes: 'holiday' });
            expect(res.status).toBe(201);
            const arg = prisma.workerAvailability.upsert.mock.calls[0][0];
            expect(arg.create).toMatchObject({ workerId: 'w1', agencyId: 'agency-1', status: 'ON_LEAVE' });
        });
    });

    describe('DELETE /:date', () => {
        it('404s when the worker is not in the agency', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).delete('/api/workers/other/availability/2026-07-10');
            expect(res.status).toBe(404);
            expect(prisma.workerAvailability.delete).not.toHaveBeenCalled();
        });

        it('deletes an entry for an in-agency worker', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1' });
            prisma.workerAvailability.delete.mockResolvedValue({});
            const res = await request(app).delete('/api/workers/w1/availability/2026-07-10');
            expect(res.status).toBe(200);
        });

        it('404s (P2025) when the entry does not exist', async () => {
            prisma.worker.findFirst.mockResolvedValue({ id: 'w1', agencyId: 'agency-1' });
            prisma.workerAvailability.delete.mockRejectedValue({ code: 'P2025' });
            const res = await request(app).delete('/api/workers/w1/availability/2026-07-10');
            expect(res.status).toBe(404);
        });
    });
});
