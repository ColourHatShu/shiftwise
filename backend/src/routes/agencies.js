const express = require('express');
const { verifyToken, createClerkClient } = require('@clerk/backend');
const prisma = require('../lib/prisma');

const router = express.Router();

// Shared Clerk client for fetching user info
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// ─── Shared token verifier ────────────────────────────────────────────────────
const verifyClerkToken = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
            authorizedParties: ['http://localhost:3000'],
            clockSkewInMs: 300000
        });
        return payload.sub; // clerkUserId
    } catch (err) {
        console.error('❌ Token verification failed:', err.message);
        res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        return null;
    }
};

// ─── POST /api/agencies/setup ─────────────────────────────────────────────────
// Idempotent: creates an Agency + User if they don't exist, returns existing if they do.
router.post('/setup', async (req, res) => {
    try {
        const clerkUserId = await verifyClerkToken(req, res);
        if (!clerkUserId) return;

        // Check if user already exists with an agency
        const existingUser = await prisma.user.findUnique({
            where: { clerkId: clerkUserId },
            include: { agency: true }
        });

        if (existingUser?.agency) {
            return res.json({ data: existingUser.agency, created: false });
        }

        // Fetch user details from Clerk
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses[0]?.emailAddress ?? `user-${clerkUserId}@shiftwise.app`;
        const firstName = clerkUser.firstName ?? 'Agency';
        const lastName = clerkUser.lastName ?? 'Owner';

        // Build a unique slug from the email prefix + timestamp
        const slugBase = email
            .split('@')[0]
            .replace(/[^a-z0-9]/gi, '-')
            .toLowerCase()
            .slice(0, 40);
        const slug = `${slugBase}-${Date.now()}`;

        // Create Agency + User in one transaction
        const agency = await prisma.agency.create({
            data: {
                name: `${firstName} ${lastName}'s Agency`,
                slug,
                email,
                users: {
                    create: {
                        clerkId: clerkUserId,
                        email,
                        firstName,
                        lastName,
                        role: 'OWNER'
                    }
                }
            }
        });

        console.log(`✅ Agency created for ${email}: ${agency.id}`);
        return res.status(201).json({ data: agency, created: true });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'An agency with this email already exists' });
        }
        console.error('Error in agency setup:', error);
        res.status(500).json({ error: 'Failed to setup agency' });
    }
});

// ─── PUT /api/agencies/onboard ────────────────────────────────────────────────
// Saves onboarding details and marks agency as onboarded.
router.put('/onboard', async (req, res) => {
    try {
        const clerkUserId = await verifyClerkToken(req, res);
        if (!clerkUserId) return;

        const user = await prisma.user.findUnique({
            where: { clerkId: clerkUserId }
        });

        if (!user?.agencyId) {
            return res.status(403).json({ error: 'No agency found. Please refresh the page.' });
        }

        const { name, address, city, postcode, phone, agencyType } = req.body;

        if (!name || !address || !city || !postcode || !phone || !agencyType) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const agency = await prisma.agency.update({
            where: { id: user.agencyId },
            data: { name, address, city, postcode, phone, agencyType, isOnboarded: true }
        });

        return res.json({ data: agency });
    } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({ error: 'Failed to save onboarding details' });
    }
});

// ─── GET /api/agencies/me ─────────────────────────────────────────────────────
// Returns the current user's agency (including isOnboarded status).
router.get('/me', async (req, res) => {
    try {
        const clerkUserId = await verifyClerkToken(req, res);
        if (!clerkUserId) return;

        const user = await prisma.user.findUnique({
            where: { clerkId: clerkUserId },
            include: { agency: true }
        });

        if (!user?.agency) {
            return res.status(404).json({ error: 'No agency found' });
        }

        return res.json({ data: user.agency });
    } catch (error) {
        console.error('Error fetching agency:', error);
        res.status(500).json({ error: 'Failed to fetch agency' });
    }
});

module.exports = router;
