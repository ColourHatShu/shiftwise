require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./lib/prisma');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth is handled per-route via verifyToken in workers.js

// ─── Routes ──────────────────────────────────────────────────────────────────
const workersRouter = require('./routes/workers');
app.use('/api/workers', workersRouter);

const agenciesRouter = require('./routes/agencies');
app.use('/api/agencies', agenciesRouter);

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

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
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
