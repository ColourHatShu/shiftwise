/**
 * Compliance scoring must NOT count expired-but-APPROVED documents as compliant.
 * Nothing in the app flips document status to EXPIRED — expiry lives in
 * expiryDate — so the score has to check the date, or it reports a false green.
 */

jest.mock('../../lib/prisma');

const prisma = require('../../lib/prisma');
const { calculateScore, getWorkersWithScores } = require('../../lib/compliance-service');

const past = new Date(Date.now() - 5 * 86400000);
const future = new Date(Date.now() + 30 * 86400000);

describe('compliance scoring excludes expired documents', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.documentType = { findMany: jest.fn().mockResolvedValue([{ id: 'dt1' }]) };
    });

    describe('getWorkersWithScores', () => {
        it('does not count an APPROVED-but-EXPIRED required doc toward the score', async () => {
            prisma.worker = {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'w1', firstName: 'Ex', lastName: 'Pired', complianceDocuments: [{ id: 'd1', status: 'APPROVED', expiryDate: past }] },
                    { id: 'w2', firstName: 'Val', lastName: 'Id', complianceDocuments: [{ id: 'd2', status: 'APPROVED', expiryDate: future }] },
                ]),
            };

            const { workers } = await getWorkersWithScores('agency-1', {});
            const byId = Object.fromEntries(workers.map((w) => [w.id, w]));
            expect(byId.w1.complianceScore).toBe(0); // expired → not counted → red
            expect(byId.w1.complianceStatus).toBe('red');
            expect(byId.w2.complianceScore).toBe(100); // valid → counted → green
            expect(byId.w2.complianceStatus).toBe('green');
        });
    });

    describe('calculateScore', () => {
        it('queries only approved + non-expired documents', async () => {
            prisma.complianceDocument = { count: jest.fn().mockResolvedValue(0) };
            await calculateScore('w1', 'agency-1');
            const where = prisma.complianceDocument.count.mock.calls[0][0].where;
            expect(where.status).toBe('APPROVED');
            // expiry guard: null OR not-yet-expired
            expect(Array.isArray(where.OR)).toBe(true);
            expect(where.OR).toEqual(expect.arrayContaining([{ expiryDate: null }]));
            expect(where.OR.some((c) => c.expiryDate && c.expiryDate.gte)).toBe(true);
        });
    });
});
