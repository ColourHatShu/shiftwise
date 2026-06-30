/**
 * Document Types CRUD endpoints (agency compliance config).
 */

const request = require('supertest');
const express = require('express');
const documentTypesRouter = require('../../routes/document-types');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');

describe('Document Types Endpoints', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.documentType = {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        prisma.complianceDocument = { count: jest.fn() };
        app.use('/api/document-types', documentTypesRouter);
    });

    describe('GET /api/document-types', () => {
        it('lists the agency document types', async () => {
            prisma.documentType.findMany.mockResolvedValue([{ id: 'dt1', name: 'DBS Check' }]);
            const res = await request(app).get('/api/document-types');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(prisma.documentType.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { agencyId: 'test-agency-1' } })
            );
        });
    });

    describe('POST /api/document-types', () => {
        it('creates a document type with sensible defaults', async () => {
            prisma.documentType.create.mockResolvedValue({ id: 'dt1', name: 'DBS Check' });
            const res = await request(app).post('/api/document-types').send({ name: 'DBS Check' });
            expect(res.status).toBe(201);
            expect(prisma.documentType.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ name: 'DBS Check', isRequired: true, hasExpiry: true, expiryWarningDays: 30 }),
                })
            );
        });

        it('rejects a missing name', async () => {
            const res = await request(app).post('/api/document-types').send({ description: 'x' });
            expect(res.status).toBe(400);
            expect(prisma.documentType.create).not.toHaveBeenCalled();
        });

        it('returns 409 on duplicate name', async () => {
            prisma.documentType.create.mockRejectedValue({ code: 'P2002' });
            const res = await request(app).post('/api/document-types').send({ name: 'DBS Check' });
            expect(res.status).toBe(409);
        });
    });

    describe('PATCH /api/document-types/:id', () => {
        it('updates an owned document type', async () => {
            prisma.documentType.findFirst.mockResolvedValue({ id: 'dt1', agencyId: 'test-agency-1' });
            prisma.documentType.update.mockResolvedValue({ id: 'dt1', isRequired: false });
            const res = await request(app).patch('/api/document-types/dt1').send({ isRequired: false });
            expect(res.status).toBe(200);
            expect(prisma.documentType.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'dt1' }, data: { isRequired: false } })
            );
        });

        it('404s for a type not in the agency', async () => {
            prisma.documentType.findFirst.mockResolvedValue(null);
            const res = await request(app).patch('/api/document-types/nope').send({ isRequired: false });
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/document-types/:id', () => {
        it('deletes an unused type', async () => {
            prisma.documentType.findFirst.mockResolvedValue({ id: 'dt1', agencyId: 'test-agency-1' });
            prisma.complianceDocument.count.mockResolvedValue(0);
            prisma.documentType.delete.mockResolvedValue({ id: 'dt1' });
            const res = await request(app).delete('/api/document-types/dt1');
            expect(res.status).toBe(200);
            expect(prisma.documentType.delete).toHaveBeenCalled();
        });

        it('blocks deletion (409) when documents use the type', async () => {
            prisma.documentType.findFirst.mockResolvedValue({ id: 'dt1', agencyId: 'test-agency-1' });
            prisma.complianceDocument.count.mockResolvedValue(3);
            const res = await request(app).delete('/api/document-types/dt1');
            expect(res.status).toBe(409);
            expect(prisma.documentType.delete).not.toHaveBeenCalled();
        });
    });
});
