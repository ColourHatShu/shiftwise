const prisma = require('./prisma');

/**
 * Compliance Assignment Library
 * Handles compliance validation at assignment time and snapshot capture
 * Per Phase 8 SPEC requirements R-SA-01 and R-SA-06
 */

/**
 * Validate worker compliance at time of assignment
 * Returns: { isCompliant: boolean, reason?: string, snapshot: {...} }
 * Per R-SA-01: Specific reasons (Missing {docType}, Document expired {date}, Not yet approved)
 */
async function validateComplianceAtTime(workerId, shiftId, agencyId) {
    try {
        // Fetch worker
        const worker = await prisma.worker.findFirst({
            where: { id: workerId, agencyId }
        });

        if (!worker) {
            throw new Error(`Worker not found: ${workerId}`);
        }

        // Fetch shift
        const shift = await prisma.shift.findFirst({
            where: { id: shiftId, agencyId }
        });

        if (!shift) {
            throw new Error(`Shift not found: ${shiftId}`);
        }

        // Get required document types for the agency
        const requiredDocTypes = await prisma.documentType.findMany({
            where: {
                agencyId,
                isRequired: true
            },
            select: {
                id: true,
                name: true,
                hasExpiry: true
            }
        });

        if (requiredDocTypes.length === 0) {
            // No required docs defined, worker is compliant
            return {
                isCompliant: true,
                reason: null,
                snapshot: {
                    documents: [],
                    complianceScore: 100,
                    status: 'compliant',
                    capturedAt: new Date().toISOString(),
                    notes: null
                }
            };
        }

        // Get worker's compliance documents
        const workerDocs = await prisma.complianceDocument.findMany({
            where: {
                workerId,
                agencyId
            },
            include: {
                documentType: true
            }
        });

        const reasons = [];
        const approvedDocs = [];
        const now = new Date();

        // Check each required document
        for (const reqDoc of requiredDocTypes) {
            const workerDoc = workerDocs.find(d => d.documentTypeId === reqDoc.id);

            if (!workerDoc) {
                reasons.push(`Missing ${reqDoc.name}`);
            } else if (workerDoc.status !== 'APPROVED') {
                reasons.push(`Not yet approved: ${reqDoc.name}`);
            } else if (workerDoc.expiryDate && new Date(workerDoc.expiryDate) < now) {
                const expiryDateStr = new Date(workerDoc.expiryDate).toISOString().split('T')[0];
                reasons.push(`Document expired ${expiryDateStr}: ${reqDoc.name}`);
            } else {
                // Document is valid
                approvedDocs.push({
                    documentTypeId: reqDoc.id,
                    documentTypeName: reqDoc.name,
                    approvalStatus: workerDoc.status,
                    expiryDate: workerDoc.expiryDate ? workerDoc.expiryDate.toISOString().split('T')[0] : null,
                    capturedAt: new Date().toISOString()
                });
            }
        }

        // Calculate compliance score
        const completedRequired = approvedDocs.length;
        const totalRequired = requiredDocTypes.length;
        const complianceScore = Math.round((completedRequired / totalRequired) * 100);

        const isCompliant = reasons.length === 0 && complianceScore === 100;

        return {
            isCompliant,
            reason: reasons.length > 0 ? reasons.join('; ') : null,
            snapshot: {
                documents: approvedDocs,
                complianceScore,
                status: isCompliant ? 'compliant' : 'non-compliant',
                capturedAt: new Date().toISOString(),
                notes: reasons.length > 0 ? reasons.join('; ') : null
            }
        };
    } catch (error) {
        console.error('Error validating compliance at assignment time:', error);
        throw error;
    }
}

/**
 * Capture compliance snapshot for assignment
 * Returns just the snapshot object from validateComplianceAtTime
 */
async function captureSnapshot(workerId, agencyId, shiftId) {
    const validation = await validateComplianceAtTime(workerId, shiftId, agencyId);
    return validation.snapshot;
}

/**
 * Check compliance for all current assignments on a shift
 * Returns: { assignedCount, compliantCount, atRiskCount, snapshot_details: [...] }
 */
async function checkComplianceForShift(shiftId, agencyId) {
    try {
        const assignments = await prisma.shiftAssignment.findMany({
            where: { shiftId, agencyId },
            include: { worker: true }
        });

        let assignedCount = assignments.length;
        let compliantCount = 0;
        let atRiskCount = 0;
        const details = [];

        for (const assignment of assignments) {
            const validation = await validateComplianceAtTime(
                assignment.workerId,
                shiftId,
                agencyId
            );

            details.push({
                workerId: assignment.workerId,
                workerName: `${assignment.worker.firstName} ${assignment.worker.lastName}`,
                isCompliant: validation.isCompliant,
                reason: validation.reason,
                snapshot: validation.snapshot
            });

            if (validation.isCompliant) {
                compliantCount++;
            } else {
                atRiskCount++;
            }
        }

        return {
            assignedCount,
            compliantCount,
            atRiskCount,
            snapshot_details: details
        };
    } catch (error) {
        console.error('Error checking shift compliance:', error);
        throw error;
    }
}

module.exports = {
    validateComplianceAtTime,
    captureSnapshot,
    checkComplianceForShift
};
