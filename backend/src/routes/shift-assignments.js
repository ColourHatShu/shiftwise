const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { requireAgency, requireRole } = require('../lib/auth');
const { validateComplianceAtTime, validateComplianceForWorkers } = require('../lib/compliance-assignment');

const router = express.Router({ mergeParams: true });

// Middleware to ensure user is authorized for their agency
router.use(requireAgency);

// ─── POST /api/shifts/:shiftId/assign-bulk - Bulk assign workers (Phase 8) ───────
router.post('/assign-bulk', requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { workerIds, assignmentType = 'automatic' } = req.body;

        // Validation
        if (!Array.isArray(workerIds) || workerIds.length === 0) {
            return res.status(400).json({
                error: 'workerIds must be a non-empty array'
            });
        }

        if (workerIds.length > 100) {
            return res.status(400).json({
                error: 'Maximum 100 workers per bulk assignment request'
            });
        }

        // Verify shift exists and belongs to agency
        const shift = await prisma.shift.findFirst({
            where: {
                id: shiftId,
                agencyId: req.agencyId
            }
        });

        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Get existing assignments for this shift
        const existingAssignments = await prisma.shiftAssignment.findMany({
            where: { shiftId }
        });

        const toAssign = [];
        const toSkip = [];

        // Phase 1: Validate compliance for all workers in a single batched pass.
        // This replaces the previous per-worker findFirst + validateComplianceAtTime
        // N+1 (≈5 queries × N workers) with a constant 4 queries for the whole batch.
        const complianceByWorker = await validateComplianceForWorkers(workerIds, shiftId, req.agencyId);
        const assignedWorkerIds = new Set(existingAssignments.map(a => a.workerId));

        for (const workerId of workerIds) {
            const result = complianceByWorker.get(workerId);

            // Worker doesn't exist / not in this agency
            if (!result || result.notFound) {
                toSkip.push({ workerId, reason: 'Worker not found' });
                continue;
            }

            // Already assigned to this shift
            if (assignedWorkerIds.has(workerId)) {
                toSkip.push({ workerId, reason: 'Already assigned to this shift' });
                continue;
            }

            if (!result.isCompliant) {
                toSkip.push({ workerId, reason: result.reason });
            } else {
                toAssign.push({
                    workerId,
                    snapshot: result.snapshot,
                    score: result.snapshot.complianceScore
                });
            }
        }

        // Phase 2: Atomic assignment creation
        const assigned = [];
        const assignmentErrors = [];

        for (const { workerId, snapshot, score } of toAssign) {
            try {
                const assignment = await prisma.shiftAssignment.create({
                    data: {
                        shiftId,
                        workerId,
                        agencyId: req.agencyId,
                        complianceSnapshot: snapshot,
                        workerConfirmation: 'pending',
                        complianceCheckPassed: true,
                        assignedAt: new Date()
                    },
                    include: {
                        worker: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                });

                // Create audit log entry
                await prisma.auditLog.create({
                    data: {
                        agencyId: req.agencyId,
                        userId: req.user?.id,
                        action: 'shift.assigned',
                        entity: 'ShiftAssignment',
                        entityId: assignment.id,
                        metadata: {
                            shiftId,
                            workerId,
                            complianceScore: score,
                            assignmentType
                        },
                        ipAddress: req.ip,
                        userAgent: req.get('user-agent')
                    }
                });

                assigned.push({
                    workerId,
                    shiftId,
                    status: 'assigned',
                    complianceScore: score
                });
            } catch (error) {
                if (error.code === 'P2002') {
                    // Unique constraint violation - worker already assigned
                    toSkip.push({ workerId, reason: 'Already assigned to this shift' });
                } else {
                    assignmentErrors.push({ workerId, error: error.message });
                    toSkip.push({ workerId, reason: 'Assignment failed: ' + error.message });
                }
            }
        }

        // Calculate summary stats
        const complianceScores = assigned.map(a => a.complianceScore).filter(s => s !== undefined);
        const summary = {
            total: workerIds.length,
            assigned: assigned.length,
            skipped: toSkip.length,
            complianceScores: complianceScores.length > 0 ? {
                mean: Math.round(complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length),
                min: Math.min(...complianceScores),
                max: Math.max(...complianceScores)
            } : { mean: 0, min: 0, max: 0 }
        };

        return res.status(200).json({
            assigned,
            skipped: toSkip,
            summary
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error bulk assigning workers');
        res.status(500).json({ error: 'Failed to bulk assign workers' });
    }
});

// ─── GET /api/shifts/:shiftId/assignable-workers - Get compliant workers (Phase 8) ──
router.get('/assignable-workers', requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { page = 1, limit = 25, search = '' } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
        const skip = (pageNum - 1) * limitNum;

        // Verify shift exists
        const shift = await prisma.shift.findFirst({
            where: { id: shiftId, agencyId: req.agencyId }
        });

        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Get already-assigned workers
        const assignedWorkers = await prisma.shiftAssignment.findMany({
            where: { shiftId },
            select: { workerId: true }
        });

        const assignedIds = new Set(assignedWorkers.map(a => a.workerId));

        // Build search filter
        const searchFilter = search ? {
            OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        } : {};

        // Get all active workers not yet assigned, matching search
        const workers = await prisma.worker.findMany({
            where: {
                agencyId: req.agencyId,
                isActive: true,
                ...searchFilter
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                updatedAt: true
            },
            orderBy: { firstName: 'asc' },
            skip,
            take: limitNum
        });

        // Filter out already assigned and validate compliance
        const compliantWorkers = [];

        for (const worker of workers) {
            if (assignedIds.has(worker.id)) continue;

            const validation = await validateComplianceAtTime(worker.id, shiftId, req.agencyId);

            if (validation.isCompliant) {
                compliantWorkers.push({
                    id: worker.id,
                    firstName: worker.firstName,
                    lastName: worker.lastName,
                    email: worker.email,
                    complianceScore: validation.snapshot.complianceScore,
                    complianceStatus: validation.snapshot.status,
                    lastUpdated: worker.updatedAt
                });
            }
        }

        // Enrich each compliant worker with their reliability (confirmation rate) so
        // coordinators can weigh reliability at the point of assignment. One extra
        // aggregate query; additive only. confirmationRate = confirmed ÷ responded,
        // null when the worker has no responded assignments yet.
        const candidateIds = compliantWorkers.map((w) => w.id);
        if (candidateIds.length > 0) {
            const grouped = await prisma.shiftAssignment.groupBy({
                by: ['workerId', 'workerConfirmation'],
                where: { agencyId: req.agencyId, workerId: { in: candidateIds } },
                _count: { _all: true },
            });
            const rateMap = new Map();
            for (const row of grouped) {
                const s = rateMap.get(row.workerId) || { confirmed: 0, declined: 0 };
                const c = (row._count && row._count._all) || 0;
                if (row.workerConfirmation === 'confirmed') s.confirmed += c;
                else if (row.workerConfirmation === 'declined') s.declined += c;
                rateMap.set(row.workerId, s);
            }
            for (const w of compliantWorkers) {
                const s = rateMap.get(w.id);
                const responded = s ? s.confirmed + s.declined : 0;
                w.confirmationRate = responded > 0 ? Math.round((s.confirmed / responded) * 100) : null;
                // "Suggested" = already compliant (all here are) AND a proven high
                // confirmation rate. New workers (no history) aren't suggested but
                // aren't penalised either.
                w.suggested = w.confirmationRate !== null && w.confirmationRate >= 80;
            }
        }

        // Get total count for pagination (all workers in agency, not assigned)
        const totalWorkers = await prisma.worker.count({
            where: {
                agencyId: req.agencyId,
                isActive: true,
                ...searchFilter,
                NOT: {
                    id: { in: Array.from(assignedIds) }
                }
            }
        });

        return res.json({
            workers: compliantWorkers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalWorkers,
                pages: Math.ceil(totalWorkers / limitNum)
            }
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching assignable workers');
        res.status(500).json({ error: 'Failed to fetch assignable workers' });
    }
});

