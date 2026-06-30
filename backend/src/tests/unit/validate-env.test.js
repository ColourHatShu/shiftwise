const { getEnvErrors } = require('../../lib/validate-env');

describe('getEnvErrors', () => {
    it('flags a missing DATABASE_URL (always required)', () => {
        const { errors } = getEnvErrors({ NODE_ENV: 'development' });
        expect(errors.some((e) => /DATABASE_URL/.test(e))).toBe(true);
    });

    it('dev: missing Clerk/JWT are warnings, not fatal errors', () => {
        const { errors, warnings } = getEnvErrors({ NODE_ENV: 'development', DATABASE_URL: 'postgres://x' });
        expect(errors).toHaveLength(0);
        expect(warnings.some((w) => /CLERK_SECRET_KEY/.test(w))).toBe(true);
        expect(warnings.some((w) => /JWT_SECRET/.test(w))).toBe(true);
    });

    it('production: requires JWT_SECRET and CLERK_SECRET_KEY', () => {
        const { errors } = getEnvErrors({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' });
        expect(errors.some((e) => /JWT_SECRET/.test(e))).toBe(true);
        expect(errors.some((e) => /CLERK_SECRET_KEY/.test(e))).toBe(true);
    });

    it('production: rejects the insecure dev fallback JWT secret', () => {
        const { errors } = getEnvErrors({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgres://x',
            JWT_SECRET: 'fallback-dev-secret',
            CLERK_SECRET_KEY: 'sk_live_x',
        });
        expect(errors.some((e) => /JWT_SECRET/.test(e))).toBe(true);
    });

    it('production with everything set: no errors', () => {
        const { errors, warnings } = getEnvErrors({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgres://x',
            JWT_SECRET: 'a-strong-secret',
            CLERK_SECRET_KEY: 'sk_live_x',
        });
        expect(errors).toHaveLength(0);
        expect(warnings).toHaveLength(0);
    });
});
