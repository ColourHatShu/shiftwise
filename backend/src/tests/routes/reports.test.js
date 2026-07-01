/**
 * Reports — focus on the "expiring" report, which must include documents
 * expiring *today* (a prior `gte: new Date()` filter dropped them because their
 * midnight timestamp is < the current time).
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../lib/prisma');
jest.mock('../../services/pdfService', () => ({}));
jest.mock('../../lib/auth', () => ({
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
}));

const prisma = require('../../lib/prisma');
const reportsRouter = require('../../routes/reports');

describe('GET /api/reports/expiring', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.worker = { findMany: jest.fn() };
        app.use('/api/reports', reportsRouter);
    });

    it('filters from start-of-day (UTC midnight) so today\'s expiries are included', async () => {
        prisma.worker.findMany.mockResolvedValue([]);
        await request(app).get('/api/reports/expiring');
        const arg = prisma.worker.findMany.mock.calls[0][0];
        const gte = arg.include.complianceDocuments.where.expiryDate.gte;
        expect(gte).toBeInstanceOf(Date);
        expect(gte.getUTCHours()).toBe(0);
        expect(gte.getUTCMinutes()).toBe(0);
        expect(gte.getUTCSeconds()).toBe(0);
    });

    it('flattens workers → docs and sorts by soonest expiry with urgency', async () => {
        const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
        prisma.worker.findMany.mockResolvedValue([
            {
                firstName: 'Jane', lastName: 'Doe', jobTitle: 'Nurse',
                complianceDocuments: [
                    { expiryDate: later, documentType: { name: 'RTW' } },
                    { expiryDate: soon, documentType: { name: 'DBS' } },
                ],
            },
        ]);

        const res = await request(app).get('/api/reports/expiring');

        expect(res.status).toBe(200);
        expect(res.body.data.map((d) => d.documentName)).toEqual(['DBS', 'RTW']); // soonest first
        expect(res.body.data[0].urgency).toBe('CRITICAL'); // <= 7 days
        expect(res.body.data[1].urgency).toBe('MEDIUM'); // > 14 days
    });

    it('500s gracefully on a DB error', async () => {
        prisma.worker.findMany.mockRejectedValue(new Error('db down'));
        const res = await request(app).get('/api/reports/expiring');
        expect(res.status).toBe(500);
    });
});
