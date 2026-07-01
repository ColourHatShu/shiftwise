/**
 * emailService must SURFACE Resend API errors (Resend returns { data, error }
 * and doesn't throw). If it swallowed them, cronService would record an alert as
 * sent and never retry — a silent expiry-alert non-delivery.
 */

const ORIGINAL_KEY = process.env.RESEND_API_KEY;
process.env.RESEND_API_KEY = 'test-key'; // must be set before require so the client is created

const mockSend = jest.fn();
jest.mock('resend', () => ({ Resend: jest.fn(() => ({ emails: { send: mockSend } })) }));

const { sendExpiryAlert, sendWorkerExpiryAlert } = require('../../services/emailService');

afterAll(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_KEY;
});

describe('emailService surfaces Resend API errors', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sendExpiryAlert throws when Resend returns an error object', async () => {
        mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid recipient' } });
        await expect(sendExpiryAlert('x@y.com', 'Jane Doe', 'DBS', new Date(), 5)).rejects.toThrow(/Resend API error/);
    });

    it('sendExpiryAlert resolves on success', async () => {
        mockSend.mockResolvedValue({ data: { id: 'em_1' }, error: null });
        await expect(sendExpiryAlert('x@y.com', 'Jane Doe', 'DBS', new Date(), 5)).resolves.toBeTruthy();
    });

    it('sendWorkerExpiryAlert throws when Resend returns an error object', async () => {
        mockSend.mockResolvedValue({ data: null, error: { message: 'domain not verified' } });
        await expect(sendWorkerExpiryAlert('w@y.com', 'Jane', 'DBS', new Date(), 5)).rejects.toThrow(/Resend API error/);
    });
});
