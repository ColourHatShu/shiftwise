/**
 * Shift Templates Endpoints
 * Tests CRUD for reusable shift templates (GET / POST / DELETE).
 */

const request = require('supertest');
const express = require('express');
const shiftTemplatesRouter = require('../../routes/shift-templates');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');

describe('Shift Templates Endpoints', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());

        prisma.shiftTemplate = {
            findMany: jest.fn(),
            create: jest.fn(),
            findFirst: jest.fn(),
            delete: jest.fn(),
        };

        app.use('/api/shift-templates', shiftTemplatesRouter);
    });

    describe('GET /api/shift-templates', () => {
        it('lists the agency templates', async () => {
            prisma.shiftTemplate.findMany.mockResolvedValue([
                { id: 't1', name: 'Weekday Nurse', facilityName: 'St Mary', role: 'Nurse' },
            ]);
            const res = await request(app).get('/api/shift-templates');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { agencyId: 'test-agency-1' } })
            );
        });
    });

    describe('POST /api/shift-templates', () => {
        it('creates a template with valid fields', async () => {
            prisma.shiftTemplate.create.mockResolvedValue({ id: 't1', name: 'Weekday Nurse' });
            const res = await request(app).post('/api/shift-templates').send({
                name: 'Weekday Nurse',
                facilityName: 'St Mary',
                startTime: '08:00',
                endTime: '16:00',
                role: 'Nurse',
                requiredCount: 2,
            });
            expect(res.status).toBe(201);
            expect(res.body.data.id).toBe('t1');
            expect(prisma.shiftTemplate.create).toHaveBeenCalled();
        });

        it('rejects missing required fields', async () => {
            const res = await request(app).post('/api/shift-templates').send({ name: 'Incomplete' });
            expect(res.status).toBe(400);
            expect(prisma.shiftTemplate.create).not.toHaveBeenCalled();
        });

        it('rejects a non-positive requiredCount', async () => {
            const res = await request(app).post('/api/shift-templates').send({
                name: 'Bad', facilityName: 'F', startTime: '08:00', endTime: '16:00', role: 'Nurse', requiredCount: 0,
            });
            expect(res.status).toBe(400);
        });

        it('returns 409 on duplicate name', async () => {
            prisma.shiftTemplate.create.mockRejectedValue({ code: 'P2002' });
            const res = await request(app).post('/api/shift-templates').send({
                name: 'Dup', facilityName: 'F', startTime: '08:00', endTime: '16:00', role: 'Nurse', requiredCount: 1,
            });
            expect(res.status).toBe(409);
        });
    });

    describe('DELETE /api/shift-templates/:id', () => {
        it('deletes an owned template', async () => {
            prisma.shiftTemplate.findFirst.mockResolvedValue({ id: 't1', agencyId: 'test-agency-1' });
            prisma.shiftTemplate.delete.mockResolvedValue({ id: 't1' });
            const res = await request(app).delete('/api/shift-templates/t1');
            expect(res.status).toBe(200);
            expect(prisma.shiftTemplate.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
        });

        it('returns 404 for a template not in the agency', async () => {
            prisma.shiftTemplate.findFirst.mockResolvedValue(null);
            const res = await request(app).delete('/api/shift-templates/nope');
            expect(res.status).toBe(404);
            expect(prisma.shiftTemplate.delete).not.toHaveBeenCalled();
        });
    });
});
