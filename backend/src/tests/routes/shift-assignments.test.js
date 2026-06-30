/**
 * Shift Assignment Endpoints with Compliance Check Integration Tests
 *
 * Tests Phase 8 endpoints:
 * - POST /api/shifts/:shiftId/assign (single assign)
 * - POST /api/shifts/:shiftId/assign-bulk (Phase 8)
 * - GET /api/shifts/:shiftId/assignable-workers (Phase 8)
 * - GET /api/shifts/:shiftId/assignments
 */

const request = require('supertest');
const express = require('express');
const shiftAssignmentsRouter = require('../../routes/shift-assignments');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
    requireRole: (allowedRoles) => (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        }
        next();
    }
}));

jest.mock('../../lib/compliance-assignment', () => ({
    validateComplianceAtTime: jest.fn(),
    validateComplianceForWorkers: jest.fn()
}));

const prisma = require('../../lib/prisma');
const { validateComplianceAtTime, validateComplianceForWorkers } = require('../../lib/compliance-assignment');

// Helper: build the Map returned by validateComplianceForWorkers for a set of workers
function complianceMapFor(workerIds, isCompliantFn) {
    const map = new Map();
    workerIds.forEach((id, i) => {
        const compliant = isCompliantFn(id, i);
        map.set(id, {
            notFound: false,
            isCompliant: compliant,
            reason: compliant ? null : 'Missing required document',
            snapshot: {
                documents: [],
                complianceScore: compliant ? 100 : 50,
                status: compliant ? 'compliant' : 'non-compliant',
                capturedAt: new Date().toISOString(),
                notes: null
            }
        });
    });
    return map;
}

