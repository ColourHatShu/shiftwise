/**
 * Bulk Shift Upload Integration Tests
 *
 * Tests POST /api/shifts/bulk/upload with CSV parsing and validation
 */

const request = require('supertest');
const express = require('express');
const shiftsBulkRouter = require('../../routes/shifts-bulk');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        next();
    }
}));

const prisma = require('../../lib/prisma');

describe('Shift Bulk Upload Endpoints', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/shifts/bulk', shiftsBulkRouter);

        jest.clearAllMocks();
        prisma.shift = {
            create: jest.fn()
        };
    });

    describe('POST /api/shifts/bulk/upload - CSV Bulk Upload', () => {
        it('should upload multiple shifts from valid CSV', async () => {
            const csvData = `facilityName,shiftDate,startTime,endTime,role,requiredCount,notes,complianceCheckup
St Mary's Hospital,2026-05-25,08:00,16:00,Nurse,3,Ward 5,false
Central Care Home,2026-05-25,12:00,20:00,Carer,2,Main facility,true`;

            prisma.shift.create
                .mockResolvedValueOnce({
                    id: 'shift-1',
                    facilityName: "St Mary's Hospital",
                    shiftDate: new Date('2026-05-25'),
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse',
                    requiredCount: 3,
                    notes: 'Ward 5'
                })
                .mockResolvedValueOnce({
                    id: 'shift-2',
                    facilityName: 'Central Care Home',
                    shiftDate: new Date('2026-05-25'),
                    startTime: '12:00',
                    endTime: '20:00',
                    role: 'Carer',
                    requiredCount: 2,
                    notes: 'Main facility'
                });

            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData });

            expect(res.status).toBe(201);
            expect(res.body.results.total).toBe(2);
            expect(res.body.results.succeeded).toBe(2);
            expect(res.body.results.failed).toBe(0);
            expect(res.body.createdShifts).toHaveLength(2);
        });

        it('should reject CSV with missing required fields', async () => {
            const csvData = `facilityName,shiftDate,role
St Mary's Hospital,2026-05-25,Nurse`;

            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData });

            expect(res.status).toBe(201); // Partial success
            expect(res.body.results.failed).toBeGreaterThan(0);
            expect(res.body.results.errors.length).toBeGreaterThan(0);
        });

        it('should reject invalid date format', async () => {
            const csvData = `facilityName,shiftDate,startTime,endTime,role,requiredCount
St Mary's Hospital,invalid-date,08:00,16:00,Nurse,3`;

            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData });

            expect(res.status).toBe(201);
            expect(res.body.results.failed).toBe(1);
            expect(res.body.results.errors[0].error).toContain('Invalid shiftDate');
        });

        it('should reject invalid time format', async () => {
            const csvData = `facilityName,shiftDate,startTime,endTime,role,requiredCount
St Mary's Hospital,2026-05-25,8:00,16:00,Nurse,3`;

            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData });

            expect(res.status).toBe(201);
            expect(res.body.results.failed).toBe(1);
            expect(res.body.results.errors[0].error).toContain('Invalid startTime');
        });

        it('should reject when endTime is before startTime', async () => {
            const csvData = `facilityName,shiftDate,startTime,endTime,role,requiredCount
St Mary's Hospital,2026-05-25,16:00,08:00,Nurse,3`;

            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData });

            expect(res.status).toBe(201);
            expect(res.body.results.failed).toBe(1);
            expect(res.body.results.errors[0].error).toContain('endTime must be after startTime');
        });

        it('should reject invalid requiredCount', async () => {
            const csvData = `facilityName,shiftDate,startTime,endTime,role,requiredCount
St Mary's Hospital,2026-05-25,08:00,16:00,Nurse,0`;

            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData });

            expect(res.status).toBe(201);
            expect(res.body.results.failed).toBe(1);
            expect(res.body.results.errors[0].error).toContain('positive integer');
        });

        it('should handle partial success with mixed valid/invalid rows', async () => {
            const csvData = `facilityName,shiftDate,startTime,endTime,role,requiredCount
St Mary's Hospital,2026-05-25,08:00,16:00,Nurse,3
,2026-05-25,12:00,20:00,Carer,2
Central Care Home,2026-05-26,09:00,17:00,Support Worker,1`;

            prisma.shift.create
                .mockResolvedValueOnce({ id: 'shift-1' })
                .mockResolvedValueOnce({ id: 'shift-3' });

            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData });

            expect(res.status).toBe(201);
            expect(res.body.results.succeeded).toBe(2);
            expect(res.body.results.failed).toBe(1);
        });

        it('should reject empty CSV', async () => {
            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({ csvData: '' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('CSV is empty');
        });

        it('should reject missing csvData field', async () => {
            const res = await request(app)
                .post('/api/shifts/bulk/upload')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('CSV is empty');
        });
    });

    describe('GET /api/shifts/bulk/template - Download Template', () => {
        it('should return CSV template', async () => {
            const res = await request(app)
                .get('/api/shifts/bulk/template');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.text).toContain('facilityName,shiftDate,startTime,endTime,role,requiredCount');
            expect(res.text).toContain("St Mary's Hospital");
        });
    });
});
