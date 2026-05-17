const express = require('express');
const { createClerkClient } = require('@clerk/backend');
const { verifyClerkToken } = require('../lib/auth');
const prisma = require('../lib/prisma');
const { seedDocumentTypes } = require('../lib/seedDocumentTypes');

const router = express.Router();

// Shared Clerk client for fetching user info
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// ─── POST /api/agencies/setup ─────────────────────────────────────────────────
// Idempotent: creates an Agency + User if they don't exist, returns existing if they do.
// Special case: uses verifyClerkToken (not requireAgency middleware) because user may not have agency yet.
router.post('/setup', async (req, res) => {
    try {
        const payload = await verifyClerkToken(req);
        const clerkUserId = payload.sub;

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
        // Seed standard document types for this new agency
        await seedDocumentTypes(agency.id, prisma);
        return res.status(201).json({ data: agency, created: true });
    } catch (error) {
        if (error.status === 401) {
            return res.status(401).json({ error: error.message });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'An agency with this email already exists' });
        }
        console.error('Error in agency setup:', error);
        res.status(500).json({ error: 'Failed to setup agency' });
    }
});

// ─── PUT /api/agencies/onboard ────────────────────────────────────────────────
// Saves onboarding details and marks agency as onboarded.
router.put('/onboard', require('../lib/auth').requireAgency, async (req, res) => {
    try {
        const { name, address, city, postcode, phone, agencyType } = req.body;

        if (!name || !address || !city || !postcode || !phone || !agencyType) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const agency = await prisma.agency.update({
            where: { id: req.agencyId },
            data: { name, address, city, postcode, phone, agencyType, isOnboarded: true }
        });

        // Ensure document types exist (idempotent)
        await seedDocumentTypes(req.agencyId, prisma);
        return res.json({ data: agency });
    } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({ error: 'Failed to save onboarding details' });
    }
});

// ─── GET /api/agencies/me ─────────────────────────────────────────────────────
// Returns the current user's agency (including isOnboarded status).
router.get('/me', require('../lib/auth').requireAgency, async (req, res) => {
    try {
        const agency = await prisma.agency.findUnique({
            where: { id: req.agencyId }
        });

        if (!agency) {
            return res.status(404).json({ error: 'No agency found' });
        }

        return res.json({ data: agency });
    } catch (error) {
        console.error('Error fetching agency:', error);
        res.status(500).json({ error: 'Failed to fetch agency' });
    }
});

// ─── PATCH /api/agencies/update ───────────────────────────────────────────────
// Updates the current user's agency details from the Settings page.
router.patch('/update', require('../lib/auth').requireAgency, async (req, res) => {
    try {
        const { name, address, city, postcode, phone, agencyType } = req.body;

        const updateData = {};
        if (name) updateData.name = name.trim();
        if (address !== undefined) updateData.address = address.trim();
        if (city !== undefined) updateData.city = city.trim();
        if (postcode !== undefined) updateData.postcode = postcode.trim();
        if (phone !== undefined) updateData.phone = phone.trim();
        if (agencyType !== undefined) updateData.agencyType = agencyType.trim();

        const updatedAgency = await prisma.agency.update({
            where: { id: req.agencyId },
            data: updateData
        });

        return res.json({ message: 'Settings saved successfully', data: updatedAgency });
    } catch (error) {
        console.error('Error updating agency settings:', error);
        res.status(500).json({ error: 'Failed to update agency settings' });
    }
});

module.exports = router;
