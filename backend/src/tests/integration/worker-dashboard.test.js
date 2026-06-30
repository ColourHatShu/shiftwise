/**
 * Worker dashboard — real behavioural tests for GET /worker/documents and
 * GET /worker/document-types (mounted behind the real workerAuthMiddleware so
 * the req.worker shape is exercised exactly as in production).
 *
 * JWT_SECRET must be set before requiring the route (read at module load).
 */

process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

jest.mock('../../lib/prisma');
jest.mock('../../lib/nodemailer');
jest.mock('../../lib/r2');
jest.mock('../../lib/encryption');

const prisma = require('../../lib/prisma');
const { workerAuthMiddleware } = require('../../routes/worker-auth');
const { getWorkerDocuments, getDocumentTypes } = require('../../routes/worker-documents');

const DAY = 24 * 60 * 60 * 1000;
const token = jwt.sign({ workerId: 'worker-123', agencyId: 'agency-456' }, 'test-secret', { expiresIn: '7d' });
const COOKIE = `worker_token=${token}`;

describe('Worker Dashboard — documents', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        prisma.complianceDocument = { findMany: jest.fn() };
        prisma.documentType = { findMany: jest.fn() };
        app.get('/worker/documents', workerAuthMiddleware, getWorkerDocuments);
        app.get('/worker/document-types', workerAuthMiddleware, getDocumentTypes);
    });

    it('401s without auth', async () => {
        const res = await request(app).get('/worker/documents');
        expect(res.status).toBe(401);
    });

    it('queries only the signed-in worker + agency documents (multi-tenant isolation)', async () => {
        prisma.complianceDocument.findMany.mockResolvedValue([]);
        const res = await request(app).get('/worker/documents').set('Cookie', COOKIE);
        expect(res.status).toBe(200);
        expect(prisma.complianceDocument.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { workerId: 'worker-123', agencyId: 'agency-456' } })
        );
    });

    it('enriches each document with daysUntilExpiry + expiryColor', async () => {
        prisma.complianceDocument.findMany.mockResolvedValue([
            { id: 'd1', fileName: 'a.pdf', documentType: { name: 'DBS' }, status: 'APPROVED', expiryDate: new Date(Date.now() + 45 * DAY), uploadedAt: new Date() },
            { id: 'd2', fileName: 'b.pdf', documentType: { name: 'RTW' }, status: 'PENDING', expiryDate: new Date(Date.now() + 15 * DAY), uploadedAt: new Date() },
            { id: 'd3', fileName: 'c.pdf', documentType: { name: 'Cert' }, status: 'EXPIRED', expiryDate: new Date(Date.now() - 10 * DAY), uploadedAt: new Date() },
            { id: 'd4', fileName: 'd.pdf', documentType: { name: 'NoExpiry' }, status: 'APPROVED', expiryDate: null, uploadedAt: new Date() },
        ]);

        const res = await request(app).get('/worker/documents').set('Cookie', COOKIE);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(4);
        const byId = Object.fromEntries(res.body.documents.map((d) => [d.id, d]));
        expect(byId.d1.expiryColor).toBe('green');
        expect(byId.d2.expiryColor).toBe('yellow');
        expect(byId.d3.expiryColor).toBe('red');
        expect(byId.d4.expiryColor).toBe('gray');
        expect(byId.d4.daysUntilExpiry).toBeNull();
        expect(byId.d1.docType).toBe('DBS');
    });

    it('returns an empty list when the worker has no documents', async () => {
        prisma.complianceDocument.findMany.mockResolvedValue([]);
        const res = await request(app).get('/worker/documents').set('Cookie', COOKIE);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ documents: [], count: 0 });
    });

    it('500s gracefully on a DB error', async () => {
        prisma.complianceDocument.findMany.mockRejectedValue(new Error('db down'));
        const res = await request(app).get('/worker/documents').set('Cookie', COOKIE);
        expect(res.status).toBe(500);
    });

    describe('GET /worker/document-types', () => {
        it('returns the agency document types', async () => {
            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', name: 'DBS', isRequired: true, hasExpiry: true, expiryWarningDays: 30 },
            ]);
            const res = await request(app).get('/worker/document-types').set('Cookie', COOKIE);
            expect(res.status).toBe(200);
            expect(res.body.documentTypes).toHaveLength(1);
            expect(prisma.documentType.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { agencyId: 'agency-456' } })
            );
        });

        it('includes a helpful message when none are configured', async () => {
            prisma.documentType.findMany.mockResolvedValue([]);
            const res = await request(app).get('/worker/document-types').set('Cookie', COOKIE);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/No document types/i);
        });
    });
});
