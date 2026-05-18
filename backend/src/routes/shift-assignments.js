const express = require('express');
const prisma = require('../lib/prisma');
const { requireAgency } = require('../lib/auth');

const router = express.Router({ mergeParams: true });

// Middleware to ensure user is authorized for their agency
router.use(requireAgency);

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
        console.error('Error checking compliance:', error);
        throw error;
    }
}

// ─── POST /api/shifts/:shiftId/assign - Assign worker to shift ────────────────
router.post('/', async (req, res) => {
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
        console.error('Error assigning worker to shift:', error);
        res.status(500).json({ error: 'Failed to assign worker to shift' });
    }
});

// ─── GET /api/shifts/:shiftId/assignments - List assignments for shift ────────
router.get('/', async (req, res) => {
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
        console.error('Error fetching shift assignments:', error);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

// ─── GET /api/shifts/:shiftId/assignments/:assignmentId - Get specific assignment
router.get('/:assignmentId', async (req, res) => {
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
        console.error('Error fetching assignment:', error);
        res.status(500).json({ error: 'Failed to fetch assignment' });
    }
});

// ─── DELETE /api/shifts/:shiftId/assignments/:assignmentId - Unassign worker ──
router.delete('/:assignmentId', async (req, res) => {
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
        console.error('Error deleting assignment:', error);
        res.status(500).json({ error: 'Failed to delete assignment' });
    }
});

module.exports = router;