// ─── Helper: Check compliance for a worker ────────────────────────────────────
async function checkWorkerCompliance(workerId, agencyId) {
    try {
        // Get required document types for the agency
        const requiredDocTypes = await prisma.documentType.findMany({
            where: {
                agencyId,
                isRequired: true
            }
        });

        // Get worker's approved documents
        const approvedDocs = await prisma.complianceDocument.findMany({
            where: {
                workerId,
                agencyId,
                status: 'APPROVED'
            },
            include: {
                documentType: true
            }
        });

        const missingDocs = [];
        const expiredDocs = [];
        const approvedDocTypeIds = new Set(approvedDocs.map(d => d.documentTypeId));
        const now = new Date();

        // Check for missing required documents
        for (const docType of requiredDocTypes) {
            if (!approvedDocTypeIds.has(docType.id)) {
                missingDocs.push(docType.name);
            }
        }

        // Check for expired documents
        for (const doc of approvedDocs) {
            if (doc.expiryDate && new Date(doc.expiryDate) < now) {
                expiredDocs.push(doc.documentType.name);
            }
        }

        return {
            complianceCheckPassed: missingDocs.length === 0 && expiredDocs.length === 0,
            missingDocs,
            expiredDocs,
            allDocumentsApproved: approvedDocs.length > 0
        };
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error checking compliance');
        throw error;
    }
}

