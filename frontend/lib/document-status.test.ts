import { describe, it, expect } from 'vitest';
import { computeDocumentStatus } from './document-status';

const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe('computeDocumentStatus', () => {
    it('returns NOT_UPLOADED for a missing document', () => {
        expect(computeDocumentStatus(null)).toBe('NOT_UPLOADED');
    });

    it('honours an explicit EXPIRED status', () => {
        expect(computeDocumentStatus({ status: 'EXPIRED', expiryDate: daysFromNow(10) })).toBe('EXPIRED');
    });

    it('treats an APPROVED-but-lapsed doc as EXPIRED, not EXPIRING_SOON (the bug)', () => {
        expect(computeDocumentStatus({ status: 'APPROVED', expiryDate: daysFromNow(-3) })).toBe('EXPIRED');
    });

    it('flags EXPIRING_SOON within 30 days', () => {
        expect(computeDocumentStatus({ status: 'APPROVED', expiryDate: daysFromNow(10) })).toBe('EXPIRING_SOON');
    });

    it('leaves a valid APPROVED doc (far future / no expiry) as APPROVED', () => {
        expect(computeDocumentStatus({ status: 'APPROVED', expiryDate: daysFromNow(200) })).toBe('APPROVED');
        expect(computeDocumentStatus({ status: 'APPROVED', expiryDate: null })).toBe('APPROVED');
    });

    it('passes through PENDING / REJECTED', () => {
        expect(computeDocumentStatus({ status: 'PENDING' })).toBe('PENDING');
        expect(computeDocumentStatus({ status: 'REJECTED' })).toBe('REJECTED');
    });
});
