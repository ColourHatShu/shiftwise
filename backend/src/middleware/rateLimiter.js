/**
 * Rate Limiting Middleware
 * 
 * Provides strict rate limiting for AI analysis and other sensitive endpoints.
 * 
 * @module middleware/rateLimiter
 */

const rateLimit = require('express-rate-limit');

// ─── AI Analysis Rate Limiter ────────────────────────────────────────────────
// Strict limit: 10 requests per 15 minutes per IP
const aiAnalysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: {
        error: 'Too many AI analysis requests',
        message: 'You can only request 10 AI analyses per 15 minutes. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many AI analysis requests',
            message: 'You can only request 10 AI analyses per 15 minutes. Please try again later.',
            retryAfter: '15 minutes'
        });
    },
    skip: (req) => {
        // Skip rate limiting for health checks or in development if needed
        return process.env.NODE_ENV === 'test';
    }
});

// ─── Document Upload Rate Limiter ───────────────────────────────────────────
// Moderate limit: 20 uploads per 15 minutes per IP
const documentUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 uploads per window
    message: {
        error: 'Too many document uploads',
        message: 'You can only upload 20 documents per 15 minutes. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many document uploads',
            message: 'You can only upload 20 documents per 15 minutes. Please try again later.',
            retryAfter: '15 minutes'
        });
    }
});

// ─── General API Rate Limiter ───────────────────────────────────────────────
// Default limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please try again later.',
            retryAfter: '15 minutes'
        });
    }
});

module.exports = {
    aiAnalysisLimiter,
    documentUploadLimiter,
    generalLimiter
};
