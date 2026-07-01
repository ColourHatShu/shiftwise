require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const Sentry = require('@sentry/node');
const prisma = require('./lib/prisma');
const { getEnvErrors } = require('./lib/validate-env');
const logger = require('./lib/logger');
const { initCronJobs, checkExpiriesAndAlert } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Sentry Initialization ───────────────────────────────────────────────────
const SENTRY_DSN = process.env.SENTRY_DSN_BACKEND;
if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
        // @sentry/node v8+: the HTTP, Express, uncaught-exception and
        // unhandled-rejection integrations are enabled by default — no manual
        // `new Sentry.Integrations.*` array (that v7 API was removed in v8).
    });
    console.log('✅ Sentry initialized for backend');
} else {
    console.log('ℹ️ SENTRY_DSN_BACKEND not set; Sentry disabled (no-op)');
}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());

// Request-ID middleware — attaches a stable correlation ID to every request so logs
// and Sentry exceptions can be tied back to a single user action. Forwarded via the
// X-Request-Id response header so a frontend session can quote it in bug reports.
app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    // Per-request structured logger — every line carries the correlation id.
    req.log = logger.child({ requestId: req.requestId });
    next();
});

// Tag every Sentry event in a request with the correlation ID, so ALL events
// (not just the manually-captured exception) carry it. v8+ isolates the Sentry
// scope per request automatically via the default HTTP integration, so a plain
// middleware tagging the current scope applies to just this request.
if (SENTRY_DSN) {
    app.use((req, res, next) => {
        Sentry.setTag('requestId', req.requestId);
        next();
    });
}

// General rate limiting - 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiting for auth-related routes - 20 requests per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    exposedHeaders: ['Content-Disposition'],
    credentials: true, // Allow cookies in CORS
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies for JWT token

// Configure multer for file uploads (max 10 MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// SECURITY: /uploads is intentionally NOT exposed as a public static route.
// Files are served via GET /api/documents/:id/download with auth + agency-scope enforcement.
// Any attempt to access /uploads/<filename> will result in a 404.

// Apply stricter rate limiting to auth-related routes
app.use('/api/workers', authLimiter);
app.use('/api/agencies', authLimiter);
app.use('/api/documents', authLimiter);

// ─── Cron Scheduler ────────────────────────────────────────────────────────────
// NOTE: initCronJobs() is invoked inside startServer() AFTER prisma.$connect()
// to prevent jobs from firing before the DB connection is ready (#test-report-2026-05-26).

// ─── Routes ──────────────────────────────────────────────────────────────────
// Mounted before the generic /api/workers router so /api/workers/bulk/* isn't
// captured by a /:id route.
const workersBulkRouter = require('./routes/workers-bulk');
app.use('/api/workers/bulk', workersBulkRouter);

const workersRouter = require('./routes/workers');
app.use('/api/workers', workersRouter);

const workerScorecardsRouter = require('./routes/worker-scorecards');
app.use('/api/worker-scorecards', workerScorecardsRouter);

const workerAvailabilityRouter = require('./routes/worker-availability');
app.use('/api/workers/:workerId/availability', workerAvailabilityRouter);

const agenciesRouter = require('./routes/agencies');
app.use('/api/agencies', agenciesRouter);

const dashboardRouter = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRouter);

const documentsRouter = require('./routes/documents');
app.use('/api/documents', documentsRouter);

const documentTypesRouter = require('./routes/document-types');
app.use('/api/document-types', documentTypesRouter);

const expiringDocumentsRouter = require('./routes/expiring-documents');
app.use('/api/expiring-documents', expiringDocumentsRouter);

const alertsRouter = require('./routes/alerts');
app.use('/api/alerts', alertsRouter);

const reportsRouter = require('./routes/reports');
app.use('/api/reports', reportsRouter);

const auditLogRouter = require('./routes/audit-log');
app.use('/api/audit-log', auditLogRouter);

const shiftsRouter = require('./routes/shifts');
app.use('/api/shifts', shiftsRouter);

const shiftCoverageRouter = require('./routes/shift-coverage');
app.use('/api/shift-coverage', shiftCoverageRouter);