// ─── POST /api/shifts/:shiftId/assign - Assign single worker to shift ───────────
router.post('/assign', async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { workerId, notes } = req.body;

        // Validation
        if (!workerId) {
            return res.status(400).json({
                error: 'Missing required field: workerId'
            });
        }

        // Verify shift exists and belongs to agency
        const shift = await prisma.shift.findFirst({
            where: {
                id: shiftId,
                agencyId: req.agencyId
            }
        });

        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Verify worker exists and belongs to agency
        const worker = await prisma.worker.findFirst({
            where: {
                id: workerId,
                agencyId: req.agencyId
            }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        // Check if worker is already assigned to this shift
        const existingAssignment = await prisma.shiftAssignment.findFirst({
            where: {
                shiftId,
                workerId
            }
        });

        if (existingAssignment) {
            return res.status(400).json({
                error: 'Worker is already assigned to this shift'
            });
        }

        // Perform compliance check
        const complianceCheck = await checkWorkerCompliance(workerId, req.agencyId);

        // Create assignment (even if compliance fails - coordinator can still assign)
        const assignment = await prisma.shiftAssignment.create({
            data: {
                shiftId,
                workerId,
                agencyId: req.agencyId,
                complianceCheckPassed: complianceCheck.complianceCheckPassed,
                complianceCheckDetails: {
                    missingDocs: complianceCheck.missingDocs,
                    expiredDocs: complianceCheck.expiredDocs,
                    allDocumentsApproved: complianceCheck.allDocumentsApproved
                },
                notes
            },
            include: {
                worker: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        jobTitle: true
                    }
                }
            }
        });

        // Return 201 (created) even if compliance check failed
        // The coordinator can see the failure and decide accordingly
        res.status(201).json({ data: assignment });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error assigning worker to shift');
        res.status(500).json({ error: 'Failed to assign worker to shift' });
    }
});

// ─── GET /api/shifts/:shiftId/assignments - List assignments for shift ────────
router.get('/assignments', async (req, res) => {
    try {
        const { shiftId } = req.params;

        // Verify shift exists and belongs to agency
        const shift = await prisma.shift.findFirst({
            where: {
                id: shiftId,
                agencyId: req.agencyId
            }
        });

        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        const assignments = await prisma.shiftAssignment.findMany({
            where: {
                shiftId,
                agencyId: req.agencyId
            },
            include: {
                worker: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        jobTitle: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ data: assignments });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching shift assignments');
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

// ─── GET /api/shifts/:shiftId/assignments/:assignmentId - Get specific assignment
router.get('/assignments/:assignmentId', async (req, res) => {
    try {
        const { shiftId, assignmentId } = req.params;

        const assignment = await prisma.shiftAssignment.findFirst({
            where: {
                id: assignmentId,
                shiftId,
                agencyId: req.agencyId
            },
            include: {
                worker: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        jobTitle: true,
                        status: true
                    }
                },
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

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        res.json({ data: assignment });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching assignment');
        res.status(500).json({ error: 'Failed to fetch assignment' });
    }
});

// ─── DELETE /api/shifts/:shiftId/assignments/:assignmentId - Unassign worker ──
router.delete('/assignments/:assignmentId', async (req, res) => {
    try {
        const { shiftId, assignmentId } = req.params;

        // Verify assignment exists and belongs to agency
        const assignment = await prisma.shiftAssignment.findFirst({
            where: {
                id: assignmentId,
                shiftId,
                agencyId: req.agencyId
            }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        await prisma.shiftAssignment.delete({
            where: { id: assignmentId }
        });

        res.json({ message: 'Assignment removed successfully' });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error deleting assignment');
        res.status(500).json({ error: 'Failed to delete assignment' });
    }
});

module.exports = router;
