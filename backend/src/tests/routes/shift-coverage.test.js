/**
 * Shift coverage — upcoming shifts' fill status from Shift + ShiftAssignment data.
 */

const request = require('supertest');
const express = require('express');
const coverageRouter = require('../../routes/shift-coverage');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');

const assignments = (confirmed, otherPending = 0) => [
    ...Array.from({ length: confirmed }, () => ({ workerConfirmation: 'confirmed' })),
    ...Array.from({ length: otherPending }, () => ({ workerConfirmation: 'pending' })),
];

describe('GET /api/shift-coverage', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.shift = { findMany: jest.fn() };
        app.use('/api/shift-coverage', coverageRouter);
    });

    it('computes coverage + status per upcoming shift and a summary', async () => {
        prisma.shift.findMany.mockResolvedValue([
            { id: 's1', facilityName: 'A', shiftDate: '2026-07-10', role: 'Nurse', requiredCount: 3, assignments: assignments(3) },       // filled
            { id: 's2', facilityName: 'B', shiftDate: '2026-07-11', role: 'Carer', requiredCount: 3, assignments: assignments(1, 1) },    // understaffed
            { id: 's3', facilityName: 'C', shiftDate: '2026-07-12', role: 'Support', requiredCount: 2, assignments: assignments(0, 2) },  // unfilled (2 pending, 0 confirmed)
        ]);

        const res = await request(app).get('/api/shift-coverage');

        expect(res.status).toBe(200);
        const byId = Object.fromEntries(res.body.data.map((c) => [c.shiftId, c]));
        expect(byId.s1).toMatchObject({ requiredCount: 3, confirmedCount: 3, shortfall: 0, status: 'filled' });
        expect(byId.s2).toMatchObject({ assignedCount: 2, confirmedCount: 1, shortfall: 2, status: 'understaffed' });
        expect(byId.s3).toMatchObject({ assignedCount: 2, confirmedCount: 0, shortfall: 2, status: 'unfilled' });
        expect(res.body.summary).toEqual({ totalUpcoming: 3, needingAttention: 2 });
    });

    it('only queries upcoming shifts for the agency', async () => {
        prisma.shift.findMany.mockResolvedValue([]);
        await request(app).get('/api/shift-coverage');
        const arg = prisma.shift.findMany.mock.calls[0][0];
        expect(arg.where.agencyId).toBe('agency-1');
        expect(arg.where.shiftDate).toHaveProperty('gte'); // upcoming filter
        expect(arg.orderBy).toEqual({ shiftDate: 'asc' });
    });

    it('returns an empty result set cleanly', async () => {
        prisma.shift.findMany.mockResolvedValue([]);
        const res = await request(app).get('/api/shift-coverage');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: [], summary: { totalUpcoming: 0, needingAttention: 0 } });
    });

    it('500s gracefully on a DB error', async () => {
        prisma.shift.findMany.mockRejectedValue(new Error('db down'));
        const res = await request(app).get('/api/shift-coverage');
        expect(res.status).toBe(500);
    });
});