const shiftAssignmentsRouter = require('./routes/shift-assignments');
// Mount shift-assignments router with :shiftId param for Phase 8 endpoints
// Routes within the router use paths like /assign-bulk, /assignable-workers, etc.
// They're accessed as /api/shifts/:shiftId/assign-bulk, etc.
app.use('/api/shifts/:shiftId', shiftAssignmentsRouter);

const shiftRequirementsRouter = require('./routes/shift-requirements');
app.use('/api/shift-requirements', shiftRequirementsRouter);

const shiftTemplatesRouter = require('./routes/shift-templates');
app.use('/api/shift-templates', shiftTemplatesRouter);

const shiftsBulkRouter = require('./routes/shifts-bulk');
app.use('/api/shifts/bulk', shiftsBulkRouter);

const shiftsAnalyticsRouter = require('./routes/shifts-analytics');
app.use('/api/shifts/analytics', shiftsAnalyticsRouter);

const auditPackRouter = require('./routes/audit-pack');
app.use('/api/agency/audit-pack', auditPackRouter);

const complianceRouter = require('./routes/compliance');
app.use('/api/agency/compliance', complianceRouter);

const complianceChecklistRouter = require('./routes/compliance-checklist');
app.use('/api/agency/compliance', complianceChecklistRouter);

// Worker self-service routes (auth + documents + assignments)
const { handleWorkerSignin, handleVerifyCode, workerAuthMiddleware } = require('./routes/worker-auth');
const { getWorkerDocuments, uploadWorkerDocument, getDocumentTypes } = require('./routes/worker-documents');
const workerAssignmentsRouter = require('./routes/worker-assignments');

// Strict per-IP rate limit on worker OTP endpoints to block enumeration + brute force.
// 10 attempts / 15 min is generous for a real worker but ruinous for an attacker.
const workerOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});
app.post('/worker-signin', workerOtpLimiter, handleWorkerSignin);
app.post('/worker/verify-code', workerOtpLimiter, handleVerifyCode);
app.get('/worker/documents', workerAuthMiddleware, getWorkerDocuments);
app.get('/worker/document-types', workerAuthMiddleware, getDocumentTypes);
app.post('/worker/documents/upload', workerAuthMiddleware, upload.single('file'), uploadWorkerDocument);
app.use('/api/worker-assignments', workerAssignmentsRouter);

// Health Check
app.get('/api/health', async (req, res) => {
    try {
        // Ping the database
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({
            status: 'ok',
            service: 'ShiftWise API',
            timestamp: new Date().toISOString(),
            database: 'connected',
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            service: 'ShiftWise API',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            message: error.message,
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler — never leak err.message in production responses (it can contain
// Prisma error text, file paths, stack snippets). Keep details server-side / in Sentry.
app.use((err, req, res, next) => {
    const requestId = req.requestId || 'unknown';
    // Structured, correlated error log (falls back to the base logger if the
    // request-scoped child wasn't attached, e.g. very early failures).
    (req.log || logger).error({ err, userId: req.user?.id, agencyId: req.agencyId }, 'Unhandled request error');

    if (SENTRY_DSN) {
        Sentry.captureException(err, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                requestId,
            },
        });
    }

    const body = { error: 'Internal server error', requestId };
    if (process.env.NODE_ENV !== 'production') {
        body.message = err.message;
    }
    res.status(err.status || 500).json(body);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
    try {
        // Fail fast on missing/invalid critical config (clear message > a late,
        // cryptic crash on first use).
        const { errors, warnings } = getEnvErrors();
        warnings.forEach((w) => console.warn('⚠ ' + w));
        if (errors.length > 0) {
            console.error('❌ Invalid environment configuration:\n  - ' + errors.join('\n  - '));
            console.error('   Set the missing variables (see backend/.env) and restart.');
            process.exit(1);
        }
        console.log('✅ Environment validated');

        await prisma.$connect();
        console.log('✅ Database connected');
        // Register cron jobs only AFTER the DB is up so early ticks have a live connection.
        initCronJobs();
        console.log('✅ Cron jobs registered');
        app.listen(PORT, () => {
            console.log(`🚀 ShiftWise API running at http://localhost:${PORT}`);
            console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('❌ Failed to connect to database:', error.message);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
