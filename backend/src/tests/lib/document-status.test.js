/**
 * Backend document display-status helper — mirrors the frontend one. An
 * APPROVED-but-lapsed doc must read EXPIRED, not EXPIRING_SOON.
 */

const { computeDocumentDisplayStatus } = require('../../lib/document-status');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe('computeDocumentDisplayStatus', () => {
    it('NOT_UPLOADED when there is no document', () => {
        expect(computeDocumentDisplayStatus(null)).toBe('NOT_UPLOADED');
    });

    it('honours an explicit EXPIRED status', () => {
        expect(computeDocumentDisplayStatus({ status: 'EXPIRED', expiryDate: daysFromNow(10) })).toBe('EXPIRED');
    });

    it('treats an APPROVED-but-lapsed doc as EXPIRED, not EXPIRING_SOON (the bug)', () => {
        expect(computeDocumentDisplayStatus({ status: 'APPROVED', expiryDate: daysFromNow(-2) })).toBe('EXPIRED');
    });

    it('flags EXPIRING_SOON within 30 days', () => {
        expect(computeDocumentDisplayStatus({ status: 'APPROVED', expiryDate: daysFromNow(10) })).toBe('EXPIRING_SOON');
    });

    it('leaves a valid / no-expiry APPROVED doc as APPROVED', () => {
        expect(computeDocumentDisplayStatus({ status: 'APPROVED', expiryDate: daysFromNow(200) })).toBe('APPROVED');
        expect(computeDocumentDisplayStatus({ status: 'APPROVED', expiryDate: null })).toBe('APPROVED');
    });

    it('passes through PENDING / REJECTED', () => {
        expect(computeDocumentDisplayStatus({ status: 'PENDING' })).toBe('PENDING');
        expect(computeDocumentDisplayStatus({ status: 'REJECTED' })).toBe('REJECTED');
    });
});
