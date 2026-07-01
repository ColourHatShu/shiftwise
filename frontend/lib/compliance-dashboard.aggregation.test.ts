import { describe, it, expect } from 'vitest';
import {
    calculateOverallCompliance,
    groupByStatus,
    verifyScoreFormula,
    type Worker,
} from './compliance-dashboard';

const w = (over: Partial<Worker> = {}): Worker => ({
    id: 'x',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.com',
    status: 'ACTIVE',
    complianceScore: 50,
    complianceStatus: 'yellow',
    completedDocs: 1,
    totalRequiredDocs: 2,
    lastUpdated: '2026-01-01',
    hasExpiringDocs: false,
    ...over,
});

describe('calculateOverallCompliance', () => {
    it('returns 0 for an empty list', () => {
        expect(calculateOverallCompliance([])).toBe(0);
    });

    it('averages the compliance scores (rounded)', () => {
        expect(calculateOverallCompliance([w({ complianceScore: 100 }), w({ complianceScore: 50 }), w({ complianceScore: 0 })])).toBe(50);
        // 100 + 90 + 81 = 271 / 3 = 90.33 → 90
        expect(calculateOverallCompliance([w({ complianceScore: 100 }), w({ complianceScore: 90 }), w({ complianceScore: 81 })])).toBe(90);
    });
});

describe('groupByStatus', () => {
    it('partitions workers by compliance status', () => {
        const list = [
            w({ id: '1', complianceStatus: 'red' }),
            w({ id: '2', complianceStatus: 'green' }),
            w({ id: '3', complianceStatus: 'green' }),
            w({ id: '4', complianceStatus: 'yellow' }),
        ];
        const grouped = groupByStatus(list);
        expect(grouped.red.map(x => x.id)).toEqual(['1']);
        expect(grouped.green.map(x => x.id)).toEqual(['2', '3']);
        expect(grouped.yellow.map(x => x.id)).toEqual(['4']);
    });

    it('returns empty buckets for an empty list', () => {
        expect(groupByStatus([])).toEqual({ red: [], yellow: [], green: [] });
    });
});

describe('verifyScoreFormula', () => {
    it('returns 100 when nothing is required', () => {
        expect(verifyScoreFormula(0, 0)).toBe(100);
        expect(verifyScoreFormula(5, 0)).toBe(100);
    });

    it('computes completed/required as a rounded percentage', () => {
        expect(verifyScoreFormula(3, 4)).toBe(75);
        expect(verifyScoreFormula(0, 2)).toBe(0);
        expect(verifyScoreFormula(1, 3)).toBe(33); // 33.33 → 33
        expect(verifyScoreFormula(2, 3)).toBe(67); // 66.67 → 67
    });
});
