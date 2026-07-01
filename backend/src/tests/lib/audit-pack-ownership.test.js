/**
 * Audit-pack ownership guard — prevents a coordinator of one agency downloading
 * another agency's pack (IDOR). packIds embed the owning agencyId.
 */

const { isAuditPackOwnedByAgency } = require('../../lib/audit-pack-ownership');

describe('isAuditPackOwnedByAgency', () => {
    it('accepts a single-worker pack owned by the agency', () => {
        expect(isAuditPackOwnedByAgency('audit-pack-agency-1-worker-9-1712345678', 'agency-1')).toBe(true);
    });

    it('accepts a bulk-export pack owned by the agency', () => {
        expect(isAuditPackOwnedByAgency('bulk-export-agency-1-1712345678', 'agency-1')).toBe(true);
    });

    it("rejects another agency's pack (IDOR)", () => {
        expect(isAuditPackOwnedByAgency('audit-pack-agency-2-worker-9-1', 'agency-1')).toBe(false);
        expect(isAuditPackOwnedByAgency('bulk-export-agency-2-1', 'agency-1')).toBe(false);
    });

    it('is not fooled by an agency id that is a prefix of another', () => {
        // agency-1 must NOT be able to read a pack belonging to agency-12
        expect(isAuditPackOwnedByAgency('audit-pack-agency-12-w-1', 'agency-1')).toBe(false);
    });

    it('rejects missing args', () => {
        expect(isAuditPackOwnedByAgency('', 'agency-1')).toBe(false);
        expect(isAuditPackOwnedByAgency('audit-pack-agency-1-x', '')).toBe(false);
        expect(isAuditPackOwnedByAgency(undefined, undefined)).toBe(false);
    });
});
