/**
 * Unit tests for computeCompliance — the pure function behind every compliance
 * verdict (single-worker and bulk paths both delegate to it). This is the core
 * of the product promise (audit-ready RAG status), so it's worth nailing down.
 */

jest.mock('../../lib/prisma'); // module imports prisma at load; computeCompliance itself is pure

const { computeCompliance } = require('../../lib/compliance-assignment');

const future = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const past = () => new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

describe('computeCompliance', () => {
    it('treats a worker with no required documents as compliant (score 100)', () => {
        const r = computeCompliance([], []);
        expect(r.isCompliant).toBe(true);
        expect(r.reason).toBeNull();
        expect(r.snapshot.complianceScore).toBe(100);
        expect(r.snapshot.status).toBe('compliant');
    });

    it('is compliant when every required doc is APPROVED and unexpired', () => {
        const required = [{ id: 'dt1', name: 'DBS' }, { id: 'dt2', name: 'RTW' }];
        const docs = [
            { documentTypeId: 'dt1', status: 'APPROVED', expiryDate: future() },
            { documentTypeId: 'dt2', status: 'APPROVED', expiryDate: null },
        ];
        const r = computeCompliance(required, docs);
        expect(r.isCompliant).toBe(true);
        expect(r.snapshot.complianceScore).toBe(100);
        expect(r.snapshot.documents).toHaveLength(2);
    });

    it('flags a missing document', () => {
        const required = [{ id: 'dt1', name: 'DBS' }, { id: 'dt2', name: 'RTW' }];
        const docs = [{ documentTypeId: 'dt1', status: 'APPROVED', expiryDate: future() }];
        const r = computeCompliance(required, docs);
        expect(r.isCompliant).toBe(false);
        expect(r.reason).toMatch(/Missing RTW/);
        expect(r.snapshot.complianceScore).toBe(50);
    });

    it('flags a document that is present but not yet approved', () => {
        const required = [{ id: 'dt1', name: 'DBS' }];
        const docs = [{ documentTypeId: 'dt1', status: 'PENDING', expiryDate: future() }];
        const r = computeCompliance(required, docs);
        expect(r.isCompliant).toBe(false);
        expect(r.reason).toMatch(/Not yet approved: DBS/);
        expect(r.snapshot.complianceScore).toBe(0);
    });

    it('flags an APPROVED but expired document (with the expiry date)', () => {
        const required = [{ id: 'dt1', name: 'DBS' }];
        const expired = past();
        const docs = [{ documentTypeId: 'dt1', status: 'APPROVED', expiryDate: expired }];
        const r = computeCompliance(required, docs);
        expect(r.isCompliant).toBe(false);
        expect(r.reason).toMatch(/Document expired/);
        expect(r.reason).toContain(expired.toISOString().split('T')[0]);
        expect(r.snapshot.complianceScore).toBe(0);
    });

    it('counts an APPROVED doc with no expiry date as valid', () => {
        const required = [{ id: 'dt1', name: 'Reference' }];
        const docs = [{ documentTypeId: 'dt1', status: 'APPROVED', expiryDate: null }];
        const r = computeCompliance(required, docs);
        expect(r.isCompliant).toBe(true);
        expect(r.snapshot.documents[0]).toMatchObject({ documentTypeId: 'dt1', expiryDate: null });
    });

    it('computes a partial score and concatenates multiple reasons', () => {
        const required = [
            { id: 'dt1', name: 'DBS' },
            { id: 'dt2', name: 'RTW' },
            { id: 'dt3', name: 'Training' },
            { id: 'dt4', name: 'Passport' },
        ];
        const docs = [
            { documentTypeId: 'dt1', status: 'APPROVED', expiryDate: future() }, // ok
            { documentTypeId: 'dt2', status: 'PENDING', expiryDate: future() }, // not approved
            { documentTypeId: 'dt3', status: 'APPROVED', expiryDate: past() }, // expired
            // dt4 missing
        ];
        const r = computeCompliance(required, docs);
        expect(r.isCompliant).toBe(false);
        expect(r.snapshot.complianceScore).toBe(25); // 1 of 4 valid
        expect(r.reason).toMatch(/Not yet approved: RTW/);
        expect(r.reason).toMatch(/Document expired/);
        expect(r.reason).toMatch(/Missing Passport/);
        expect(r.snapshot.documents).toHaveLength(1);
    });

    it('only includes valid docs in the snapshot, with capture metadata', () => {
        const required = [{ id: 'dt1', name: 'DBS' }];
        const docs = [{ documentTypeId: 'dt1', status: 'APPROVED', expiryDate: future() }];
        const snap = computeCompliance(required, docs).snapshot.documents[0];
        expect(snap).toMatchObject({ documentTypeId: 'dt1', documentTypeName: 'DBS', approvalStatus: 'APPROVED' });
        expect(typeof snap.capturedAt).toBe('string');
    });
});
