import { describe, it, expect } from 'vitest';
import { reliabilityRateStyle } from './reliability';

describe('reliabilityRateStyle', () => {
    it('returns a grey "—" for no history (null)', () => {
        const s = reliabilityRateStyle(null);
        expect(s.label).toBe('—');
        expect(s.badgeClass).toContain('#52627E'); // AA-compliant grey on #EBEEF5
    });

    it('is green at or above 80', () => {
        expect(reliabilityRateStyle(80).badgeClass).toContain('#166534');
        expect(reliabilityRateStyle(100).textClass).toContain('#166534');
        expect(reliabilityRateStyle(95).label).toBe('95%');
    });

    it('is amber between 50 and 79', () => {
        expect(reliabilityRateStyle(50).badgeClass).toContain('#92400E');
        expect(reliabilityRateStyle(79).textClass).toContain('#92400E');
    });

    it('is red below 50', () => {
        expect(reliabilityRateStyle(49).badgeClass).toContain('#991B1B');
        expect(reliabilityRateStyle(0).label).toBe('0%');
    });
});
