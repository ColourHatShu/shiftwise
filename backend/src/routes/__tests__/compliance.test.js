const request = require('supertest');
const express = require('express');
const complianceRouter = require('../compliance');
const prisma = require('../../lib/prisma');

// Mock Sentry
jest.mock('@sentry/node', () => ({
    captureException: jest.fn()
}));

// Mock prisma
jest.mock('../../lib/prisma');

// Mock auth middleware
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        req.user = { id: 'test-user-1' };
        req.ip = '127.0.0.1';
        next();
    },
    requireRole: (roles) => (req, res, next) => {
        req.user = { id: 'test-user-1', role: 'ADMIN' };
        next();
    }
}));

// Mock compliance service
jest.mock('../../lib/compliance-service', () => ({
    calculateScore: jest.fn(),
    getWorkersWithScores: jest.fn(),
    generateCSV: jest.fn(),
    generatePDF: jest.fn(),
    aggregateAlerts: jest.fn()
}));

describe('Compliance Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/agency/compliance', complianceRouter);
        jest.clearAllMocks();
    });

    describe('GET /api/agency/compliance/workers', () => {
        it('should return workers with compliance scores', async () => {
            const complianceService = require('../../lib/compliance-service');
            complianceService.getWorkersWithScores.mockResolvedValue({
                workers: [
                    {
                        id: 'w1',
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com',
                        complianceScore: 80,
                        complianceStatus: 'green'
                    }
                ],
                total: 1,
                page: 1,
                limit: 20
            });

            const res = await request(app)
                .get('/api/agency/compliance/workers')
                .expect(200);

            expect(res.body.workers).toHaveLength(1);
            expect(res.body.workers[0].complianceScore).toBe(80);
            expect(res.body.cached).toBe(false);
        });

        it('should cache results with 60s TTL', async () => {
            const complianceService = require('../../lib/compliance-service');
            complianceService.getWorkersWithScores.mockResolvedValue({
                workers: [],
                total: 0,
                page: 1,
                limit: 20
            });

            // First request
            await request(app)
                .get('/api/agency/compliance/workers')
                .expect(200);

            // Second request should use cache
            const res = await request(app)
                .get('/api/agency/compliance/workers')
                .expect(200);

            expect(res.body.cached).toBe(true);
        });

        it('should validate pagination parameters', async () => {
            const res = await request(app)
                .get('/api/agency/compliance/workers?page=0')
                .expect(400);

            expect(res.body.error).toBeDefined();
        });
    });

    describe('POST /api/agency/compliance/export', () => {
        it('should export as CSV', async () => {
            const complianceService = require('../../lib/compliance-service');
            complianceService.generateCSV.mockResolvedValue('name,email\nJohn,john@example.com');

            const res = await request(app)
                .post('/api/agency/compliance/export')
                .send({ format: 'csv' })
                .expect(200);

            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.headers['content-disposition']).toMatch(/compliance-report.*\.csv/);
        });

        it('should export as PDF', async () => {
            const complianceService = require('../../lib/compliance-service');
            complianceService.generatePDF.mockResolvedValue(Buffer.from('PDF content'));

            const res = await request(app)
                .post('/api/agency/compliance/export')
                .send({ format: 'pdf' })
                .expect(200);

            expect(res.headers['content-type']).toMatch(/application\/pdf/);
            expect(res.headers['content-disposition']).toMatch(/compliance-report.*\.pdf/);
        });

        it('should reject invalid format', async () => {
            const res = await request(app)
                .post('/api/agency/compliance/export')
                .send({ format: 'xml' })
                .expect(400);

            expect(res.body.error).toBeDefined();
        });

        it('should log export action to audit log', async () => {
            const complianceService = require('../../lib/compliance-service');
            complianceService.generateCSV.mockResolvedValue('csv data');

            prisma.auditLog.create.mockResolvedValue({});

            await request(app)
                .post('/api/agency/compliance/export')
                .send({ format: 'csv' })
                .expect(200);

            expect(prisma.auditLog.create).toHaveBeenCalled();
        });
    });

    describe('GET /api/agency/compliance/alerts', () => {
        it('should return aggregated alerts', async () => {
            const complianceService = require('../../lib/compliance-service');
            complianceService.aggregateAlerts.mockResolvedValue({
                expiringCount: 2,
                expiredCount: 1,
                nonCompliantCount: 3,
                totalAlerts: 6,
                alerts: []
            });

            const res = await request(app)
                .get('/api/agency/compliance/alerts')
                .expect(200);

            expect(res.body.data.expiringCount).toBe(2);
            expect(res.body.data.expiredCount).toBe(1);
            expect(res.body.data.nonCompliantCount).toBe(3);
        });
    });

    describe('GET /api/agency/compliance/score/:workerId', () => {
        it('should calculate and return score for a worker', async () => {
            const complianceService = require('../../lib/compliance-service');
            complianceService.calculateScore.mockResolvedValue({
                score: 80,
                completedDocs: 4,
                totalRequiredDocs: 5,
                status: 'green'
            });

            prisma.worker.findFirst.mockResolvedValue({ id: 'w1' });

            const res = await request(app)
                .get('/api/agency/compliance/score/w1')
                .expect(200);

            expect(res.body.data.score).toBe(80);
            expect(res.body.data.status).toBe('green');
        });

        it('should return 404 if worker not found', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/agency/compliance/score/nonexistent')
                .expect(404);

            expect(res.body.error).toBeDefined();
        });
    });

    describe('POST /api/agency/compliance/document/:documentId/approve', () => {
        it('should approve a document and log action', async () => {
            prisma.complianceDocument.findFirst.mockResolvedValue({
                id: 'd1',
                workerId: 'w1',
                documentTypeId: 'dt1',
                status: 'PENDING'
            });

            prisma.complianceDocument.update.mockResolvedValue({
                id: 'd1',
                status: 'APPROVED',
                reviewedAt: new Date()
            });

            prisma.auditLog.create.mockResolvedValue({});

            const res = await request(app)
                .post('/api/agency/compliance/document/d1/approve')
                .expect(200);

            expect(res.body.message).toBe('Document approved');
            expect(prisma.complianceDocument.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'APPROVED' })
                })
            );
        });

        it('should return 404 if document not found', async () => {
            prisma.complianceDocument.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/agency/compliance/document/nonexistent/approve')
                .expect(404);

            expect(res.body.error).toBeDefined();
        });
    });

    describe('POST /api/agency/compliance/document/:documentId/reject', () => {
        it('should reject a document with reason', async () => {
            prisma.complianceDocument.findFirst.mockResolvedValue({
                id: 'd1',
                workerId: 'w1',
                documentTypeId: 'dt1',
                status: 'PENDING'
            });

            prisma.complianceDocument.update.mockResolvedValue({
                id: 'd1',
                status: 'REJECTED',
                rejectionReason: 'Document quality too poor'
            });

            prisma.auditLog.create.mockResolvedValue({});

            const res = await request(app)
                .post('/api/agency/compliance/document/d1/reject')
                .send({ reason: 'Document quality too poor' })
                .expect(200);

            expect(res.body.message).toBe('Document rejected');
            expect(prisma.complianceDocument.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'REJECTED',
                        rejectionReason: 'Document quality too poor'
                    })
                })
            );
        });
    });

    describe('POST /api/agency/compliance/worker/:workerId/deactivate', () => {
        it('should deactivate a worker and log action', async () => {
            prisma.worker.findFirst.mockResolvedValue({
                id: 'w1',
                firstName: 'John',
                lastName: 'Doe'
            });

            prisma.worker.update.mockResolvedValue({
                id: 'w1',
                status: 'INACTIVE'
            });

            prisma.auditLog.create.mockResolvedValue({});

            const res = await request(app)
                .post('/api/agency/compliance/worker/w1/deactivate')
                .expect(200);

            expect(res.body.message).toBe('Worker deactivated');
            expect(prisma.worker.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'INACTIVE' })
                })
            );
        });
    });
});
