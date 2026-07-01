/**
 * Smoke tests for the pino logger module. Constructing pino with an invalid
 * redact config throws at require-time, so this also guards the config.
 * LOG_LEVEL=silent keeps test output clean.
 */

process.env.LOG_LEVEL = 'silent';

const logger = require('../../lib/logger');

describe('logger', () => {
    it('constructs and exposes the standard log levels', () => {
        for (const level of ['debug', 'info', 'warn', 'error']) {
            expect(typeof logger[level]).toBe('function');
        }
    });

    it('creates a request-scoped child logger without throwing', () => {
        const child = logger.child({ requestId: 'req-123' });
        expect(typeof child.info).toBe('function');
        expect(() => child.error({ err: new Error('x') }, 'boom')).not.toThrow();
    });
});
