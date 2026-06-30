/**
 * Worker self-service auth — real behavioural tests.
 *
 * Covers POST /worker-signin (OTP generation + anti-enumeration + email-failure
 * resilience), POST /worker/verify-code (valid / missing / unknown / wrong /
 * expired / used OTP), the JWT cookie, and workerAuthMiddleware.
 *
 * NOTE: the route reads JWT_SECRET at module load, so it must be set before the
 * route is required (below).
 */

process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

jest.mock('../../lib/prisma');
jest.mock('../../lib/nodemailer');

const prisma = require('../../lib/prisma');
const { sendWorkerOtpEmail } = require('../../lib/nodemailer');
const { handleWorkerSignin, handleVerifyCode, workerAuthMiddleware } = require('../../routes/worker-auth');

const WORKER = { id: 'w1', firstName: 'John', lastName: 'Doe', agencyId: 'a1', email: 'john@example.com' };

describe('Worker Authentication Flow', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        prisma.worker = { findFirst: jest.fn() };
        prisma.workerSession = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
        app.post('/worker-signin', handleWorkerSignin);
        app.post('/worker/verify-code', handleVerifyCode);
        app.get('/worker/me', workerAuthMiddleware, (req, res) => res.json({ worker: req.worker }));
    });

    describe('POST /worker-signin', () => {
        it('generates an OTP and emails it for a known worker (case-insensitive)', async () => {
            prisma.worker.findFirst.mockResolvedValue(WORKER);
            prisma.workerSession.create.mockResolvedValue({ id: 's1' });
            sendWorkerOtpEmail.mockResolvedValue();

            const res = await request(app).post('/worker-signin').send({ email: 'John@Example.com' });

            expect(res.status).toBe(200);
            expect(prisma.worker.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { email: 'john@example.com' } })
            );
            expect(prisma.workerSession.create).toHaveBeenCalled();
            expect(sendWorkerOtpEmail).toHaveBeenCalledWith('john@example.com', 'John', expect.stringMatching(/^\d{6}$/));
        });

        it('returns a generic 200 (anti-enumeration) and creates no OTP for an unknown email', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);

            const res = await request(app).post('/worker-signin').send({ email: 'nobody@example.com' });

            expect(res.status).toBe(200);
            expect(prisma.workerSession.create).not.toHaveBeenCalled();
            expect(sendWorkerOtpEmail).not.toHaveBeenCalled();
        });

        it('400s when email is missing', async () => {
            const res = await request(app).post('/worker-signin').send({});
            expect(res.status).toBe(400);
        });

        it('still returns 200 when the OTP email fails (OTP already stored)', async () => {
            prisma.worker.findFirst.mockResolvedValue(WORKER);
            prisma.workerSession.create.mockResolvedValue({ id: 's1' });
            sendWorkerOtpEmail.mockRejectedValue(new Error('smtp down'));

            const res = await request(app).post('/worker-signin').send({ email: 'john@example.com' });

            expect(res.status).toBe(200);
            expect(prisma.workerSession.create).toHaveBeenCalled();
        });
    });

    describe('POST /worker/verify-code', () => {
        it('issues an HTTP-only JWT cookie for a valid OTP and marks the session used', async () => {
            prisma.worker.findFirst.mockResolvedValue(WORKER);
            prisma.workerSession.findFirst.mockResolvedValue({
                id: 's1',
                isUsed: false,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            });
            prisma.workerSession.update.mockResolvedValue({});

            const res = await request(app).post('/worker/verify-code').send({ email: 'john@example.com', otp: '123456' });

            expect(res.status).toBe(200);
            expect(prisma.workerSession.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { isUsed: true } });
            const setCookie = (res.headers['set-cookie'] || []).join(';');
            expect(setCookie).toMatch(/worker_token=/);
            expect(setCookie).toMatch(/HttpOnly/i);
        });

        it('400s when email or otp is missing', async () => {
            const res = await request(app).post('/worker/verify-code').send({ email: 'john@example.com' });
            expect(res.status).toBe(400);
        });

        it('401s for an unknown worker', async () => {
            prisma.worker.findFirst.mockResolvedValue(null);
            const res = await request(app).post('/worker/verify-code').send({ email: 'x@example.com', otp: '123456' });
            expect(res.status).toBe(401);
        });

        it('401s when no session matches (wrong OTP)', async () => {
            prisma.worker.findFirst.mockResolvedValue(WORKER);
            prisma.workerSession.findFirst.mockResolvedValue(null);
            const res = await request(app).post('/worker/verify-code').send({ email: 'john@example.com', otp: '000000' });
            expect(res.status).toBe(401);
        });

        it('401s when the OTP has expired', async () => {
            prisma.worker.findFirst.mockResolvedValue(WORKER);
            prisma.workerSession.findFirst.mockResolvedValue({
                id: 's1',
                isUsed: false,
                expiresAt: new Date(Date.now() - 60 * 1000),
            });
            const res = await request(app).post('/worker/verify-code').send({ email: 'john@example.com', otp: '123456' });
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/expired/i);
        });

        it('401s when the OTP was already used', async () => {
            prisma.worker.findFirst.mockResolvedValue(WORKER);
            prisma.workerSession.findFirst.mockResolvedValue({
                id: 's1',
                isUsed: true,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            });
            const res = await request(app).post('/worker/verify-code').send({ email: 'john@example.com', otp: '123456' });
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/already used/i);
        });
    });

    describe('workerAuthMiddleware', () => {
        it('401s without a token', async () => {
            const res = await request(app).get('/worker/me');
            expect(res.status).toBe(401);
        });

        it('accepts a valid worker_token cookie and attaches worker context', async () => {
            const token = jwt.sign({ workerId: 'w1', agencyId: 'a1' }, 'test-secret', { expiresIn: '7d' });
            const res = await request(app).get('/worker/me').set('Cookie', `worker_token=${token}`);
            expect(res.status).toBe(200);
            expect(res.body.worker).toEqual({ id: 'w1', agencyId: 'a1' });
        });

        it('401s for an invalid token', async () => {
            const res = await request(app).get('/worker/me').set('Cookie', 'worker_token=garbage');
            expect(res.status).toBe(401);
        });
    });
});
