/**
 * markExpiredDocuments — the nightly job that flips APPROVED docs whose expiry
 * has passed to status EXPIRED, making the (otherwise phantom) EXPIRED status
 * real so status-based reads stop being expiry-blind.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../services/emailService', () => ({ sendExpiryAlert: jest.fn(), sendWorkerExpiryAlert: jest.fn() }));
jest.mock('../../lib/prisma');

const prisma = require('../../lib/prisma');
const { markExpiredDocuments } = require('../../services/cronService');

describe('markExpiredDocuments', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.complianceDocument = { updateMany: jest.fn().mockResolvedValue({ count: 4 }) };
    });

    it('flips APPROVED + past-expiry documents to EXPIRED and returns the count', async () => {
        const count = await markExpiredDocuments();
        expect(count).toBe(4);
        const arg = prisma.complianceDocument.updateMany.mock.calls[0][0];
        expect(arg.where.status).toBe('APPROVED');
        expect(arg.data).toEqual({ status: 'EXPIRED' });
    });

    it('uses a start-of-day (UTC midnight) boundary so docs expiring today stay valid', async () => {
        await markExpiredDocuments();
        const lt = prisma.complianceDocument.updateMany.mock.calls[0][0].where.expiryDate.lt;
        expect(lt).toBeInstanceOf(Date);
        expect(lt.getUTCHours()).toBe(0);
        expect(lt.getUTCMinutes()).toBe(0);
        expect(lt.getUTCSeconds()).toBe(0);
    });

    it('propagates DB errors (so the scheduler/Sentry sees them)', async () => {
        prisma.complianceDocument.updateMany.mockRejectedValue(new Error('db down'));
        await expect(markExpiredDocuments()).rejects.toThrow('db down');
    });
});
