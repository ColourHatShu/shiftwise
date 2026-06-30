/**
 * Unit tests for fetchWithRetry — timeout + exponential-backoff retry helper.
 * Mocks global.fetch; uses maxRetries:1 so the real 1s backoff keeps tests quick.
 */

const { fetchWithRetry } = require('../../lib/fetchWithRetry');

const okResponse = () => ({ ok: true, status: 200, statusText: 'OK' });
const errResponse = (status) => ({ ok: false, status, statusText: `Status ${status}` });

describe('fetchWithRetry', () => {
    let logSpy, warnSpy;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        global.fetch = jest.fn();
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        delete global.fetch;
    });

    it('returns immediately on a successful first attempt (no retry)', async () => {
        global.fetch.mockResolvedValueOnce(okResponse());
        const res = await fetchWithRetry('http://x', {}, { maxRetries: 2 });
        expect(res.ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry a non-retryable non-ok response (e.g. 404)', async () => {
        global.fetch.mockResolvedValueOnce(errResponse(404));
        const res = await fetchWithRetry('http://x', {}, { maxRetries: 2 });
        expect(res.status).toBe(404);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries a 5xx and returns the eventual success', async () => {
        global.fetch
            .mockResolvedValueOnce(errResponse(500))
            .mockResolvedValueOnce(okResponse());
        const res = await fetchWithRetry('http://x', {}, { maxRetries: 1 });
        expect(res.ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('retries a thrown network error then succeeds', async () => {
        global.fetch
            .mockRejectedValueOnce(new TypeError('network down'))
            .mockResolvedValueOnce(okResponse());
        const res = await fetchWithRetry('http://x', {}, { maxRetries: 1 });
        expect(res.ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Contract quirk worth pinning: a persistent 5xx is *returned* (non-ok) after the
    // last attempt, whereas a persistent thrown error (network/abort) is re-thrown.
    it('returns the final non-ok response after exhausting retries on persistent 5xx', async () => {
        global.fetch.mockResolvedValue(errResponse(503));
        const res = await fetchWithRetry('http://x', {}, { maxRetries: 1 });
        expect(res.status).toBe(503);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws (tagging attempts) after exhausting retries on persistent network errors', async () => {
        global.fetch.mockRejectedValue(new TypeError('network down'));
        await expect(fetchWithRetry('http://x', {}, { maxRetries: 1 })).rejects.toMatchObject({
            attempts: 2,
        });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('with maxRetries:0 makes a single attempt and returns the non-ok response', async () => {
        global.fetch.mockResolvedValueOnce(errResponse(500));
        const res = await fetchWithRetry('http://x', {}, { maxRetries: 0 });
        expect(res.status).toBe(500);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('treats 429 (rate limited) as retryable', async () => {
        global.fetch
            .mockResolvedValueOnce(errResponse(429))
            .mockResolvedValueOnce(okResponse());
        const res = await fetchWithRetry('http://x', {}, { maxRetries: 1 });
        expect(res.ok).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
