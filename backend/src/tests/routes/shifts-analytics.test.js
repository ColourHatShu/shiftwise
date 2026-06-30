/**
 * Shift Analytics Endpoints Integration Tests
 *
 * Tests GET /api/shifts/analytics/dashboard and heatmap
 */

const request = require('supertest');
const express = require('express');
const shiftsAnalyticsRouter = require('../../routes/shifts-analytics');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        next();
    }
}));

const prisma = require('../../lib/prisma');

describe('Shift Analytics Endpoints', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/shifts/analytics', shiftsAnalyticsRouter);

        jest.clearAllMocks();
        prisma.shift = {
            findMany: jest.fn()
        };
        prisma.workerAvailability = {
            findMany: jest.fn()
        };
    });

    describe('GET /api/shifts/analytics/dashboard', () => {
        it('should return analytics summary for all shifts', async () => {
            const shifts = [
                {
                    id: 'shift-1',
                    facilityName: 'St Mary Hospital',
                    role: 'Nurse',
                    requiredCount: 3,
                    assignments: [
                        { id: 'assign-1' },
                        { id: 'assign-2' }
                    ]
                },
                {
                    id: 'shift-2',
                    facilityName: 'Care Home',
                    role: 'Carer',
                    requiredCount: 2,
                    assignments: [
                        { id: 'assign-3' }
                    ]
                },
                {
                    id: 'shift-3',
                    facilityName: 'St Mary Hospital',
                    role: 'Nurse',
                    requiredCount: 1,
                    assignments: []
                }
            ];

            prisma.shift.findMany.mockResolvedValue(shifts);

            const res = await request(app)
                .get('/api/shifts/analytics/dashboard');

            expect(res.status).toBe(200);
            expect(res.body.data.summary.totalShifts).toBe(3);
            expect(res.body.data.summary.totalPositions).toBe(6);
            expect(res.body.data.summary.totalFilled).toBe(3);
            expect(res.body.data.summary.totalOpen).toBe(3);
            expect(res.body.data.summary.utilizationRate).toBe(50);
        });

        it('should group shifts by role', async () => {
            const shifts = [
                {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    role: 'Nurse',
                    requiredCount: 2,
                    assignments: [{ id: 'a1' }]
                },
                {
                    id: 'shift-2',
                    facilityName: 'Hospital',
                    role: 'Nurse',
                    requiredCount: 1,
                    assignments: [{ id: 'a2' }, { id: 'a3' }]
                }
            ];

            prisma.shift.findMany.mockResolvedValue(shifts);

            const res = await request(app)
                .get('/api/shifts/analytics/dashboard');

            expect(res.status).toBe(200);
            expect(res.body.data.byRole).toHaveLength(1);
            expect(res.body.data.byRole[0].role).toBe('Nurse');
            expect(res.body.data.byRole[0].shifts).toBe(2);
            expect(res.body.data.byRole[0].positions).toBe(3);
            expect(res.body.data.byRole[0].filled).toBe(3); // 1 + 2 assignments
        });

        it('should group shifts by facility', async () => {
            const shifts = [
                {
                    id: 'shift-1',
                    facilityName: 'Hospital A',
                    role: 'Nurse',
                    requiredCount: 2,
                    assignments: [{ id: 'a1' }]
                },
                {
                    id: 'shift-2',
                    facilityName: 'Hospital B',
                    role: 'Carer',
                    requiredCount: 1,
                    assignments: [{ id: 'a2' }]
                }
            ];

            prisma.shift.findMany.mockResolvedValue(shifts);

            const res = await request(app)
                .get('/api/shifts/analytics/dashboard');

            expect(res.status).toBe(200);
            expect(res.body.data.byFacility).toHaveLength(2);
            const facilities = res.body.data.byFacility.map(f => f.facility).sort();
            expect(facilities).toEqual(['Hospital A', 'Hospital B']);
        });

        it('should filter by date range', async () => {
            const shifts = [
                {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    role: 'Nurse',
                    requiredCount: 1,
                    assignments: []
                }
            ];

            prisma.shift.findMany.mockResolvedValue(shifts);

            const res = await request(app)
                .get('/api/shifts/analytics/dashboard?startDate=2026-05-20&endDate=2026-05-30');

            expect(res.status).toBe(200);
            expect(prisma.shift.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        shiftDate: expect.objectContaining({
                            gte: expect.any(Date),
                            lte: expect.any(Date)
                        })
                    })
                })
            );
        });

        it('should handle empty shifts', async () => {
            prisma.shift.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/shifts/analytics/dashboard');

            expect(res.status).toBe(200);
            expect(res.body.data.summary.totalShifts).toBe(0);
            expect(res.body.data.summary.utilizationRate).toBe(0);
            expect(res.body.data.byRole).toHaveLength(0);
            expect(res.body.data.byFacility).toHaveLength(0);
        });

        it('should calculate correct utilization rate', async () => {
            const shifts = [
                {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    role: 'Nurse',
                    requiredCount: 4,
                    assignments: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]
                }
            ];

            prisma.shift.findMany.mockResolvedValue(shifts);

            const res = await request(app)
                .get('/api/shifts/analytics/dashboard');

            expect(res.status).toBe(200);
            expect(res.body.data.summary.utilizationRate).toBe(75); // 3/4 = 75%
        });
    });

    describe('GET /api/shifts/analytics/heatmap', () => {
        it('should return worker availability data', async () => {
            const availability = [
                {
                    id: 'avail-1',
                    workerId: 'worker-1',
                    date: new Date('2026-05-25'),
                    status: 'AVAILABLE',
                    worker: {
                        id: 'worker-1',
                        firstName: 'John',
                        lastName: 'Doe'
                    }
                },
                {
                    id: 'avail-2',
                    workerId: 'worker-2',
                    date: new Date('2026-05-25'),
                    status: 'UNAVAILABLE',
                    worker: {
                        id: 'worker-2',
                        firstName: 'Jane',
                        lastName: 'Smith'
                    }
                }
            ];

            prisma.workerAvailability.findMany.mockResolvedValue(availability);

            const res = await request(app)
                .get('/api/shifts/analytics/heatmap');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].worker.firstName).toBe('John');
            expect(res.body.data[1].status).toBe('UNAVAILABLE');
        });

        it('should filter heatmap by date range', async () => {
            prisma.workerAvailability.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/shifts/analytics/heatmap?startDate=2026-05-20&endDate=2026-05-30');

            expect(res.status).toBe(200);
            expect(prisma.workerAvailability.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        date: expect.objectContaining({
                            gte: expect.any(Date),
                            lte: expect.any(Date)
                        })
                    })
                })
            );
        });

        it('should handle empty availability', async () => {
            prisma.workerAvailability.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/shifts/analytics/heatmap');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
});
