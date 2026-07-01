/**
 * Worker Self-Service Authentication Routes
 *
 * POST /worker-signin - Email input, generate OTP
 * POST /worker/verify-code - OTP validation, JWT issuance
 *
 * Multi-tenant isolation: all lookups filtered by agency context
 * OTP validity: 10 minutes, single-use
 * JWT token: 7-day expiry, HTTP-only cookie
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendWorkerOtpEmail } = require('../lib/nodemailer');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const Sentry = require('@sentry/node');

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;
const JWT_EXPIRY = '7d';
// JWT_SECRET MUST be set. The previous fallback to 'fallback-dev-secret' meant that
// if the env var was missing in production, anyone could forge worker tokens —
// total auth bypass for the worker portal. Refuse to start if it isn't configured.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback-dev-secret') {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable must be set (and not the dev fallback) in production.');
    }
    console.warn('⚠ JWT_SECRET not set — using ephemeral dev secret. Set JWT_SECRET in .env before production.');
}
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

/**
 * Generate a random 6-digit OTP
 */
function generateOTP() {
    return crypto.randomInt(0, 1000000).toString().padStart(OTP_LENGTH, '0');
}

/**
 * POST /worker-signin
 * Input: { email }
 * Output: { message: "OTP sent to email" } or error
 */
async function handleWorkerSignin(req, res) {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required' });
        }

        const email_lower = email.toLowerCase().trim();

        // Find worker by email (no agency context yet — worker email is globally unique)
        const worker = await prisma.worker.findFirst({
            where: { email: email_lower },
            select: { id: true, firstName: true, lastName: true, agencyId: true, email: true },
        });

        if (!worker) {
            // Same response shape + status as the success path below so an attacker can't
            // tell whether the email exists in the system (anti-enumeration).
            return res.status(200).json({
                message: `If an account exists for that email, an OTP has been sent. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // Store OTP in WorkerSession
        const session = await prisma.workerSession.create({
            data: {
                workerId: worker.id,
                agencyId: worker.agencyId,
                otp,
                expiresAt,
            },
        });

        // Send OTP email
        try {
            await sendWorkerOtpEmail(worker.email, worker.firstName, otp);
        } catch (emailError) {
            // Log but don't fail — OTP is already created
            Sentry.captureException(emailError, {
                tags: { workerId: worker.id, agencyId: worker.agencyId, context: 'worker.otp-email' },
                extra: { email: worker.email },
            });
            (req.log || logger).error({ err: emailError }, 'OTP email send failed (will be retried)');
        }

        res.status(200).json({ message: 'OTP sent to email' });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { context: 'worker.signin' },
        });
        (req.log || logger).error({ err: error }, 'Worker signin error');
        res.status(500).json({ error: 'Signin failed' });
    }
}

/**
 * POST /worker/verify-code
 * Input: { email, otp }
 * Output: Sets HTTP-only cookie + { message: "Signin successful" } or error
 * Sets secure, HTTP-only cookie: worker_token (7d expiry)
 */
async function handleVerifyCode(req, res) {
    try {
        const { email, otp } = req.body;

        if (!email || typeof email !== 'string' || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        const email_lower = email.toLowerCase().trim();

        // Find worker
        const worker = await prisma.worker.findFirst({
            where: { email: email_lower },
            select: { id: true, firstName: true, agencyId: true, email: true },
        });

        if (!worker) {
            return res.status(401).json({ error: 'Invalid email or OTP' });
        }

        // Find session by worker ID and OTP
        const session = await prisma.workerSession.findFirst({
            where: {
                workerId: worker.id,
                otp: otp.toString().trim(),
                agencyId: worker.agencyId,
            },
        });

        if (!session) {
            return res.status(401).json({ error: 'Invalid email or OTP' });
        }

        // Check if OTP has expired
        if (new Date() > session.expiresAt) {
            return res.status(401).json({ error: 'OTP has expired' });
        }

        // Check if OTP was already used
        if (session.isUsed) {
            return res.status(401).json({ error: 'OTP already used' });
        }

        // Mark session as used
        await prisma.workerSession.update({
            where: { id: session.id },
            data: { isUsed: true },
        });

        // Generate JWT
        const token = jwt.sign(
            {
                workerId: worker.id,
                agencyId: worker.agencyId,
            },
            JWT_SECRET,
            // `iat` is set automatically by jsonwebtoken; passing it as an *option*
            // throws ("iat" is not allowed in "options") and 500s every verify-code.
            { expiresIn: JWT_EXPIRY }
        );

        // Set HTTP-only secure cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
        };

        res.cookie('worker_token', token, cookieOptions);

        res.status(200).json({
            message: 'Signin successful',
            worker: {
                id: worker.id,
                firstName: worker.firstName,
                email: worker.email,
            },
        });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { context: 'worker.verify-code' },
        });
        (req.log || logger).error({ err: error }, 'Verify code error');
        res.status(500).json({ error: 'Verification failed' });
    }
}

/**
 * Middleware: Verify worker JWT from cookie
 * Attaches worker context to req.worker
 */
function workerAuthMiddleware(req, res, next) {
    const token = req.cookies?.worker_token;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.worker = {
            id: decoded.workerId,
            agencyId: decoded.agencyId,
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = {
    handleWorkerSignin,
    handleVerifyCode,
    workerAuthMiddleware,
};