describe('Shift Assignment Endpoints', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();

        app = express();
        app.use(express.json());

        // Setup prisma mocks BEFORE mounting router
        prisma.shift = {
            findFirst: jest.fn()
        };
        prisma.worker = {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn()
        };
        prisma.shiftAssignment = {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            delete: jest.fn()
        };
        prisma.complianceDocument = {
            findMany: jest.fn()
        };
        prisma.documentType = {
            findMany: jest.fn()
        };
        prisma.auditLog = {
            create: jest.fn()
        };

        // Mock compliance assignment library
        validateComplianceAtTime.mockResolvedValue({
            isCompliant: true,
            reason: null,
            snapshot: {
                documents: [],
                complianceScore: 100,
                status: 'compliant',
                capturedAt: new Date().toISOString(),
                notes: null
            }
        });

        // Mount router at the correct path (matching server.js mounting)
        app.use('/api/shifts/:shiftId', shiftAssignmentsRouter);
    });

    describe('POST /api/shifts/:shiftId/assign-bulk - Bulk assign workers (Phase 8)', () => {
        it('should bulk assign 5 compliant workers successfully', async () => {
            const shiftId = 'shift-1';
            const workerIds = ['w1', 'w2', 'w3', 'w4', 'w5'];

            // Mock shift exists
            prisma.shift.findFirst.mockResolvedValue({
                id: shiftId,
                facilityName: 'Hospital',
                agencyId: 'test-agency-1',
                requiredCount: 5
            });

            // Mock no existing assignments
            prisma.shiftAssignment.findMany.mockResolvedValueOnce([]);

            // Mock batched compliance validation — all 5 workers exist and are compliant
            validateComplianceForWorkers.mockResolvedValue(
                complianceMapFor(workerIds, () => true)
            );

            // Mock assignment creation
            workerIds.forEach(workerId => {
                prisma.shiftAssignment.create.mockResolvedValueOnce({
                    id: `assign-${workerId}`,
                    shiftId,
                    workerId,
                    agencyId: 'test-agency-1',
                    complianceSnapshot: { status: 'compliant', complianceScore: 100 },
                    workerConfirmation: 'pending',
                    assignedAt: new Date()
                });
            });

            // Mock audit log creation
            prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign-bulk`)
                .send({ workerIds, assignmentType: 'manual' });

            expect(res.status).toBe(200);
            expect(res.body.assigned).toHaveLength(5);
            expect(res.body.skipped).toHaveLength(0);
            expect(res.body.summary.assigned).toBe(5);
            expect(res.body.summary.total).toBe(5);
        });

        it('should handle mixed compliance (5 compliant, 5 non-compliant)', async () => {
            const shiftId = 'shift-1';
            const allWorkerIds = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10'];

            prisma.shift.findFirst.mockResolvedValue({
                id: shiftId,
                facilityName: 'Hospital',
                agencyId: 'test-agency-1',
                requiredCount: 10
            });

            prisma.shiftAssignment.findMany.mockResolvedValueOnce([]);

            // Mock batched compliance validation: first 5 compliant, next 5 non-compliant
            validateComplianceForWorkers.mockResolvedValue(
                complianceMapFor(allWorkerIds, (_id, i) => i < 5)
            );

            // Mock assignment creation for compliant workers
            for (let i = 0; i < 5; i++) {
                prisma.shiftAssignment.create.mockResolvedValueOnce({
                    id: `assign-w${i + 1}`,
                    shiftId,
                    workerId: `w${i + 1}`,
                    agencyId: 'test-agency-1',
                    complianceSnapshot: { status: 'compliant', complianceScore: 100 }
                });
            }

            prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign-bulk`)
                .send({ workerIds: allWorkerIds });

            expect(res.status).toBe(200);
            expect(res.body.assigned).toHaveLength(5);
            expect(res.body.skipped).toHaveLength(5);
            expect(res.body.summary.assigned).toBe(5);
            expect(res.body.summary.skipped).toBe(5);
            expect(res.body.skipped[0]).toHaveProperty('reason');
        });

        it('should reject if more than 100 workers requested', async () => {
            const shiftId = 'shift-1';
            const tooManyWorkers = Array.from({ length: 101 }, (_, i) => `w${i}`);

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign-bulk`)
                .send({ workerIds: tooManyWorkers });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Maximum 100 workers');
        });

        it('should reject non-OWNER/ADMIN users', async () => {
            const shiftId = 'shift-1';

            // Re-mount app with VIEWER role
            app = express();
            app.use(express.json());

            // Override auth middleware with VIEWER role
            const modifiedRouter = shiftAssignmentsRouter.replace = jest.fn();

            // Actually, let's create a new app with different auth
            const authMiddleware = (req, res, next) => {
                req.agencyId = 'test-agency-1';
                req.user = { id: 'user-1', role: 'VIEWER' };
                next();
            };

            app.use(authMiddleware);
            app.use('/api/shifts/:shiftId', shiftAssignmentsRouter);

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign-bulk`)
                .send({ workerIds: ['w1'] });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/shifts/:shiftId/assignable-workers - Get compliant workers (Phase 8)', () => {
        it('should return compliant workers for shift', async () => {
            const shiftId = 'shift-1';

            prisma.shift.findFirst.mockResolvedValue({
                id: shiftId,
                agencyId: 'test-agency-1'
            });

            prisma.shiftAssignment.findMany.mockResolvedValue([]);

            prisma.worker.findMany.mockResolvedValue([
                {
                    id: 'w1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    updatedAt: new Date()
                },
                {
                    id: 'w2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane@example.com',
                    updatedAt: new Date()
                }
            ]);

            prisma.worker.count.mockResolvedValue(2);

            validateComplianceAtTime.mockResolvedValueOnce({
                isCompliant: true,
                snapshot: { complianceScore: 100, status: 'compliant' }
            }).mockResolvedValueOnce({
                isCompliant: true,
                snapshot: { complianceScore: 100, status: 'compliant' }
            });

            const res = await request(app)
                .get(`/api/shifts/${shiftId}/assignable-workers`)
                .query({ page: 1, limit: 25 });

            expect(res.status).toBe(200);
            expect(res.body.workers).toHaveLength(2);
            expect(res.body.pagination.total).toBe(2);
            expect(res.body.workers[0].complianceScore).toBe(100);
        });

        it('should filter workers by search query', async () => {
            const shiftId = 'shift-1';

            prisma.shift.findFirst.mockResolvedValue({
                id: shiftId,
                agencyId: 'test-agency-1'
            });

            prisma.shiftAssignment.findMany.mockResolvedValue([]);

            prisma.worker.findMany.mockResolvedValue([
                {
                    id: 'w1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    updatedAt: new Date()
                }
            ]);

            prisma.worker.count.mockResolvedValue(1);

            validateComplianceAtTime.mockResolvedValue({
                isCompliant: true,
                snapshot: { complianceScore: 100, status: 'compliant' }
            });

            const res = await request(app)
                .get(`/api/shifts/${shiftId}/assignable-workers`)
                .query({ page: 1, limit: 25, search: 'john' });

            expect(res.status).toBe(200);
            expect(res.body.workers).toHaveLength(1);
        });
    });

    describe('POST /api/shifts/:shiftId/assign - Assign single worker (existing functionality)', () => {
        it('should assign worker to shift', async () => {
            const shiftId = 'shift-1';
            const workerId = 'worker-1';

            prisma.shift.findFirst.mockResolvedValue({
                id: shiftId,
                facilityName: 'Hospital',
                agencyId: 'test-agency-1'
            });

            prisma.worker.findFirst.mockResolvedValue({
                id: workerId,
                firstName: 'John',
                lastName: 'Doe',
                agencyId: 'test-agency-1'
            });

            prisma.shiftAssignment.findFirst.mockResolvedValue(null);

            prisma.complianceDocument.findMany.mockResolvedValue([
                {
                    id: 'doc-1',
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2027-12-31')
                }
            ]);

            prisma.documentType.findMany.mockResolvedValue([
                {
                    id: 'dbs-type',
                    name: 'DBS Check',
                    isRequired: true
                }
            ]);

            prisma.shiftAssignment.create.mockResolvedValue({
                id: 'assign-1',
                shiftId,
                workerId,
                agencyId: 'test-agency-1',
                complianceCheckPassed: true,
                worker: {
                    id: workerId,
                    firstName: 'John',
                    lastName: 'Doe'
                }
            });

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign`)
                .send({ workerId });

            expect(res.status).toBe(201);
            expect(res.body.data.complianceCheckPassed).toBe(true);
        });
    });

    describe('GET /api/shifts/:shiftId/assignments - List assignments', () => {
        it('should list all assignments for shift', async () => {
            const shiftId = 'shift-1';

            prisma.shift.findFirst.mockResolvedValue({
                id: shiftId,
                agencyId: 'test-agency-1'
            });

            prisma.shiftAssignment.findMany.mockResolvedValue([
                {
                    id: 'assign-1',
                    shiftId,
                    workerId: 'w1',
                    agencyId: 'test-agency-1',
                    worker: {
                        id: 'w1',
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com'
                    }
                }
            ]);

            const res = await request(app)
                .get(`/api/shifts/${shiftId}/assignments`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
});
