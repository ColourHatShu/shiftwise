const express = require('express');
const Sentry = require('@sentry/node');
const { requireAgency, requireRole } = require('../lib/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// Apply auth to all routes in this router
router.use(requireAgency);

// ─── GET /api/audit-log ────────────────────────────────────────────────────────
// Returns paginated, filterable audit log entries for the current agency.
// Requires OWNER or ADMIN role.
router.get('/', requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {
        // Parse + clamp pagination: page >= 1, limit in [1, 100] so a client can
        // never request an unbounded `take` (matches workers/compliance).
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;
        const action = req.query.action || undefined;
        const entity = req.query.entity || undefined;
        const userId = req.query.userId || undefined;
        const dateFrom = req.query.dateFrom || undefined;
        const dateTo = req.query.dateTo || undefined;

        // Build where clause
        const where = {
            agencyId: req.agencyId
        };

        // Apply optional filters
        if (action) {
            where.action = {
                contains: action,
                mode: 'insensitive'
            };
        }

        if (entity) {
            where.entity = {
                contains: entity,
                mode: 'insensitive'
            };
        }

        if (userId) {
            where.userId = userId;
        }

        // Apply date range filter
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                if (isNaN(fromDate.getTime())) {
                    return res.status(400).json({
                        error: 'Invalid dateFrom format. Use ISO 8601 format (e.g., 2026-05-01)'
                    });
                }
                where.createdAt.gte = fromDate;
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                if (isNaN(toDate.getTime())) {
                    return res.status(400).json({
                        error: 'Invalid dateTo format. Use ISO 8601 format (e.g., 2026-05-18)'
                    });
                }
                // Set to end of day
                toDate.setUTCHours(23, 59, 59, 999);
                where.createdAt.lte = toDate;
            }
        }

        // Fetch audit log entries
        const [entries, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    action: true,
                    entity: true,
                    entityId: true,
                    userId: true,
                    metadata: true,
                    createdAt: true,
                    ipAddress: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            }),
            prisma.auditLog.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        res.json({
            data: entries,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (error) {
        console.error('Error fetching audit log:', error);

        // Log to Sentry
        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'audit-log-fetch-error'
            }
        });

        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

module.exports = router;
