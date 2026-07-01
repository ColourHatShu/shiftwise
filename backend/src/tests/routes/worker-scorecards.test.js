/**
 * Worker reliability scorecards — aggregated from ShiftAssignment data.
 */

const request = require('supertest');
const express = require('express');
const scorecardsRouter = require('../../routes/worker-scorecards');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');

describe('GET /api/worker-scorecards', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.worker = { findMany: jest.fn() };
        prisma.shiftAssignment = { groupBy: jest.fn() };
        app.use('/api/worker-scorecards', scorecardsRouter);
    });

    it('aggregates confirmation stats per worker and computes confirmationRate', async () => {
        prisma.worker.findMany.mockResolvedValue([
            { id: 'w1', firstName: 'Jane', lastName: 'Doe' },
            { id: 'w2', firstName: 'John', lastName: 'Smith' },
        ]);
        prisma.shiftAssignment.groupBy.mockResolvedValue([
            { workerId: 'w1', workerConfirmation: 'confirmed', _count: { _all: 8 } },
            { workerId: 'w1', workerConfirmation: 'declined', _count: { _all: 2 } },
            { workerId: 'w2', workerConfirmation: 'confirmed', _count: { _all: 3 } },
            { workerId: 'w2', workerConfirmation: 'pending', _count: { _all: 1 } },
        ]);

        const res = await request(app).get('/api/worker-scorecards');

        expect(res.status).toBe(200);
        const byId = Object.fromEntries(res.body.data.map((s) => [s.workerId, s]));
        expect(byId.w1).toMatchObject({ totalAssignments: 10, confirmed: 8, declined: 2, pending: 0, confirmationRate: 80 });
        // w2: 3 confirmed of 3 responded (pending not counted as responded) → 100
        expect(byId.w2).toMatchObject({ totalAssignments: 4, confirmed: 3, declined: 0, pending: 1, confirmationRate: 100 });
    });

    it('returns a zeroed scorecard (rate null) for a worker with no assignments', async () => {
        prisma.worker.findMany.mockResolvedValue([{ id: 'w3', firstName: 'New', lastName: 'Hire' }]);
        prisma.shiftAssignment.groupBy.mockResolvedValue([]);

        const res = await request(app).get('/api/worker-scorecards');

        expect(res.status).toBe(200);
        expect(res.body.data[0]).toMatchObject({ workerId: 'w3', totalAssignments: 0, confirmationRate: null });
    });

    it('sorts best-first (highest confirmation rate), no-data workers last', async () => {
        prisma.worker.findMany.mockResolvedValue([
            { id: 'low', firstName: 'Low', lastName: 'Rate' },
            { id: 'high', firstName: 'High', lastName: 'Rate' },
            { id: 'none', firstName: 'No', lastName: 'Data' },
        ]);
        prisma.shiftAssignment.groupBy.mockResolvedValue([
            { workerId: 'low', workerConfirmation: 'confirmed', _count: { _all: 1 } },
            { workerId: 'low', workerConfirmation: 'declined', _count: { _all: 3 } }, // 25%
            { workerId: 'high', workerConfirmation: 'confirmed', _count: { _all: 4 } }, // 100%
        ]);

        const res = await request(app).get('/api/worker-scorecards');

        expect(res.body.data.map((s) => s.workerId)).toEqual(['high', 'low', 'none']);
    });

    it('is agency-scoped (queries filter by req.agencyId)', async () => {
        prisma.worker.findMany.mockResolvedValue([]);
        prisma.shiftAssignment.groupBy.mockResolvedValue([]);
        await request(app).get('/api/worker-scorecards');
        expect(prisma.worker.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agencyId: 'agency-1' } }));
        expect(prisma.shiftAssignment.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { agencyId: 'agency-1' } }));
    });

    it('500s gracefully on a DB error', async () => {
        prisma.worker.findMany.mockRejectedValue(new Error('db down'));
        prisma.shiftAssignment.groupBy.mockResolvedValue([]);
        const res = await request(app).get('/api/worker-scorecards');
        expect(res.status).toBe(500);
    });
});
