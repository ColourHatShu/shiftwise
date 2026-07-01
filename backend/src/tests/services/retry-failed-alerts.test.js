/**
 * retryFailedAlerts — the dead-letter retry for expiry alerts (now load-bearing
 * after emailService started surfacing Resend errors). Locks: success → RESOLVED
 * (+ ExpiryAlert), transient failure → back to PENDING, and max-retries →
 * FAILED_PERMANENTLY. MAX_RETRY_ATTEMPTS = 3.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));
jest.mock('../../services/emailService', () => ({ sendExpiryAlert: jest.fn(), sendWorkerExpiryAlert: jest.fn() }));
jest.mock('../../lib/prisma');

const prisma = require('../../lib/prisma');
const { sendExpiryAlert } = require('../../services/emailService');
const { retryFailedAlerts } = require('../../services/cronService');

const makeAlert = (retryCount) => ({
    id: 'fa1',
    agencyId: 'agency-1',
    workerId: 'w1',
    complianceDocumentId: 'd1',
    daysUntilExpiry: 7,
    retryCount,
    worker: { firstName: 'Jane', lastName: 'Doe' },
    complianceDocument: { documentType: { name: 'DBS' }, expiryDate: new Date() },
    agency: { email: 'coord@agency.com' },
});

// The final failedAlert.update per alert carries the terminal status (the first is RETRYING).
const lastUpdateStatus = () => {
    const calls = prisma.failedAlert.update.mock.calls;
    return calls[calls.length - 1][0].data.status;
};

describe('retryFailedAlerts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.failedAlert = { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) };
        prisma.expiryAlert = { create: jest.fn().mockResolvedValue({}) };
    });

    it('resolves and records an ExpiryAlert when the retry send succeeds', async () => {
        prisma.failedAlert.findMany.mockResolvedValue([makeAlert(0)]);
        sendExpiryAlert.mockResolvedValue({ data: { id: 'em_1' } });
        await retryFailedAlerts();
        expect(lastUpdateStatus()).toBe('RESOLVED');
        expect(prisma.expiryAlert.create).toHaveBeenCalled();
    });

    it('returns a transient failure to PENDING (below max retries)', async () => {
        prisma.failedAlert.findMany.mockResolvedValue([makeAlert(0)]);
        sendExpiryAlert.mockRejectedValue(new Error('smtp down'));
        await retryFailedAlerts();
        expect(lastUpdateStatus()).toBe('PENDING');
        expect(prisma.expiryAlert.create).not.toHaveBeenCalled();
    });

    it('marks FAILED_PERMANENTLY when the max retry attempt fails', async () => {
        prisma.failedAlert.findMany.mockResolvedValue([makeAlert(2)]); // 2 + 1 >= 3
        sendExpiryAlert.mockRejectedValue(new Error('still down'));
        await retryFailedAlerts();
        expect(lastUpdateStatus()).toBe('FAILED_PERMANENTLY');
    });
});
