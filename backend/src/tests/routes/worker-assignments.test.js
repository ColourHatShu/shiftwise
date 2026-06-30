/**
 * Worker Assignment Confirmation/Decline Tests
 * Tests PATCH /api/worker-assignments/:assignmentId
 * Per Phase 8 SPEC R-SA-05
 */

const request = require('supertest');
const express = require('express');
const workerAssignmentsRouter = require('../../routes/worker-assignments');

jest.mock('../../lib/prisma');
jest.mock('../../routes/worker-auth', () => ({
    workerAuthMiddleware: (req, res, next) => {
        req.worker = { id: 'worker-1', agencyId: 'agency-1' };
        req.ip = '127.0.0.1';
        next();
    }
}));

const prisma = require('../../lib/prisma');

describe('Worker Assignment Confirmation/Decline Endpoints', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();

        app = express();
        app.use(express.json());

        // Setup prisma mocks
        prisma.shiftAssignment = {
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn()
        };
        prisma.auditLog = {
            create: jest.fn()
        };

        app.use('/api/worker-assignments', workerAssignmentsRouter);
    });

    describe('PATCH /api/worker-assignments/:assignmentId - Confirm shift', () => {
        it('should confirm assignment successfully', async () => {
            const assignmentId = 'assign-1';
            const workerId = 'worker-1';

            prisma.shiftAssignment.findUnique.mockResolvedValue({
                id: assignmentId,
                workerId,
                agencyId: 'agency-1',
                shiftId: 'shift-1',
                workerConfirmation: 'pending',
                workerNote: null,
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                },
                worker: {
                    id: workerId,
                    firstName: 'John',
                    lastName: 'Doe'
                }
            });

            prisma.shiftAssignment.update.mockResolvedValue({
                id: assignmentId,
                workerId,
                workerConfirmation: 'confirmed',
                workerNote: null,
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                }
            });

            prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

            const res = await request(app)
                .patch(`/api/worker-assignments/${assignmentId}`)
                .send({ action: 'confirm' });

            expect(res.status).toBe(200);
            expect(res.body.workerConfirmation).toBe('confirmed');
            expect(prisma.shiftAssignment.update).toHaveBeenCalledWith({
                where: { id: assignmentId },
                data: {
                    workerConfirmation: 'confirm',
                    workerNote: null
                },
                include: expect.any(Object)
            });
            expect(prisma.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'shift.assignment-confirmed'
                    })
                })
            );
        });

        it('should decline assignment with reason', async () => {
            const assignmentId = 'assign-2';
            const workerId = 'worker-1';
            const reason = 'Already committed elsewhere';

            prisma.shiftAssignment.findUnique.mockResolvedValue({
                id: assignmentId,
                workerId,
                agencyId: 'agency-1',
                shiftId: 'shift-1',
                workerConfirmation: 'pending',
                workerNote: null,
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                },
                worker: {
                    id: workerId,
                    firstName: 'John',
                    lastName: 'Doe'
                }
            });

            prisma.shiftAssignment.update.mockResolvedValue({
                id: assignmentId,
                workerId,
                workerConfirmation: 'declined',
                workerNote: reason,
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                }
            });

            prisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

            const res = await request(app)
                .patch(`/api/worker-assignments/${assignmentId}`)
                .send({ action: 'decline', reason });

            expect(res.status).toBe(200);
            expect(res.body.workerConfirmation).toBe('declined');
            expect(res.body.workerNote).toBe(reason);
            expect(prisma.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'shift.assignment-declined',
                        metadata: expect.objectContaining({
                            reason
                        })
                    })
                })
            );
        });

        it('should decline without providing reason', async () => {
            const assignmentId = 'assign-3';
            const workerId = 'worker-1';

            prisma.shiftAssignment.findUnique.mockResolvedValue({
                id: assignmentId,
                workerId,
                agencyId: 'agency-1',
                shiftId: 'shift-1',
                workerConfirmation: 'pending',
                workerNote: null,
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                }
            });

            prisma.shiftAssignment.update.mockResolvedValue({
                id: assignmentId,
                workerId,
                workerConfirmation: 'declined',
                workerNote: null,
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                }
            });

            prisma.auditLog.create.mockResolvedValue({ id: 'log-3' });

            const res = await request(app)
                .patch(`/api/worker-assignments/${assignmentId}`)
                .send({ action: 'decline' });

            expect(res.status).toBe(200);
            expect(res.body.workerConfirmation).toBe('declined');
            expect(res.body.workerNote).toBeNull();
        });

        it('should reject reason > 200 characters', async () => {
            const assignmentId = 'assign-4';
            const longReason = 'a'.repeat(201);

            const res = await request(app)
                .patch(`/api/worker-assignments/${assignmentId}`)
                .send({ action: 'decline', reason: longReason });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('must not exceed 200 characters');
        });

        it('should prevent worker from confirming another worker\'s assignment', async () => {
            const assignmentId = 'assign-5';
            const otherWorkerId = 'worker-2';

            prisma.shiftAssignment.findUnique.mockResolvedValue({
                id: assignmentId,
                workerId: otherWorkerId,
                agencyId: 'agency-1',
                shiftId: 'shift-1',
                workerConfirmation: 'pending',
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                }
            });

            const res = await request(app)
                .patch(`/api/worker-assignments/${assignmentId}`)
                .send({ action: 'confirm' });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('Forbidden');
        });

        it('should reject if assignment already confirmed', async () => {
            const assignmentId = 'assign-6';

            prisma.shiftAssignment.findUnique.mockResolvedValue({
                id: assignmentId,
                workerId: 'worker-1',
                agencyId: 'agency-1',
                shiftId: 'shift-1',
                workerConfirmation: 'confirmed',
                shift: {
                    id: 'shift-1',
                    facilityName: 'Hospital',
                    shiftDate: '2026-06-05',
                    startTime: '08:00',
                    endTime: '16:00',
                    role: 'Nurse'
                }
            });

            const res = await request(app)
                .patch(`/api/worker-assignments/${assignmentId}`)
                .send({ action: 'confirm' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('already confirmed');
        });

        it('should reject invalid action', async () => {
            const assignmentId = 'assign-7';

            const res = await request(app)
                .patch(`/api/worker-assignments/${assignmentId}`)
                .send({ action: 'invalid' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid action');
        });

        it('should return 404 if assignment not found', async () => {
            prisma.shiftAssignment.findUnique.mockResolvedValue(null);

            const res = await request(app)
                .patch('/api/worker-assignments/invalid-id')
                .send({ action: 'confirm' });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('not found');
        });
    });

    describe('GET /api/worker-assignments - Get worker\'s assigned shifts', () => {
        it('should return all assigned shifts for worker', async () => {
            const workerId = 'worker-1';

            prisma.shiftAssignment.findMany.mockResolvedValue([
                {
                    id: 'assign-1',
                    workerId,
                    shiftId: 'shift-1',
                    workerConfirmation: 'pending',
                    assignedAt: new Date(),
                    shift: {
                        id: 'shift-1',
                        facilityName: 'Hospital',
                        shiftDate: '2026-06-05',
                        startTime: '08:00',
                        endTime: '16:00',
                        role: 'Nurse',
                        notes: 'Standard shift'
                    }
                },
                {
                    id: 'assign-2',
                    workerId,
                    shiftId: 'shift-2',
                    workerConfirmation: 'confirmed',
                    assignedAt: new Date(),
                    shift: {
                        id: 'shift-2',
                        facilityName: 'Clinic',
                        shiftDate: '2026-06-06',
                        startTime: '09:00',
                        endTime: '17:00',
                        role: 'Carer',
                        notes: null
                    }
                }
            ]);

            const res = await request(app)
                .get('/api/worker-assignments');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].workerConfirmation).toBe('pending');
            expect(res.body.data[1].workerConfirmation).toBe('confirmed');
        });

        it('should return empty array if no assignments', async () => {
            prisma.shiftAssignment.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/worker-assignments');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
});
