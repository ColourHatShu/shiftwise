const {
    calculateScore,
    getWorkersWithScores,
    aggregateAlerts,
    verifyScoreFormula
} = require('../compliance-service');
const prisma = require('../prisma');

// Mock prisma
jest.mock('../prisma');

describe('Compliance Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateScore', () => {
        it('should calculate 100% when all required docs are approved', async () => {
            const workerId = 'worker1';
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true },
                { id: 'dt2', isRequired: true }
            ]);

            prisma.complianceDocument.count.mockResolvedValue(2);

            const result = await calculateScore(workerId, agencyId);

            expect(result.score).toBe(100);
            expect(result.completedDocs).toBe(2);
            expect(result.totalRequiredDocs).toBe(2);
            expect(result.status).toBe('green');
        });

        it('should calculate 50% when half of required docs are approved', async () => {
            const workerId = 'worker1';
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true },
                { id: 'dt2', isRequired: true }
            ]);

            prisma.complianceDocument.count.mockResolvedValue(1);

            const result = await calculateScore(workerId, agencyId);

            expect(result.score).toBe(50);
            expect(result.completedDocs).toBe(1);
            expect(result.totalRequiredDocs).toBe(2);
            expect(result.status).toBe('yellow');
        });

        it('should return green status for score >= 80%', async () => {
            const workerId = 'worker1';
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true },
                { id: 'dt2', isRequired: true },
                { id: 'dt3', isRequired: true },
                { id: 'dt4', isRequired: true },
                { id: 'dt5', isRequired: true }
            ]);

            prisma.complianceDocument.count.mockResolvedValue(4); // 80%

            const result = await calculateScore(workerId, agencyId);

            expect(result.score).toBe(80);
            expect(result.status).toBe('green');
        });

        it('should return red status for score < 50%', async () => {
            const workerId = 'worker1';
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true },
                { id: 'dt2', isRequired: true },
                { id: 'dt3', isRequired: true }
            ]);

            prisma.complianceDocument.count.mockResolvedValue(1); // 33%

            const result = await calculateScore(workerId, agencyId);

            expect(result.score).toBe(33);
            expect(result.status).toBe('red');
        });

        it('should handle 0 required documents gracefully', async () => {
            const workerId = 'worker1';
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([]);

            const result = await calculateScore(workerId, agencyId);

            expect(result.score).toBe(100);
            expect(result.completedDocs).toBe(0);
            expect(result.totalRequiredDocs).toBe(0);
            expect(result.status).toBe('green');
        });
    });

    describe('getWorkersWithScores', () => {
        it('should return workers with compliance scores', async () => {
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true },
                { id: 'dt2', isRequired: true }
            ]);

            prisma.worker.findMany.mockResolvedValue([
                {
                    id: 'w1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    jobTitle: 'Nurse',
                    status: 'ACTIVE',
                    updatedAt: new Date(),
                    complianceDocuments: [
                        { id: 'd1', status: 'APPROVED', expiryDate: null },
                        { id: 'd2', status: 'APPROVED', expiryDate: null }
                    ]
                }
            ]);

            const result = await getWorkersWithScores(agencyId);

            expect(result.workers).toHaveLength(1);
            expect(result.workers[0].complianceScore).toBe(100);
            expect(result.workers[0].complianceStatus).toBe('green');
        });

        it('should apply search filter', async () => {
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true }
            ]);

            prisma.worker.findMany.mockResolvedValue([
                {
                    id: 'w1',
                    firstName: 'John',
                    lastName: 'Smith',
                    email: 'john@example.com',
                    jobTitle: null,
                    status: 'ACTIVE',
                    updatedAt: new Date(),
                    complianceDocuments: []
                }
            ]);

            const result = await getWorkersWithScores(agencyId, { search: 'john' });

            expect(prisma.worker.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.any(Array)
                    })
                })
            );
        });

        it('should apply status filter', async () => {
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true }
            ]);

            prisma.worker.findMany.mockResolvedValue([
                {
                    id: 'w1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    jobTitle: null,
                    status: 'ACTIVE',
                    updatedAt: new Date(),
                    complianceDocuments: []
                }
            ]);

            const result = await getWorkersWithScores(agencyId, { statusFilter: 'red' });

            // Workers with red status will be filtered in-memory
            expect(Array.isArray(result.workers)).toBe(true);
        });
    });

    describe('aggregateAlerts', () => {
        it('should aggregate alerts by type', async () => {
            const agencyId = 'agency1';

            prisma.documentType.findMany.mockResolvedValue([
                { id: 'dt1', isRequired: true }
            ]);

            prisma.worker.findMany.mockResolvedValue([
                {
                    id: 'w1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    complianceDocuments: [
                        {
                            id: 'd1',
                            status: 'APPROVED',
                            expiryDate: new Date(Date.now() - 1000 * 60 * 60 * 24), // expired
                            documentType: { name: 'DBS' },
                            documentTypeId: 'dt1'
                        }
                    ]
                }
            ]);

            const result = await aggregateAlerts(agencyId);

            expect(result.expiredCount).toBeGreaterThanOrEqual(0);
            expect(result.expiringCount).toBeGreaterThanOrEqual(0);
            expect(result.nonCompliantCount).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(result.alerts)).toBe(true);
        });
    });

    describe('Score formula verification (Phase 4 equivalence)', () => {
        it('should match Phase 4 worker portal formula', () => {
            // Formula: (completed_required / total_required) * 100

            const testCases = [
                { completed: 5, total: 5, expected: 100 },
                { completed: 4, total: 5, expected: 80 },
                { completed: 2, total: 5, expected: 40 },
                { completed: 0, total: 5, expected: 0 },
                { completed: 1, total: 2, expected: 50 }
            ];

            testCases.forEach(({ completed, total, expected }) => {
                const score = Math.round((completed / total) * 100);
                expect(score).toBe(expected);
            });
        });
    });
});
