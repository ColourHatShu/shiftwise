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
        // Respect a user/agency set by an earlier middleware (so tests can exercise
        // other roles, e.g. VIEWER); otherwise default to an OWNER for convenience.
        req.agencyId = req.agencyId || 'test-agency-1';
        req.user = req.user || { id: 'user-1', role: 'OWNER' };
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
            delete: jest.fn(),
            groupBy: jest.fn().mockResolvedValue([])
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

            // Re-mount the app, setting a VIEWER user BEFORE the router so the
            // (now pre-set-respecting) requireAgency mock keeps the VIEWER role.
            app = express();
            app.use(express.json());
            app.use((req, res, next) => {
                req.agencyId = 'test-agency-1';
                req.user = { id: 'user-1', role: 'VIEWER' };
                next();
            });
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
            // Reliability enrichment: field present, null when no assignment history.
            expect(res.body.workers[0]).toHaveProperty('confirmationRate', null);
            expect(res.body.workers[0].suggested).toBe(false); // no history → not suggested
        });

        it('enriches compliant workers with their confirmation rate', async () => {
            const shiftId = 'shift-1';
            prisma.shift.findFirst.mockResolvedValue({ id: shiftId, agencyId: 'test-agency-1' });
            prisma.shiftAssignment.findMany.mockResolvedValue([]);
            prisma.worker.findMany.mockResolvedValue([
                { id: 'w1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', updatedAt: new Date() },
            ]);
            prisma.worker.count.mockResolvedValue(1);
            validateComplianceAtTime.mockResolvedValue({ isCompliant: true, snapshot: { complianceScore: 100, status: 'compliant' } });
            prisma.shiftAssignment.groupBy.mockResolvedValue([
                { workerId: 'w1', workerConfirmation: 'confirmed', _count: { _all: 9 } },
                { workerId: 'w1', workerConfirmation: 'declined', _count: { _all: 1 } },
            ]);

            const res = await request(app).get(`/api/shifts/${shiftId}/assignable-workers`).query({ page: 1, limit: 25 });

            expect(res.status).toBe(200);
            expect(res.body.workers[0].confirmationRate).toBe(90);
            expect(res.body.workers[0].suggested).toBe(true); // compliant + ≥80% → suggested
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

    describe('GET /api/shifts/:shiftId/suggested-workers (rule-based matcher)', () => {
        it('ranks compliant candidates by reliability and excludes non-compliant', async () => {
            const shiftId = 'shift-1';
            prisma.shift.findFirst.mockResolvedValue({ id: shiftId, agencyId: 'test-agency-1' });
            prisma.shiftAssignment.findMany.mockResolvedValue([]); // none assigned
            prisma.worker.findMany.mockResolvedValue([
                { id: 'w1', firstName: 'Low', lastName: 'Rate', email: 'l@x.com' },
                { id: 'w2', firstName: 'High', lastName: 'Rate', email: 'h@x.com' },
                { id: 'w3', firstName: 'Not', lastName: 'Compliant', email: 'n@x.com' },
            ]);
            validateComplianceForWorkers.mockResolvedValue(new Map([
                ['w1', { notFound: false, isCompliant: true, snapshot: { complianceScore: 100 } }],
                ['w2', { notFound: false, isCompliant: true, snapshot: { complianceScore: 100 } }],
                ['w3', { notFound: false, isCompliant: false, snapshot: { complianceScore: 50 } }],
            ]));
            prisma.shiftAssignment.groupBy.mockResolvedValue([
                { workerId: 'w1', workerConfirmation: 'confirmed', _count: { _all: 1 } },
                { workerId: 'w1', workerConfirmation: 'declined', _count: { _all: 3 } }, // 25%
                { workerId: 'w2', workerConfirmation: 'confirmed', _count: { _all: 4 } }, // 100%
            ]);

            const res = await request(app).get(`/api/shifts/${shiftId}/suggested-workers`).query({ limit: 5 });

            expect(res.status).toBe(200);
            expect(res.body.data.map((s) => s.id)).toEqual(['w2', 'w1']); // reliable first, non-compliant excluded
            expect(res.body.data[0]).toMatchObject({ rank: 1, confirmationRate: 100 });
            expect(res.body.meta.compliantCandidates).toBe(2);
            // excludes deactivated workers: deactivate sets status=INACTIVE (not isActive)
            expect(prisma.worker.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE', isActive: true }) })
            );
        });

        it('404s for a shift not in the agency', async () => {
            prisma.shift.findFirst.mockResolvedValue(null);
            const res = await request(app).get('/api/shifts/nope/suggested-workers');
            expect(res.status).toBe(404);
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
                agencyId: 'test-agency-1',
                status: 'ACTIVE'
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

        it('refuses to assign a deactivated worker (status=INACTIVE)', async () => {
            const shiftId = 'shift-1';
            const workerId = 'worker-x';
            prisma.shift.findFirst.mockResolvedValue({ id: shiftId, agencyId: 'test-agency-1' });
            prisma.worker.findFirst.mockResolvedValue({
                id: workerId, firstName: 'De', lastName: 'Activated', agencyId: 'test-agency-1', status: 'INACTIVE'
            });

            const res = await request(app).post(`/api/shifts/${shiftId}/assign`).send({ workerId });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/deactivated/i);
            expect(prisma.shiftAssignment.create).not.toHaveBeenCalled();
        });

        it('returns 500 (not an unhandled crash) when the compliance check errors', async () => {
            const shiftId = 'shift-1';
            const workerId = 'worker-1';
            prisma.shift.findFirst.mockResolvedValue({ id: shiftId, agencyId: 'test-agency-1' });
            prisma.worker.findFirst.mockResolvedValue({ id: workerId, agencyId: 'test-agency-1', status: 'ACTIVE' });
            prisma.shiftAssignment.findFirst.mockResolvedValue(null);
            // checkWorkerCompliance() is a module-level helper (no `req`); its catch must
            // use the base logger, not `req.log`, or it would throw ReferenceError here.
            prisma.documentType.findMany.mockRejectedValue(new Error('db down'));

            const res = await request(app).post(`/api/shifts/${shiftId}/assign`).send({ workerId });

            expect(res.status).toBe(500);
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
