/**
 * Agency settings + compliance-thresholds. Covers the PATCH null-field
 * regression (address/city/... = null must not crash) and the thresholds
 * validation + agency-scoped update.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../lib/prisma');
jest.mock('../../lib/auth', () => ({
    verifyClerkToken: (req, res, next) => next(),
    requireAgency: (req, res, next) => {
        req.agencyId = 'agency-1';
        req.user = { id: 'user-1', role: 'OWNER' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
}));

const prisma = require('../../lib/prisma');
const agenciesRouter = require('../../routes/agencies');

describe('agencies settings + thresholds', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        prisma.agency = { update: jest.fn(), findUnique: jest.fn() };
        app.use('/api/agencies', agenciesRouter);
    });

    describe('PATCH /update', () => {
        it('does not crash when optional fields are explicitly null (regression)', async () => {
            prisma.agency.update.mockResolvedValue({ id: 'agency-1' });
            const res = await request(app).patch('/api/agencies/update').send({ address: null, city: null, phone: null });
            expect(res.status).toBe(200);
            const arg = prisma.agency.update.mock.calls[0][0];
            expect(arg.data).toMatchObject({ address: null, city: null, phone: null });
            expect(arg.where).toEqual({ id: 'agency-1' });
        });

        it('trims provided string fields', async () => {
            prisma.agency.update.mockResolvedValue({ id: 'agency-1' });
            await request(app).patch('/api/agencies/update').send({ name: '  Acme Care  ' });
            expect(prisma.agency.update.mock.calls[0][0].data.name).toBe('Acme Care');
        });
    });

    describe('PUT /compliance-thresholds', () => {
        it('400s when thresholds is not an array', async () => {
            const res = await request(app).put('/api/agencies/compliance-thresholds').send({ thresholds: 'nope' });
            expect(res.status).toBe(400);
        });

        it('400s on an out-of-range warningDays', async () => {
            const res = await request(app).put('/api/agencies/compliance-thresholds')
                .send({ thresholds: [{ documentTypeId: 't1', warningDays: 999 }] });
            expect(res.status).toBe(400);
        });

        it('400s on a non-integer warningDays', async () => {
            const res = await request(app).put('/api/agencies/compliance-thresholds')
                .send({ thresholds: [{ documentTypeId: 't1', warningDays: 12.5 }] });
            expect(res.status).toBe(400);
        });

        it('saves a valid thresholds map (agency-scoped)', async () => {
            prisma.agency.update.mockResolvedValue({ id: 'agency-1', customThresholdEnabled: true });
            const res = await request(app).put('/api/agencies/compliance-thresholds')
                .send({ thresholds: [{ documentTypeId: 't1', warningDays: 30 }, { documentTypeId: 't2', warningDays: 60 }] });
            expect(res.status).toBe(200);
            const arg = prisma.agency.update.mock.calls[0][0];
            expect(arg.where).toEqual({ id: 'agency-1' });
            expect(arg.data.complianceThresholds).toEqual({ t1: 30, t2: 60 });
            expect(arg.data.customThresholdEnabled).toBe(true);
        });
    });
});
