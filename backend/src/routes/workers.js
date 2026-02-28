const express = require('express');
const { verifyToken } = require('@clerk/backend');
const prisma = require('../lib/prisma');

const router = express.Router();

// ─── Auth + Agency middleware ─────────────────────────────────────────────────
// Manually extracts and verifies the Clerk JWT from the Authorization header,
// then looks up the user's associated agency in the DB.
const requireAgency = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const secretKey = process.env.CLERK_SECRET_KEY;

        if (!secretKey) {
            console.error('❌ CLERK_SECRET_KEY is not set!');
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        let payload;
        try {
            payload = await verifyToken(token, {
                secretKey,
                authorizedParties: ['http://localhost:3000'],
                clockSkewInMs: 300000  // 5 min tolerance for clock skew
            });
        } catch (err) {
            console.error('❌ Token verification failed:', err.message);
            return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        }

        const clerkUserId = payload.sub;

        // Look up the user + their agency
        const user = await prisma.user.findUnique({
            where: { clerkId: clerkUserId },
            include: { agency: true }
        });

        if (!user || !user.agencyId) {
            return res.status(403).json({ error: 'User is not associated with an agency' });
        }

        req.agencyId = user.agencyId;
        req.user = user;
        next();
    } catch (error) {
        console.error('Error in requireAgency middleware:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── GET /api/workers ─────────────────────────────────────────────────────────
router.get('/', requireAgency, async (req, res) => {
    try {
        const workers = await prisma.worker.findMany({
            where: { agencyId: req.agencyId },
            orderBy: { firstName: 'asc' }
        });
        res.json({ data: workers });
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
});

// ─── GET /api/workers/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAgency, async (req, res) => {
    try {
        const { id } = req.params;
        const worker = await prisma.worker.findFirst({
            where: { id, agencyId: req.agencyId }
        });

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        res.json({ data: worker });
    } catch (error) {
        console.error('Error fetching worker:', error);
        res.status(500).json({ error: 'Failed to fetch worker details' });
    }
});

// ─── POST /api/workers ────────────────────────────────────────────────────────
router.post('/', requireAgency, async (req, res) => {
    try {
        const { firstName, lastName, email, phone, jobRole, startDate, notes } = req.body;

        if (!firstName || !lastName || !email || !jobRole || !startDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check for duplicate email within this agency
        const existingWorker = await prisma.worker.findUnique({
            where: { agencyId_email: { agencyId: req.agencyId, email } }
        });

        if (existingWorker) {
            return res.status(409).json({ error: 'A worker with this email already exists in your agency' });
        }

        const worker = await prisma.worker.create({
            data: {
                agencyId: req.agencyId,
                firstName,
                lastName,
                email,
                phone: phone || null,
                jobTitle: jobRole,
                startDate: new Date(startDate),
                notes: notes || null,
                status: 'ACTIVE'
            }
        });

        res.status(201).json({ data: worker });
    } catch (error) {
        console.error('Error creating worker:', error);
        res.status(500).json({ error: 'Failed to create worker' });
    }
});

module.exports = router;
