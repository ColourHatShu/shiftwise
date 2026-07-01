/**
 * Audit-pack ownership check (dependency-free so it can be unit-tested without
 * pulling in the heavy audit-pack-service deps like archiver/pdfkit).
 *
 * Every packId embeds the owning agencyId — `audit-pack-<agencyId>-...` or
 * `bulk-export-<agencyId>-...`. The trailing '-' delimiter prevents one agency id
 * from being a prefix of another. Used to stop a coordinator of one agency
 * downloading another agency's pack (IDOR).
 */
function isAuditPackOwnedByAgency(packId, agencyId) {
    if (!packId || !agencyId) return false;
    return packId.startsWith(`audit-pack-${agencyId}-`) || packId.startsWith(`bulk-export-${agencyId}-`);
}

module.exports = { isAuditPackOwnedByAgency };
