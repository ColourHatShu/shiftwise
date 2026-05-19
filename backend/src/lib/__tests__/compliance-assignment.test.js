/**
 * Compliance Assignment Library Tests
 * Tests validateComplianceAtTime, captureSnapshot, checkComplianceForShift
 * Per Phase 8 SPEC R-SA-01 and R-SA-06
 */

jest.mock('../prisma');
const prisma = require('../prisma');
const {
    validateComplianceAtTime,
    captureSnapshot,
    checkComplianceForShift
} = require('../compliance-assignment');

describe('Compliance Assignment Library', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateComplianceAtTime', () => {
        it('should return compliant for worker with all required approved docs', async () => {
            const workerId = 'worker-1';
            const shiftId = 'shift-1';
            const agencyId = 'agency-1';

            // Mock worker
            prisma.worker.findFirst.mockResolvedValueOnce({
                id: workerId,
                firstName: 'John',
                lastName: 'Doe',
                agencyId
            });

            // Mock shift
            prisma.shift.findFirst.mockResolvedValueOnce({
                id: shiftId,
                agencyId,
                facilityName: 'Hospital',
                role: 'Nurse'
            });

            // Mock required doc types
            prisma.documentType.findMany.mockResolvedValueOnce([
                { id: 'dbs-type', name: 'DBS', hasExpiry: true },
                { id: 'rtw-type', name: 'Right to Work', hasExpiry: true }
            ]);

            // Mock compliant worker docs
            prisma.complianceDocument.findMany.mockResolvedValueOnce([
                {
                    id: 'doc-1',
                    workerId,
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2027-12-31'),
                    documentType: { id: 'dbs-type', name: 'DBS' }
                },
                {
                    id: 'doc-2',
                    workerId,
                    documentTypeId: 'rtw-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2026-12-31'),
                    documentType: { id: 'rtw-type', name: 'Right to Work' }
                }
            ]);

            const result = await validateComplianceAtTime(workerId, shiftId, agencyId);

            expect(result.isCompliant).toBe(true);
            expect(result.reason).toBeNull();
            expect(result.snapshot.status).toBe('compliant');
            expect(result.snapshot.complianceScore).toBe(100);
            expect(result.snapshot.documents).toHaveLength(2);
        });

        it('should return non-compliant for worker with missing required doc', async () => {
            const workerId = 'worker-2';
            const shiftId = 'shift-1';
            const agencyId = 'agency-1';

            prisma.worker.findFirst.mockResolvedValueOnce({
                id: workerId,
                firstName: 'Jane',
                lastName: 'Smith',
                agencyId
            });

            prisma.shift.findFirst.mockResolvedValueOnce({
                id: shiftId,
                agencyId,
                facilityName: 'Clinic'
            });

            // Two required docs
            prisma.documentType.findMany.mockResolvedValueOnce([
                { id: 'dbs-type', name: 'DBS', hasExpiry: true },
                { id: 'rtw-type', name: 'Right to Work', hasExpiry: true }
            ]);

            // Only one doc present
            prisma.complianceDocument.findMany.mockResolvedValueOnce([
                {
                    id: 'doc-1',
                    workerId,
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2027-12-31'),
                    documentType: { id: 'dbs-type', name: 'DBS' }
                }
            ]);

            const result = await validateComplianceAtTime(workerId, shiftId, agencyId);

            expect(result.isCompliant).toBe(false);
            expect(result.reason).toContain('Missing Right to Work');
            expect(result.snapshot.status).toBe('non-compliant');
            expect(result.snapshot.complianceScore).toBe(50);
        });

        it('should return non-compliant for worker with expired document', async () => {
            const workerId = 'worker-3';
            const shiftId = 'shift-1';
            const agencyId = 'agency-1';

            prisma.worker.findFirst.mockResolvedValueOnce({
                id: workerId,
                firstName: 'Bob',
                lastName: 'Johnson',
                agencyId
            });

            prisma.shift.findFirst.mockResolvedValueOnce({
                id: shiftId,
                agencyId,
                facilityName: 'Clinic'
            });

            prisma.documentType.findMany.mockResolvedValueOnce([
                { id: 'dbs-type', name: 'DBS', hasExpiry: true },
                { id: 'rtw-type', name: 'Right to Work', hasExpiry: true }
            ]);

            // One doc expired
            prisma.complianceDocument.findMany.mockResolvedValueOnce([
                {
                    id: 'doc-1',
                    workerId,
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2025-01-01'), // Expired
                    documentType: { id: 'dbs-type', name: 'DBS' }
                },
                {
                    id: 'doc-2',
                    workerId,
                    documentTypeId: 'rtw-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2027-12-31'),
                    documentType: { id: 'rtw-type', name: 'Right to Work' }
                }
            ]);

            const result = await validateComplianceAtTime(workerId, shiftId, agencyId);

            expect(result.isCompliant).toBe(false);
            expect(result.reason).toContain('Document expired');
            expect(result.snapshot.status).toBe('non-compliant');
            expect(result.snapshot.complianceScore).toBe(50);
        });

        it('should return non-compliant for document pending approval', async () => {
            const workerId = 'worker-4';
            const shiftId = 'shift-1';
            const agencyId = 'agency-1';

            prisma.worker.findFirst.mockResolvedValueOnce({
                id: workerId,
                agencyId
            });

            prisma.shift.findFirst.mockResolvedValueOnce({
                id: shiftId,
                agencyId
            });

            prisma.documentType.findMany.mockResolvedValueOnce([
                { id: 'dbs-type', name: 'DBS', hasExpiry: true }
            ]);

            prisma.complianceDocument.findMany.mockResolvedValueOnce([
                {
                    id: 'doc-1',
                    workerId,
                    documentTypeId: 'dbs-type',
                    status: 'PENDING', // Not approved
                    expiryDate: new Date('2027-12-31'),
                    documentType: { id: 'dbs-type', name: 'DBS' }
                }
            ]);

            const result = await validateComplianceAtTime(workerId, shiftId, agencyId);

            expect(result.isCompliant).toBe(false);
            expect(result.reason).toContain('Not yet approved');
        });

        it('should throw error when worker not found', async () => {
            prisma.worker.findFirst.mockResolvedValueOnce(null);

            await expect(
                validateComplianceAtTime('invalid-worker', 'shift-1', 'agency-1')
            ).rejects.toThrow('Worker not found');
        });

        it('should throw error when shift not found', async () => {
            prisma.worker.findFirst.mockResolvedValueOnce({
                id: 'worker-1',
                agencyId: 'agency-1'
            });

            prisma.shift.findFirst.mockResolvedValueOnce(null);

            await expect(
                validateComplianceAtTime('worker-1', 'invalid-shift', 'agency-1')
            ).rejects.toThrow('Shift not found');
        });
    });

    describe('captureSnapshot', () => {
        it('should capture immutable snapshot at assignment time', async () => {
            const workerId = 'worker-1';
            const shiftId = 'shift-1';
            const agencyId = 'agency-1';

            prisma.worker.findFirst.mockResolvedValueOnce({
                id: workerId,
                firstName: 'John',
                agencyId
            });

            prisma.shift.findFirst.mockResolvedValueOnce({
                id: shiftId,
                agencyId
            });

            prisma.documentType.findMany.mockResolvedValueOnce([
                { id: 'dbs-type', name: 'DBS', hasExpiry: true }
            ]);

            prisma.complianceDocument.findMany.mockResolvedValueOnce([
                {
                    id: 'doc-1',
                    workerId,
                    documentTypeId: 'dbs-type',
                    status: 'APPROVED',
                    expiryDate: new Date('2027-12-31'),
                    documentType: { id: 'dbs-type', name: 'DBS' }
                }
            ]);

            const snapshot = await captureSnapshot(workerId, agencyId, shiftId);

            expect(snapshot).toBeDefined();
            expect(snapshot.status).toBe('compliant');
            expect(snapshot.complianceScore).toBe(100);
            expect(snapshot.capturedAt).toBeDefined();
            expect(snapshot.documents).toBeDefined();
            expect(Array.isArray(snapshot.documents)).toBe(true);
        });
    });

    describe('checkComplianceForShift', () => {
        it('should check compliance for all assignments on a shift', async () => {
            const shiftId = 'shift-1';
            const agencyId = 'agency-1';

            prisma.shiftAssignment.findMany.mockResolvedValueOnce([
                { id: 'assign-1', workerId: 'worker-1', shiftId, agencyId, worker: { firstName: 'John', lastName: 'Doe' } },
                { id: 'assign-2', workerId: 'worker-2', shiftId, agencyId, worker: { firstName: 'Jane', lastName: 'Smith' } }
            ]);

            // Mock compliance checks for two workers
            prisma.worker.findFirst
                .mockResolvedValueOnce({ id: 'worker-1', firstName: 'John', agencyId })
                .mockResolvedValueOnce({ id: 'worker-2', firstName: 'Jane', agencyId });

            prisma.shift.findFirst
                .mockResolvedValueOnce({ id: shiftId, agencyId })
                .mockResolvedValueOnce({ id: shiftId, agencyId });

            // Required docs
            prisma.documentType.findMany
                .mockResolvedValueOnce([{ id: 'dbs-type', name: 'DBS', hasExpiry: true }])
                .mockResolvedValueOnce([{ id: 'dbs-type', name: 'DBS', hasExpiry: true }]);

            // Worker 1: compliant
            prisma.complianceDocument.findMany
                .mockResolvedValueOnce([
                    {
                        id: 'doc-1',
                        workerId: 'worker-1',
                        documentTypeId: 'dbs-type',
                        status: 'APPROVED',
                        expiryDate: new Date('2027-12-31'),
                        documentType: { id: 'dbs-type', name: 'DBS' }
                    }
                ])
                // Worker 2: non-compliant (missing doc)
                .mockResolvedValueOnce([]);

            const result = await checkComplianceForShift(shiftId, agencyId);

            expect(result.assignedCount).toBe(2);
            expect(result.compliantCount).toBe(1);
            expect(result.atRiskCount).toBe(1);
            expect(result.snapshot_details).toHaveLength(2);
        });
    });
});
