/**
 * Canonical Authentication Module
 *
 * Pattern A: Separate, independently-importable functions
 * - verifyClerkToken(req) — extracts and verifies JWT, throws on failure
 * - getUser(clerkUserId) — looks up user + agency from Prisma, throws if not found
 * - requireAgency(req, res, next) — Express middleware composing the above
 * - requireRole(allowedRoles) — Express middleware asserting user role
 *
 * This module consolidates four legacy helpers from routes/* (requireAgency in workers.js,
 * verifyClerkToken in agencies.js, getAgencyId in dashboard.js, getAgencyUser in documents.js).
 * Routes should import exactly what they need: e.g., const { requireAgency, requireRole } = require('../lib/auth');
 *
 * @module lib/auth
 */

const { verifyToken } = require('@clerk/backend');
const prisma = require('./prisma');

// ─── Error Classes ─────────────────────────────────────────────────────────

/**
 * UnauthorizedError — 401 status, missing or invalid token
 */
class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnauthorizedError';
        this.status = 401;
    }
}

/**
 * ForbiddenError — 403 status, insufficient role or no agency
 */
class ForbiddenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ForbiddenError';
        this.status = 403;
    }
}

// ─── Core Functions ───────────────────────────────────────────────────────

/**
 * Verify a Clerk JWT from the Authorization header.
 * Throws UnauthorizedError on invalid/missing token or misconfiguration.
 *
 * @param {Object} req — Express request object
 * @returns {Object} — Decoded Clerk JWT payload ({ sub, ... })
 * @throws {UnauthorizedError} — On token verification failure or missing CLERK_SECRET_KEY
 */
const verifyClerkToken = async (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Unauthorized: No token provided');
    }

    const token = authHeader.split(' ')[1];
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
        console.error('❌ CLERK_SECRET_KEY is not set!');
        throw new Error('Server misconfiguration: CLERK_SECRET_KEY not set');
    }

    let payload;
    try {
        payload = await verifyToken(token, {
            secretKey,
            authorizedParties: [process.env.AUTHORIZED_PARTY || 'http://localhost:3000'],
            clockSkewInMs: 300000  // 5 min tolerance for clock skew
        });
    } catch (err) {
        console.error('❌ Token verification failed:', err.message);
        throw new UnauthorizedError('Unauthorized: Invalid or expired token');
    }

    return payload;
};

/**
 * Look up a user and their agency by Clerk ID.
 * Throws ForbiddenError if user has no agency.
 *
 * @param {string} clerkUserId — Clerk sub claim
 * @returns {Object} — { user: User record, agencyId: string }
 * @throws {ForbiddenError} — If user not found or has no agency
 */
const getUser = async (clerkUserId) => {
    const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        include: { agency: true }
    });

    if (!user || !user.agencyId) {
        throw new ForbiddenError('User is not associated with an agency');
    }

    return { user, agencyId: user.agencyId };
};

/**
 * Express middleware: verify Clerk token + look up user + set req.user and req.agencyId.
 * Calls next() on success. Responds with error on failure (401/403/500).
 *
 * @param {Object} req — Express request
 * @param {Object} res — Express response
 * @param {Function} next — Express next middleware
 */
const requireAgency = async (req, res, next) => {
    try {
        const payload = await verifyClerkToken(req);
        const { user, agencyId } = await getUser(payload.sub);

        req.agencyId = agencyId;
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return res.status(401).json({ error: error.message });
        }
        if (error instanceof ForbiddenError) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error in requireAgency middleware:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Express middleware factory: assert user's role is in allowedRoles.
 * MUST be used AFTER requireAgency (depends on req.user being set).
 *
 * Allowed roles are case-sensitive UserRole enum values: OWNER, ADMIN, STAFF, VIEWER.
 *
 * @param {string[]} allowedRoles — Array of allowed role strings
 * @returns {Function} — Express middleware (req, res, next)
 *
 * @example
 * router.delete('/:id', requireAgency, requireRole(['OWNER', 'ADMIN']), deleteWorker);
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            // Defensive: should not reach here if requireAgency runs first
            return res.status(403).json({ error: 'Forbidden: user not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        }

        next();
    };
};

// ─── Exports ──────────────────────────────────────────────────────────────

module.exports = {
    verifyClerkToken,
    getUser,
    requireAgency,
    requireRole,
    UnauthorizedError,
    ForbiddenError
};
