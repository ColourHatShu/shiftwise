const pino = require('pino');

/**
 * Structured application logger.
 *
 * - Level from LOG_LEVEL (default: debug in dev, info in production).
 * - JSON output (deploy-ready; pairs with the Sentry error pipeline).
 * - Redacts common secret/PII fields so they never land in logs.
 *
 * Per-request usage: attach a child logger carrying the correlation id, e.g.
 *   req.log = logger.child({ requestId: req.requestId })
 * so every line for a request is tied back to a single user action.
 */
const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'password',
            'otp',
            'token',
            '*.password',
            '*.otp',
        ],
        remove: true,
    },
});

module.exports = logger;
