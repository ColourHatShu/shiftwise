/**
 * checkExpiriesAndAlert agency-scoping: the manual /alerts/test path passes
 * { agencyId } and must only scan THAT agency's documents; the nightly cron
 * (no arg) scans all agencies. Uses an empty document set so the alert/email
 * loop doesn't run — we're asserting the query filter, not the send path.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../services/emailService', () => ({ sendExpiryAlert: jest.fn(), sendWorkerExpiryAlert: jest.fn() }));
jest.mock('../../lib/prisma');

const prisma = require('../../lib/prisma');
const { checkExpiriesAndAlert } = require('../../services/cronService');

describe('checkExpiriesAndAlert — agency scoping', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.complianceDocument = { findMany: jest.fn().mockResolvedValue([]) };
    });

    it('scans only the given agency when { agencyId } is passed (manual trigger)', async () => {
        await checkExpiriesAndAlert({ agencyId: 'agency-1' });
        expect(prisma.complianceDocument.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ agencyId: 'agency-1' }) })
        );
    });

    it('scans all agencies when called with no arg (nightly cron)', async () => {
        await checkExpiriesAndAlert();
        const where = prisma.complianceDocument.findMany.mock.calls[0][0].where;
        expect(where.agencyId).toBeUndefined();
    });

    it('stays global when invoked with a non-object (node-cron Date tick)', async () => {
        await checkExpiriesAndAlert(new Date());
        const where = prisma.complianceDocument.findMany.mock.calls[0][0].where;
        expect(where.agencyId).toBeUndefined();
    });
});
