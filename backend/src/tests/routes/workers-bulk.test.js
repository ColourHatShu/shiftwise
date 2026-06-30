/**
 * Bulk worker CSV import endpoints.
 */

const request = require('supertest');
const express = require('express');
const workersBulkRouter = require('../../routes/workers-bulk');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');

describe('Workers Bulk Import', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.worker = { create: jest.fn() };
        app.use('/api/workers/bulk', workersBulkRouter);
    });

    describe('POST /api/workers/bulk/upload', () => {
        it('creates valid rows', async () => {
            prisma.worker.create.mockImplementation(({ data }) =>
                Promise.resolve({ id: 'w_' + data.email, ...data })
            );
            const csvData =
                'firstName,lastName,email,jobTitle\n' +
                'Jane,Doe,jane@example.com,Nurse\n' +
                'John,Smith,john@example.com,Carer';
            const res = await request(app).post('/api/workers/bulk/upload').send({ csvData });
            expect(res.status).toBe(201);
            expect(res.body.results.total).toBe(2);
            expect(res.body.results.succeeded).toBe(2);
            expect(res.body.results.failed).toBe(0);
            expect(prisma.worker.create).toHaveBeenCalledTimes(2);
        });

        it('reports per-row validation errors without creating them', async () => {
            prisma.worker.create.mockImplementation(({ data }) => Promise.resolve({ id: 'w1', ...data }));
            const csvData =
                'firstName,lastName,email\n' +
                'Jane,Doe,jane@example.com\n' +
                'NoEmail,Person,\n' +
                'Bad,Email,not-an-email';
            const res = await request(app).post('/api/workers/bulk/upload').send({ csvData });
            expect(res.status).toBe(201);
            expect(res.body.results.succeeded).toBe(1);
            expect(res.body.results.failed).toBe(2);
            expect(res.body.results.errors).toHaveLength(2);
            expect(prisma.worker.create).toHaveBeenCalledTimes(1);
        });

        it('reports a duplicate-email DB error per row', async () => {
            prisma.worker.create.mockRejectedValue({ code: 'P2002' });
            const csvData = 'firstName,lastName,email\nJane,Doe,dup@example.com';
            const res = await request(app).post('/api/workers/bulk/upload').send({ csvData });
            expect(res.status).toBe(201);
            expect(res.body.results.succeeded).toBe(0);
            expect(res.body.results.failed).toBe(1);
            expect(res.body.results.errors[0].error).toMatch(/already exists/);
        });

        it('rejects empty CSV', async () => {
            const res = await request(app).post('/api/workers/bulk/upload').send({ csvData: '' });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/workers/bulk/template', () => {
        it('returns a CSV template', async () => {
            const res = await request(app).get('/api/workers/bulk/template');
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/csv/);
            expect(res.text).toMatch(/firstName,lastName,email/);
        });
    });
});
