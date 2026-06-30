import { describe, it, expect } from 'vitest';
import { getComplianceStatus, getStatusLabel } from './compliance-dashboard';

describe('getComplianceStatus', () => {
    it('returns green at or above 80', () => {
        expect(getComplianceStatus(80)).toBe('green');
        expect(getComplianceStatus(100)).toBe('green');
    });

    it('returns yellow between 50 and 79', () => {
        expect(getComplianceStatus(50)).toBe('yellow');
        expect(getComplianceStatus(79)).toBe('yellow');
    });

    it('returns red below 50', () => {
        expect(getComplianceStatus(49)).toBe('red');
        expect(getComplianceStatus(0)).toBe('red');
    });
});

describe('getStatusLabel', () => {
    it('maps each status to its human-readable label', () => {
        expect(getStatusLabel('green')).toBe('Compliant');
        expect(getStatusLabel('yellow')).toBe('At Risk');
        expect(getStatusLabel('red')).toBe('Non-Compliant');
    });
});
