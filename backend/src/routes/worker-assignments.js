const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { workerAuthMiddleware } = require('./worker-auth');

const router = express.Router();

// Middleware: Worker must be authenticated via OTP
router.use(workerAuthMiddleware);

/**
 * PATCH /api/worker-assignments/:assignmentId
 * Worker confirms or declines a shift assignment
 * Per R-SA-05: Worker shift confirmation workflow
 */
router.patch('/:assignmentId', async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { action, reason } = req.body;
        const workerId = req.worker.id; // From workerAuthMiddleware

        // Validate action
        if (!['confirm', 'decline'].includes(action)) {
            return res.status(400).json({
                error: 'Invalid action. Must be "confirm" or "decline"'
            });
        }

        // If declining, validate reason length
        if (action === 'decline' && reason && reason.length > 200) {
            return res.status(400).json({
                error: 'Reason must not exceed 200 characters'
            });
        }

        // Fetch assignment
        const assignment = await prisma.shiftAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                shift: {
                    select: {
                        id: true,
                        facilityName: true,
                        shiftDate: true,
                        startTime: true,
                        endTime: true,
                        role: true
                    }
                },
                worker: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Verify worker owns this assignment
        if (assignment.workerId !== workerId) {
            return res.status(403).json({
                error: 'Forbidden: You can only confirm/decline your own assignments'
            });
        }

        // Check if already confirmed or declined
        if (assignment.workerConfirmation !== 'pending') {
            return res.status(400).json({
                error: `Assignment already ${assignment.workerConfirmation}. Cannot change status.`
            });
        }

        // Update assignment
        const updateData = {
            workerConfirmation: action,
            workerNote: action === 'decline' ? (reason || null) : null
        };

        const updatedAssignment = await prisma.shiftAssignment.update({
            where: { id: assignmentId },
            data: updateData,
            include: {
                shift: {
                    select: {
                        id: true,
                        facilityName: true,
                        shiftDate: true,
                        startTime: true,
                        endTime: true,
                        role: true
                    }
                }
            }
        });

        // Create audit log entry
        await prisma.auditLog.create({
            data: {
                agencyId: assignment.agencyId,
                userId: null, // Worker action, no coordinator user ID
                action: action === 'confirm' ? 'shift.assignment-confirmed' : 'shift.assignment-declined',
                entity: 'ShiftAssignment',
                entityId: assignmentId,
                metadata: {
                    workerId,
                    shiftId: assignment.shiftId,
                    action,
                    reason: action === 'decline' ? reason : null
                },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            }
        });

        res.json(updatedAssignment);
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error confirming/declining assignment');
        res.status(500).json({ error: 'Failed to update assignment status' });
    }
});

/**
 * GET /api/worker-assignments
 * Get all assigned shifts for the authenticated worker
 */
router.get('/', async (req, res) => {
    try {
        const workerId = req.worker.id;
        const agencyId = req.worker.agencyId;

        const assignments = await prisma.shiftAssignment.findMany({
            where: {
                workerId,
                agencyId
            },
            include: {
                shift: {
                    select: {
                        id: true,
                        facilityName: true,
                        shiftDate: true,
                        startTime: true,
                        endTime: true,
                        role: true,
                        notes: true,
                        requiredCount: true
                    }
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        res.json({ data: assignments });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching worker assignments');
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

module.exports = router;
