/**
 * RBAC Integration Tests
 *
 * Tests role-based access control on destructive endpoints:
 * - VIEWER and STAFF should get 403 on delete/deactivate/approve/reject/agency-update
 * - OWNER and ADMIN should succeed (2xx)
 */

const request = require('supertest');
const express = require('express');
const prisma = require('../../lib/prisma');

// Mock Prisma to avoid DB dependencies in this basic test
jest.mock('../../lib/prisma');

describe('RBAC Enforcement (Destructive Endpoints)', () => {
    let server;
    let mockVerifyToken;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create a fresh app for each test
        const app = express();
        app.use(express.json());

        // Simple auth middleware that sets req.user
        app.use((req, res, next) => {
            // For test purposes, get role from header
            const role = req.headers['x-test-role'] || 'VIEWER';
            req.user = {
                id: 'test-user-123',
                role: role,
                clerkId: 'clerk_123'
            };
            req.agencyId = 'agency-123';
            next();
        });

        // Load test routes
        const { requireRole } = require('../../lib/auth');

        // Test route: DELETE /api/workers/:id (destructive)
        app.delete('/api/workers/:id', requireRole(['OWNER', 'ADMIN']), (req, res) => {
            res.json({ message: 'Worker deleted' });
        });

        // Test route: PATCH /api/workers/:id/deactivate (destructive)
        app.patch('/api/workers/:id/deactivate', requireRole(['OWNER', 'ADMIN']), (req, res) => {
            res.json({ message: 'Worker deactivated' });
        });

        // Test route: PATCH /api/documents/:id/verify (approve/reject, destructive)
        app.patch('/api/documents/:id/verify', requireRole(['OWNER', 'ADMIN']), (req, res) => {
            res.json({ message: 'Document verified' });
        });

        // Test route: PATCH /api/agencies/update (agency settings, destructive)
        app.patch('/api/agencies/update', requireRole(['OWNER', 'ADMIN']), (req, res) => {
            res.json({ message: 'Agency updated' });
        });

        // Test route: GET /api/workers (read, non-destructive)
        app.get('/api/workers', (req, res) => {
            res.json({ data: [] });
        });

        server = app;
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('DELETE /api/workers/:id (destructive)', () => {
        it('should reject VIEWER with 403', async () => {
            const res = await request(server)
                .delete('/api/workers/worker-123')
                .set('x-test-role', 'VIEWER');

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('insufficient role');
        });

        it('should reject STAFF with 403', async () => {
            const res = await request(server)
                .delete('/api/workers/worker-123')
                .set('x-test-role', 'STAFF');

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('insufficient role');
        });

        it('should allow OWNER with 2xx', async () => {
            const res = await request(server)
                .delete('/api/workers/worker-123')
                .set('x-test-role', 'OWNER');

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Worker deleted');
        });

        it('should allow ADMIN with 2xx', async () => {
            const res = await request(server)
                .delete('/api/workers/worker-123')
                .set('x-test-role', 'ADMIN');

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Worker deleted');
        });
    });

    describe('PATCH /api/workers/:id/deactivate (destructive)', () => {
        it('should reject VIEWER with 403', async () => {
            const res = await request(server)
                .patch('/api/workers/worker-123/deactivate')
                .set('x-test-role', 'VIEWER');

            expect(res.status).toBe(403);
        });

        it('should reject STAFF with 403', async () => {
            const res = await request(server)
                .patch('/api/workers/worker-123/deactivate')
                .set('x-test-role', 'STAFF');

            expect(res.status).toBe(403);
        });

        it('should allow OWNER with 2xx', async () => {
            const res = await request(server)
                .patch('/api/workers/worker-123/deactivate')
                .set('x-test-role', 'OWNER');

            expect(res.status).toBe(200);
        });

        it('should allow ADMIN with 2xx', async () => {
            const res = await request(server)
                .patch('/api/workers/worker-123/deactivate')
                .set('x-test-role', 'ADMIN');

            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/documents/:id/verify (approve/reject, destructive)', () => {
        it('should reject VIEWER with 403', async () => {
            const res = await request(server)
                .patch('/api/documents/doc-123/verify')
                .set('x-test-role', 'VIEWER')
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(403);
        });

        it('should reject STAFF with 403', async () => {
            const res = await request(server)
                .patch('/api/documents/doc-123/verify')
                .set('x-test-role', 'STAFF')
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(403);
        });

        it('should allow OWNER with 2xx', async () => {
            const res = await request(server)
                .patch('/api/documents/doc-123/verify')
                .set('x-test-role', 'OWNER')
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(200);
        });

        it('should allow ADMIN with 2xx', async () => {
            const res = await request(server)
                .patch('/api/documents/doc-123/verify')
                .set('x-test-role', 'ADMIN')
                .send({ status: 'APPROVED' });

            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/agencies/update (agency settings, destructive)', () => {
        it('should reject VIEWER with 403', async () => {
            const res = await request(server)
                .patch('/api/agencies/update')
                .set('x-test-role', 'VIEWER')
                .send({ name: 'New Name' });

            expect(res.status).toBe(403);
        });

        it('should reject STAFF with 403', async () => {
            const res = await request(server)
                .patch('/api/agencies/update')
                .set('x-test-role', 'STAFF')
                .send({ name: 'New Name' });

            expect(res.status).toBe(403);
        });

        it('should allow OWNER with 2xx', async () => {
            const res = await request(server)
                .patch('/api/agencies/update')
                .set('x-test-role', 'OWNER')
                .send({ name: 'New Name' });

            expect(res.status).toBe(200);
        });

        it('should allow ADMIN with 2xx', async () => {
            const res = await request(server)
                .patch('/api/agencies/update')
                .set('x-test-role', 'ADMIN')
                .send({ name: 'New Name' });

            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/workers (read, non-destructive)', () => {
        it('should allow VIEWER', async () => {
            const res = await request(server)
                .get('/api/workers')
                .set('x-test-role', 'VIEWER');

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        it('should allow STAFF', async () => {
            const res = await request(server)
                .get('/api/workers')
                .set('x-test-role', 'STAFF');

            expect(res.status).toBe(200);
        });

        it('should allow OWNER', async () => {
            const res = await request(server)
                .get('/api/workers')
                .set('x-test-role', 'OWNER');

            expect(res.status).toBe(200);
        });

        it('should allow ADMIN', async () => {
            const res = await request(server)
                .get('/api/workers')
                .set('x-test-role', 'ADMIN');

            expect(res.status).toBe(200);
        });
    });
});
