/**
 * Shift Assignment Endpoints with Compliance Check Integration Tests
 *
 * Tests POST /api/shifts/:id/assign
 */

const request = require('supertest');
const express = require('express');
const shiftAssignmentsRouter = require('../../routes/shift-assignments');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'test-agency-1';
        next();
    }
}));

const prisma = require('../../lib/prisma');

describe('Shift Assignment Endpoints', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/shifts/:shiftId/assign', shiftAssignmentsRouter);

        // Setup prisma mocks
        jest.clearAllMocks();
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
    });

    describe('POST /api/shifts/:shiftId/assign - Assign worker to shift with compliance check', () => {
        it('should assign worker to shift with passing compliance check', async () => {
            const shiftId = 'shift-1';
            const workerId = 'worker-1';

            prisma.complianceDocument.findMany.mockResolvedValue([
                {
                    id: 'doc-1',
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2027-12-31')
                },
                {
                    id: 'doc-2',
                    documentTypeId: 'rtw-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2028-06-30')
                }
            ]);

            prisma.documentType.findMany.mockResolvedValue([
                {
                    id: 'dbs-type',
                    name: 'DBS Check',
                    isRequired: true
                },
                {
                    id: 'rtw-type',
                    name: 'Right to Work',
                    isRequired: true
                }
            ]);

            prisma.shiftAssignment.create.mockResolvedValue({
                id: 'assign-1',
                shiftId,
                workerId,
                agencyId: 'test-agency-1',
                complianceCheckPassed: true,
                complianceCheckDetails: {
                    missingDocs: [],
                    expiredDocs: [],
                    allDocumentsApproved: true
                },
                assignedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign`)
                .send({ workerId });

            expect(res.status).toBe(201);
            expect(res.body.data.complianceCheckPassed).toBe(true);
            expect(res.body.data.complianceCheckDetails.missingDocs).toHaveLength(0);
        });

        it('should assign worker but flag compliance failure if missing required docs', async () => {
            const shiftId = 'shift-1';
            const workerId = 'worker-2';

            prisma.complianceDocument.findMany.mockResolvedValue([
                {
                    id: 'doc-1',
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2027-12-31')
                }
                // Missing Right to Work doc
            ]);

            prisma.documentType.findMany.mockResolvedValue([
                {
                    id: 'dbs-type',
                    name: 'DBS Check',
                    isRequired: true
                },
                {
                    id: 'rtw-type',
                    name: 'Right to Work',
                    isRequired: true
                }
            ]);

            prisma.shiftAssignment.create.mockResolvedValue({
                id: 'assign-2',
                shiftId,
                workerId,
                agencyId: 'test-agency-1',
                complianceCheckPassed: false,
                complianceCheckDetails: {
                    missingDocs: ['Right to Work'],
                    expiredDocs: [],
                    allDocumentsApproved: false
                },
                assignedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign`)
                .send({ workerId });

            expect(res.status).toBe(201);
            expect(res.body.data.complianceCheckPassed).toBe(false);
            expect(res.body.data.complianceCheckDetails.missingDocs).toContain('Right to Work');
        });

        it('should flag compliance failure if document is expired', async () => {
            const shiftId = 'shift-1';
            const workerId = 'worker-3';

            prisma.complianceDocument.findMany.mockResolvedValue([
                {
                    id: 'doc-1',
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2025-01-01') // Expired
                },
                {
                    id: 'doc-2',
                    documentTypeId: 'rtw-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2028-06-30')
                }
            ]);

            prisma.documentType.findMany.mockResolvedValue([
                {
                    id: 'dbs-type',
                    name: 'DBS Check',
                    isRequired: true
                },
                {
                    id: 'rtw-type',
                    name: 'Right to Work',
                    isRequired: true
                }
            ]);

            prisma.shiftAssignment.create.mockResolvedValue({
                id: 'assign-3',
                shiftId,
                workerId,
                agencyId: 'test-agency-1',
                complianceCheckPassed: false,
                complianceCheckDetails: {
                    missingDocs: [],
                    expiredDocs: ['DBS Check'],
                    allDocumentsApproved: false
                },
                assignedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign`)
                .send({ workerId });

            expect(res.status).toBe(201);
            expect(res.body.data.complianceCheckPassed).toBe(false);
            expect(res.body.data.complianceCheckDetails.expiredDocs).toContain('DBS Check');
        });

        it('should reject assignment if worker already assigned to shift', async () => {
            const shiftId = 'shift-1';
            const workerId = 'worker-1';

            prisma.shiftAssignment.findFirst.mockResolvedValue({
                id: 'assign-1',
                shiftId,
                workerId
            });

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign`)
                .send({ workerId });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('already assigned');
        });

        it('should reject if missing workerId in body', async () => {
            const shiftId = 'shift-1';

            const res = await request(app)
                .post(`/api/shifts/${shiftId}/assign`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('workerId');
        });
    });

    describe('GET /api/shifts/:shiftId/assignments - List assignments for shift', () => {
        it('should list all assignments for a shift', async () => {
            const shiftId = 'shift-1';

            prisma.shiftAssignment.findMany.mockResolvedValue([
                {
                    id: 'assign-1',
                    shiftId,
                    workerId: 'worker-1',
                    agencyId: 'test-agency-1',
                    complianceCheckPassed: true,
                    worker: {
                        id: 'worker-1',
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john@example.com'
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);

            const res = await request(app)
                .get(`/api/shifts/${shiftId}/assignments`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });
});
