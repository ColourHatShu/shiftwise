/**
 * Pure startup environment validation.
 *
 * Returns { errors, warnings } (arrays of human-readable strings) for the
 * critical configuration the API needs. Side-effect-free so it can be unit
 * tested; `server.js` decides whether to exit on errors. Empty errors = OK.
 *
 *   errors   → fatal: the server should refuse to start.
 *   warnings → non-fatal: log and continue (acceptable in local dev).
 */
function getEnvErrors(env = process.env) {
    const errors = [];
    const warnings = [];
    const isProd = env.NODE_ENV === 'production';

    // Always required — without it Prisma cannot connect at all.
    if (!env.DATABASE_URL) {
        errors.push('DATABASE_URL is required (Postgres connection string).');
    }

    if (isProd) {
        // Secrets that MUST be real in production.
        if (!env.JWT_SECRET || env.JWT_SECRET === 'fallback-dev-secret') {
            errors.push('JWT_SECRET must be set to a strong secret in production (worker auth).');
        }
        if (!env.CLERK_SECRET_KEY) {
            errors.push('CLERK_SECRET_KEY is required in production (coordinator auth).');
        }
    } else {
        // Dev has safe fallbacks, but warn so the gap is visible.
        if (!env.CLERK_SECRET_KEY) {
            warnings.push('CLERK_SECRET_KEY not set — coordinator auth will not work locally.');
        }
        if (!env.JWT_SECRET) {
            warnings.push('JWT_SECRET not set — using an ephemeral dev secret for worker auth.');
        }
    }

    return { errors, warnings };
}

module.exports = { getEnvErrors };
