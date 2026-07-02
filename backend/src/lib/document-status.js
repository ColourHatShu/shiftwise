/**
 * Derive a document's display status from its stored status + expiry date.
 * Dependency-free (so it's unit-testable without pulling documents.js's OCR/TS
 * deps). Mirrors the frontend `lib/document-status.ts`.
 *
 * An APPROVED document past its expiry is EXPIRED, not "expiring soon" — the
 * nightly job flips status→EXPIRED but there's a window where it's still
 * APPROVED, and "expiring soon" for something already lapsed is misleading.
 *
 * Returns: 'NOT_UPLOADED' | 'EXPIRED' | 'EXPIRING_SOON' | the raw status.
 */
function computeDocumentDisplayStatus(doc) {
    if (!doc) return 'NOT_UPLOADED';
    if (doc.status === 'EXPIRED') return 'EXPIRED';

    if (doc.status === 'APPROVED' && doc.expiryDate) {
        const exp = new Date(doc.expiryDate);
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        if (exp < startOfToday) return 'EXPIRED'; // lapsed but status not yet flipped
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        if (exp <= in30) return 'EXPIRING_SOON';
    }

    return doc.status || 'NOT_UPLOADED';
}

module.exports = { computeDocumentDisplayStatus };
