/**
 * Unit tests for canonical auth module
 *
 * Tests the four Pattern A exports:
 * - verifyClerkToken(req) — JWT verification + error handling
 * - getUser(clerkUserId) — User + agency lookup
 * - requireAgency(req, res, next) — Express middleware composition
 * - requireRole(allowedRoles) — Role-based access control middleware
 */

const {
    verifyClerkToken,
    getUser,
    requireAgency,
    requireRole,
    UnauthorizedError,
    ForbiddenError
} = require('../../lib/auth');

// Mock dependencies
jest.mock('@clerk/backend');
jest.mock('../../lib/prisma');

const { verifyToken } = require('@clerk/backend');
const prisma = require('../../lib/prisma');

describe('Auth Module (Pattern A)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CLERK_SECRET_KEY = 'test_secret_key';
        process.env.AUTHORIZED_PARTY = 'http://localhost:3000';
    });

    // ─── verifyClerkToken Tests ─────────────────────────────────────────

    describe('verifyClerkToken', () => {
        it('should verify valid token and return payload', async () => {
            const mockPayload = { sub: 'clerk_user_123' };
            verifyToken.mockResolvedValue(mockPayload);

            const req = {
                headers: { authorization: 'Bearer valid_token_here' }
            };

            const result = await verifyClerkToken(req);
            expect(result).toEqual(mockPayload);
            expect(verifyToken).toHaveBeenCalledWith(
                'valid_token_here',
                expect.objectContaining({
                    secretKey: 'test_secret_key',
                    clockSkewInMs: 300000
                })
            );
        });

        it('should throw UnauthorizedError on missing Authorization header', async () => {
            const req = { headers: {} };

            await expect(verifyClerkToken(req))
                .rejects
                .toThrow(UnauthorizedError);
        });

        it('should throw UnauthorizedError on malformed Bearer token', async () => {
            const req = {
                headers: { authorization: 'Basic malformed' }
            };

            await expect(verifyClerkToken(req))
                .rejects
                .toThrow(UnauthorizedError);
        });

        it('should throw UnauthorizedError on invalid token', async () => {
            verifyToken.mockRejectedValue(new Error('Invalid token'));

            const req = {
                headers: { authorization: 'Bearer invalid_token' }
            };

            await expect(verifyClerkToken(req))
                .rejects
                .toThrow(UnauthorizedError);
        });

        it('should throw Error when CLERK_SECRET_KEY is missing', async () => {
            delete process.env.CLERK_SECRET_KEY;

            const req = {
                headers: { authorization: 'Bearer valid_token' }
            };

            await expect(verifyClerkToken(req))
                .rejects
                .toThrow();
        });
    });

    // ─── getUser Tests ──────────────────────────────────────────────────

    describe('getUser', () => {
        it('should return user and agencyId on success', async () => {
            const mockUser = {
                clerkId: 'clerk_user_123',
                id: 'user_456',
                role: 'OWNER',
                agencyId: 'agency_789'
            };
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await getUser('clerk_user_123');
            expect(result).toEqual({
                user: mockUser,
                agencyId: 'agency_789'
            });
        });

        it('should throw ForbiddenError when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(getUser('nonexistent_user'))
                .rejects
                .toThrow(ForbiddenError);
        });

        it('should throw ForbiddenError when user has no agencyId', async () => {
            const mockUser = {
                clerkId: 'clerk_user_123',
                id: 'user_456',
                agencyId: null
            };
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(getUser('clerk_user_123'))
                .rejects
                .toThrow(ForbiddenError);
        });
    });

    // ─── requireRole Tests ──────────────────────────────────────────────

    describe('requireRole', () => {
        it('should call next() when user role is in allowedRoles', () => {
            const middleware = requireRole(['OWNER', 'ADMIN']);
            const req = {
                user: { role: 'OWNER', id: 'user_123' }
            };
            const res = {};
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should return 403 when user role is not in allowedRoles', () => {
            const middleware = requireRole(['OWNER', 'ADMIN']);
            const req = {
                user: { role: 'VIEWER', id: 'user_456' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Forbidden: insufficient role'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow multiple valid roles', () => {
            const middleware = requireRole(['OWNER', 'ADMIN']);
            const req = {
                user: { role: 'ADMIN', id: 'user_789' }
            };
            const res = {};
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should return 403 when req.user is missing', () => {
            const middleware = requireRole(['OWNER']);
            const req = { /* no user */ };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject STAFF on destructive endpoints', () => {
            const middleware = requireRole(['OWNER', 'ADMIN']);
            const req = {
                user: { role: 'STAFF', id: 'user_staff' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject VIEWER on destructive endpoints', () => {
            const middleware = requireRole(['OWNER', 'ADMIN']);
            const req = {
                user: { role: 'VIEWER', id: 'user_viewer' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    // ─── requireAgency Tests ────────────────────────────────────────────

    describe('requireAgency', () => {
        it('should set req.user and req.agencyId on success', async () => {
            const mockPayload = { sub: 'clerk_user_123' };
            const mockUser = {
                id: 'user_456',
                role: 'OWNER',
                agencyId: 'agency_789'
            };

            verifyToken.mockResolvedValue(mockPayload);
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const req = {
                headers: { authorization: 'Bearer valid_token' }
            };
            const res = {};
            const next = jest.fn();

            await requireAgency(req, res, next);

            expect(req.user).toEqual(mockUser);
            expect(req.agencyId).toBe('agency_789');
            expect(next).toHaveBeenCalled();
        });

        it('should return 401 on token verification failure', async () => {
            verifyToken.mockRejectedValue(new Error('Invalid token'));

            const req = {
                headers: { authorization: 'Bearer invalid_token' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await requireAgency(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 when user has no agency', async () => {
            const mockPayload = { sub: 'clerk_user_123' };
            verifyToken.mockResolvedValue(mockPayload);
            prisma.user.findUnique.mockResolvedValue(null);

            const req = {
                headers: { authorization: 'Bearer valid_token' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await requireAgency(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 500 on unexpected error', async () => {
            // Mock prisma.user.findUnique to throw an unexpected error
            prisma.user.findUnique.mockImplementation(() => {
                throw new Error('Database connection error');
            });

            const mockPayload = { sub: 'clerk_user_123' };
            verifyToken.mockResolvedValue(mockPayload);

            const req = {
                headers: { authorization: 'Bearer valid_token' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await requireAgency(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(next).not.toHaveBeenCalled();
        });
    });

    // ─── Error Classes ──────────────────────────────────────────────────

    describe('Error classes', () => {
        it('should create UnauthorizedError with 401 status', () => {
            const error = new UnauthorizedError('test message');
            expect(error.message).toBe('test message');
            expect(error.status).toBe(401);
            expect(error.name).toBe('UnauthorizedError');
        });

        it('should create ForbiddenError with 403 status', () => {
            const error = new ForbiddenError('test message');
            expect(error.message).toBe('test message');
            expect(error.status).toBe(403);
            expect(error.name).toBe('ForbiddenError');
        });
    });
});
