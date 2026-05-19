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
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({
                request: true,
                serverName: true,
                transaction: true
            }),
            new Sentry.Integrations.OnUncaughtException(),
            new Sentry.Integrations.OnUnhandledRejection()
        ]
    });
    console.log('✅ Sentry initialized for backend');
} else {
    console.log('ℹ️ SENTRY_DSN_BACKEND not set; Sentry disabled (no-op)');
}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());

// Sentry request handler middleware (must be early)
if (SENTRY_DSN) {
    app.use(Sentry.Handlers.requestHandler());
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
initCronJobs();

// ─── Routes ──────────────────────────────────────────────────────────────────
const workersRouter = require('./routes/workers');
app.use('/api/workers', workersRouter);

const workerAvailabilityRouter = require('./routes/worker-availability');
app.use('/api/workers/:workerId/availability', workerAvailabilityRouter);

const agenciesRouter = require('./routes/agencies');
app.use('/api/agencies', agenciesRouter);

const dashboardRouter = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRouter);

const documentsRouter = require('./routes/documents');
app.use('/api/documents', documentsRouter);

const alertsRouter = require('./routes/alerts');
app.use('/api/alerts', alertsRouter);

const reportsRouter = require('./routes/reports');
app.use('/api/reports', reportsRouter);

const auditLogRouter = require('./routes/audit-log');
app.use('/api/audit-log', auditLogRouter);

const shiftsRouter = require('./routes/shifts');
app.use('/api/shifts', shiftsRouter);

const shiftAssignmentsRouter = require('./routes/shift-assignments');
// Mount shift-assignments router with :shiftId param for Phase 8 endpoints
// Routes within the router use paths like /assign-bulk, /assignable-workers, etc.
// They're accessed as /api/shifts/:shiftId/assign-bulk, etc.
app.use('/api/shifts/:shiftId', shiftAssignmentsRouter);

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

// Worker self-service routes (auth + documents)
const { handleWorkerSignin, handleVerifyCode, workerAuthMiddleware } = require('./routes/worker-auth');
const { getWorkerDocuments, uploadWorkerDocument, getDocumentTypes } = require('./routes/worker-documents');

app.post('/worker-signin', handleWorkerSignin);
app.post('/worker/verify-code', handleVerifyCode);
app.get('/worker/documents', workerAuthMiddleware, getWorkerDocuments);
app.get('/worker/document-types', workerAuthMiddleware, getDocumentTypes);
app.post('/worker/documents/upload', workerAuthMiddleware, upload.single('file'), uploadWorkerDocument);

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

// Sentry error handler middleware (must be after all other middleware/routes)
if (SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
}

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);

    // Log to Sentry if initialized
    if (SENTRY_DSN) {
        Sentry.captureException(err, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId
            }
        });
    }

    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
    try {
        // Check required env vars
        if (!process.env.CLERK_SECRET_KEY) {
            console.error('❌ CLERK_SECRET_KEY is not set! Auth will not work.');
        } else {
            console.log('✅ Clerk secret key loaded:', process.env.CLERK_SECRET_KEY.slice(0, 12) + '...');
        }

        await prisma.$connect();
        console.log('✅ Database connected');
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
