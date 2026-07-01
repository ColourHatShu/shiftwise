const prisma = require('./prisma');
const logger = require('./logger');

/**
 * Compliance Assignment Library
 * Handles compliance validation at assignment time and snapshot capture
 * Per Phase 8 SPEC requirements R-SA-01 and R-SA-06
 */

/**
 * Pure compliance computation shared by the single-worker and batched paths.
 * Given the agency's required document types and a worker's compliance documents,
 * returns { isCompliant, reason, snapshot } with no I/O — so the single-worker and
 * bulk code paths can never diverge on how compliance is judged.
 */
function computeCompliance(requiredDocTypes, workerDocs) {
    const reasons = [];
    const approvedDocs = [];
    const now = new Date();

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
            approvedDocs.push({
                documentTypeId: reqDoc.id,
                documentTypeName: reqDoc.name,
                approvalStatus: workerDoc.status,
                expiryDate: workerDoc.expiryDate ? workerDoc.expiryDate.toISOString().split('T')[0] : null,
                capturedAt: new Date().toISOString()
            });
        }
    }

    const totalRequired = requiredDocTypes.length;
    const complianceScore = totalRequired === 0
        ? 100
        : Math.round((approvedDocs.length / totalRequired) * 100);
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
}

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
            return computeCompliance([], []);
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

        return computeCompliance(requiredDocTypes, workerDocs);
    } catch (error) {
        logger.error({ err: error }, 'Error validating compliance at assignment time');
        throw error;
    }
}

/**
 * Batched compliance validation for many workers against ONE shift.
 * Fetches the shift, all workers, the required document types, and every worker's
 * compliance documents in a constant number of queries (4) regardless of how many
 * workers are passed — replacing the previous per-worker N+1 in bulk assignment.
 *
 * Returns: Map<workerId, { notFound: true } | { notFound: false, isCompliant, reason, snapshot }>
 */
async function validateComplianceForWorkers(workerIds, shiftId, agencyId) {
    const results = new Map();
    if (!Array.isArray(workerIds) || workerIds.length === 0) return results;

    // Shift fetched once (shared across all workers).
    const shift = await prisma.shift.findFirst({ where: { id: shiftId, agencyId } });
    if (!shift) {
        throw new Error(`Shift not found: ${shiftId}`);
    }

    // All requested workers fetched in a single query (existence + agency scope).
    // status: 'ACTIVE' excludes deactivated workers so they can't be assigned via
    // the bulk path (deactivate sets status=INACTIVE); they fall through to notFound.
    const workers = await prisma.worker.findMany({
        where: { id: { in: workerIds }, agencyId, status: 'ACTIVE' },
        select: { id: true }
    });
    const foundIds = new Set(workers.map(w => w.id));

    // Required document types fetched once (shared across all workers).
    const requiredDocTypes = await prisma.documentType.findMany({
        where: { agencyId, isRequired: true },
        select: { id: true, name: true, hasExpiry: true }
    });

    // Every worker's compliance documents fetched in a single query, grouped in memory.
    const docsByWorker = new Map();
    if (requiredDocTypes.length > 0) {
        const allDocs = await prisma.complianceDocument.findMany({
            where: { workerId: { in: workerIds }, agencyId },
            include: { documentType: true }
        });
        for (const doc of allDocs) {
            if (!docsByWorker.has(doc.workerId)) docsByWorker.set(doc.workerId, []);
            docsByWorker.get(doc.workerId).push(doc);
        }
    }

    for (const workerId of workerIds) {
        if (!foundIds.has(workerId)) {
            results.set(workerId, { notFound: true });
            continue;
        }
        const workerDocs = docsByWorker.get(workerId) || [];
        results.set(workerId, { notFound: false, ...computeCompliance(requiredDocTypes, workerDocs) });
    }

    return results;
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
        logger.error({ err: error }, 'Error checking shift compliance');
        throw error;
    }
}

module.exports = {
    computeCompliance,
    validateComplianceAtTime,
    validateComplianceForWorkers,
    captureSnapshot,
    checkComplianceForShift
};
