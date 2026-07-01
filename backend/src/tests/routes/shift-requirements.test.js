/**
 * Shift-requirement templates (agency-scoped, OWNER/ADMIN). Locks the
 * cross-agency 404 on update/delete (IDOR-safe), duplicate handling, validation,
 * and the CRUD happy paths.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
}));

const prisma = require('../../lib/prisma');
const router = require('../../routes/shift-requirements');

describe('shift-requirements routes', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.shiftRequirement = {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        prisma.auditLog = { create: jest.fn().mockResolvedValue({}) };
        app.use('/api/shift-requirements', router);
    });

    describe('POST /', () => {
        it('400s on missing/invalid fields', async () => {
            const res = await request(app).post('/api/shift-requirements').send({ templateName: 'Nurses' }); // no requiredDocuments array
            expect(res.status).toBe(400);
        });

        it('400s on a duplicate template name', async () => {
            prisma.shiftRequirement.findUnique.mockResolvedValue({ id: 'existing' });
            const res = await request(app).post('/api/shift-requirements').send({ templateName: 'Nurses', requiredDocuments: ['dbs'] });
            expect(res.status).toBe(400);
            expect(prisma.shiftRequirement.create).not.toHaveBeenCalled();
        });

        it('creates a template (201, agency-scoped)', async () => {
            prisma.shiftRequirement.findUnique.mockResolvedValue(null);
            prisma.shiftRequirement.create.mockResolvedValue({ id: 't1', templateName: 'Nurses' });
            const res = await request(app).post('/api/shift-requirements').send({ templateName: 'Nurses', requiredDocuments: ['dbs'] });
            expect(res.status).toBe(201);
            expect(prisma.shiftRequirement.create.mock.calls[0][0].data).toMatchObject({ agencyId: 'agency-1', templateName: 'Nurses' });
        });
    });

    describe('PUT /:id', () => {
        it('404s when the template belongs to another agency (IDOR-safe)', async () => {
            prisma.shiftRequirement.findUnique.mockResolvedValue({ id: 't1', agencyId: 'other-agency' });
            const res = await request(app).put('/api/shift-requirements/t1').send({ templateName: 'X' });
            expect(res.status).toBe(404);
            expect(prisma.shiftRequirement.update).not.toHaveBeenCalled();
        });

        it('updates an in-agency template', async () => {
            prisma.shiftRequirement.findUnique.mockResolvedValue({ id: 't1', agencyId: 'agency-1', templateName: 'Old', role: null, description: null });
            prisma.shiftRequirement.update.mockResolvedValue({ id: 't1', templateName: 'New' });
            const res = await request(app).put('/api/shift-requirements/t1').send({ templateName: 'New' });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /:id', () => {
        it('404s when the template belongs to another agency (IDOR-safe)', async () => {
            prisma.shiftRequirement.findUnique.mockResolvedValue({ id: 't1', agencyId: 'other-agency' });
            const res = await request(app).delete('/api/shift-requirements/t1');
            expect(res.status).toBe(404);
            expect(prisma.shiftRequirement.delete).not.toHaveBeenCalled();
        });

        it('deletes an in-agency template (204)', async () => {
            prisma.shiftRequirement.findUnique.mockResolvedValue({ id: 't1', agencyId: 'agency-1', templateName: 'Nurses' });
            prisma.shiftRequirement.delete.mockResolvedValue({});
            const res = await request(app).delete('/api/shift-requirements/t1');
            expect(res.status).toBe(204);
        });
    });
});
