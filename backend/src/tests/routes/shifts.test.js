/**
 * Shift CRUD Endpoints Integration Tests
 *
 * Tests POST /api/shifts, GET /api/shifts, PATCH /api/shifts/:id
 */

const request = require('supertest');
const express = require('express');
const shiftsRouter = require('../../routes/shifts');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        next();
    }
}));

const prisma = require('../../lib/prisma');

describe('Shift CRUD Endpoints', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/shifts', shiftsRouter);

        // Setup prisma mocks
        jest.clearAllMocks();
        prisma.shift = {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
    });

    describe('POST /api/shifts - Create Shift', () => {
        it('should create a new shift with valid data', async () => {
            const shiftData = {
                facilityName: 'St Mary\'s Hospital',
                shiftDate: '2026-05-20',
                startTime: '08:00',
                endTime: '16:00',
                role: 'Nurse',
                requiredCount: 3,
                complianceCheckup: true
            };

            prisma.shift.create.mockResolvedValue({
                id: 'shift-1',
                agencyId: 'test-agency-1',
                ...shiftData,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const res = await request(app)
                .post('/api/shifts')
                .send(shiftData);

            expect(res.status).toBe(201);
            expect(res.body.data.id).toBe('shift-1');
            expect(res.body.data.role).toBe('Nurse');
            expect(res.body.data.requiredCount).toBe(3);
        });

        it('should reject shift without required fields', async () => {
            const res = await request(app)
                .post('/api/shifts')
                .send({
                    facilityName: 'St Mary\'s Hospital'
                    // missing other required fields
                });

            expect(res.status).toBe(400);
        });

        it('should reject shift with invalid date format', async () => {
            const res = await request(app)
                .post('/api/shifts')
                .send({
                    facilityName: 'St Mary\'s Hospital',
                    shiftDate: 'invalid-date',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse',
                    requiredCount: 2
                });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/shifts - List Shifts', () => {
        it('should list all shifts for agency', async () => {
            const shifts = [
                {
                    id: 'shift-1',
                    agencyId: 'test-agency-1',
                    facilityName: 'St Mary\'s Hospital',
                    shiftDate: new Date('2026-05-20'),
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse',
                    requiredCount: 3,
                    complianceCheckup: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            prisma.shift.findMany.mockResolvedValue(shifts);

            const res = await request(app)
                .get('/api/shifts');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toBe('shift-1');
        });

        it('should filter shifts by date range', async () => {
            prisma.shift.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/shifts?startDate=2026-05-20&endDate=2026-05-25');

            expect(res.status).toBe(200);
            expect(prisma.shift.findMany).toHaveBeenCalled();
        });
    });

    describe('PATCH /api/shifts/:id - Update Shift', () => {
        it('should update an existing shift', async () => {
            const updatedShift = {
                id: 'shift-1',
                agencyId: 'test-agency-1',
                facilityName: 'St Mary\'s Hospital',
                shiftDate: new Date('2026-05-20'),
                startTime: '09:00',
                endTime: '17:00',
                role: 'Nurse',
                requiredCount: 4,
                complianceCheckup: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                assignments: []
            };

            prisma.shift.findFirst.mockResolvedValue({
                id: 'shift-1',
                agencyId: 'test-agency-1'
            });
            prisma.shift.update.mockResolvedValue(updatedShift);

            const res = await request(app)
                .patch('/api/shifts/shift-1')
                .send({
                    startTime: '09:00',
                    endTime: '17:00',
                    requiredCount: 4
                });

            expect(res.status).toBe(200);
            expect(res.body.data.startTime).toBe('09:00');
            expect(res.body.data.requiredCount).toBe(4);
        });

        it('should return 404 for non-existent shift', async () => {
            prisma.shift.update.mockRejectedValue(
                new Error('Record not found')
            );

            const res = await request(app)
                .patch('/api/shifts/nonexistent')
                .send({ requiredCount: 2 });

            expect(res.status).toBe(404);
        });
    });
});
