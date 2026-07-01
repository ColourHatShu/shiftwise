const express = require('express');
const { createClerkClient } = require('@clerk/backend');
const { verifyClerkToken, requireAgency, requireRole } = require('../lib/auth');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
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

        (req.log || logger).info({ email, agencyId: agency.id }, 'Agency created');
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
        (req.log || logger).error({ err: error }, 'Error in agency setup');
        res.status(500).json({ error: 'Failed to setup agency' });
    }
});

// ─── PUT /api/agencies/onboard ────────────────────────────────────────────────
// Saves onboarding details and marks agency as onboarded.
router.put('/onboard', requireAgency, async (req, res) => {
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
        (req.log || logger).error({ err: error }, 'Error completing onboarding');
        res.status(500).json({ error: 'Failed to save onboarding details' });
    }
});

// ─── GET /api/agencies/me ─────────────────────────────────────────────────────
// Returns the current user's agency (including isOnboarded status).
router.get('/me', requireAgency, async (req, res) => {
    try {
        const agency = await prisma.agency.findUnique({
            where: { id: req.agencyId }
        });

        if (!agency) {
            return res.status(404).json({ error: 'No agency found' });
        }

        return res.json({ data: agency });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching agency');
        res.status(500).json({ error: 'Failed to fetch agency' });
    }
});

// ─── PATCH /api/agencies/update ───────────────────────────────────────────────
// Updates the current user's agency details from the Settings page.
router.patch('/update', requireAgency, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
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
        (req.log || logger).error({ err: error }, 'Error updating agency settings');
        res.status(500).json({ error: 'Failed to update agency settings' });
    }
});

// ─── PUT /api/agencies/compliance-thresholds ──────────────────────────────────
// R-AP-06: Update custom compliance thresholds for the agency
// thresholds: [ { documentTypeId, warningDays } ]
router.put('/compliance-thresholds', requireAgency, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        const { thresholds } = req.body;

        if (!Array.isArray(thresholds)) {
            return res.status(400).json({ error: 'thresholds must be an array' });
        }

        // Validate thresholds
        for (const threshold of thresholds) {
            if (!threshold.documentTypeId || !Number.isInteger(threshold.warningDays)) {
                return res.status(400).json({ error: 'Invalid threshold format' });
            }
            if (threshold.warningDays < 1 || threshold.warningDays > 365) {
                return res.status(400).json({ error: 'warningDays must be between 1 and 365' });
            }
        }

        // Build thresholds object
        const thresholdsObj = {};
        thresholds.forEach(t => {
            thresholdsObj[t.documentTypeId] = t.warningDays;
        });

        // Update agency
        const updated = await prisma.agency.update({
            where: { id: req.agencyId },
            data: {
                complianceThresholds: thresholdsObj,
                customThresholdEnabled: true
            }
        });

        return res.json({
            message: 'Compliance thresholds updated successfully',
            data: {
                agencyId: updated.id,
                thresholds: thresholdsObj,
                enabled: updated.customThresholdEnabled
            }
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error updating compliance thresholds');
        res.status(500).json({ error: 'Failed to update compliance thresholds' });
    }
});

// ─── GET /api/agencies/compliance-thresholds ──────────────────────────────────
// Fetch current compliance thresholds for the agency
router.get('/compliance-thresholds', requireAgency, async (req, res) => {
    try {
        const agency = await prisma.agency.findUnique({
            where: { id: req.agencyId },
            select: {
                complianceThresholds: true,
                customThresholdEnabled: true
            }
        });

        if (!agency) {
            return res.status(404).json({ error: 'Agency not found' });
        }

        // Fetch document types with their default values
        const docTypes = await prisma.documentType.findMany({
            where: { agencyId: req.agencyId },
            select: { id: true, name: true, expiryWarningDays: true }
        });

        // Merge custom thresholds with defaults
        const thresholds = docTypes.map(dt => ({
            documentTypeId: dt.id,
            documentTypeName: dt.name,
            warningDays: agency.complianceThresholds?.[dt.id] || dt.expiryWarningDays || 30
        }));

        return res.json({
            data: {
                thresholds,
                customThresholdEnabled: agency.customThresholdEnabled
            }
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching compliance thresholds');
        res.status(500).json({ error: 'Failed to fetch compliance thresholds' });
    }
});

// ─── GET /api/agencies/document-types ──────────────────────────────────────────
// Fetch all document types for the agency
router.get('/document-types', requireAgency, async (req, res) => {
    try {
        const docTypes = await prisma.documentType.findMany({
            where: { agencyId: req.agencyId },
            orderBy: { name: 'asc' }
        });

        return res.json({
            data: docTypes
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching document types');
        res.status(500).json({ error: 'Failed to fetch document types' });
    }
});

module.exports = router;
