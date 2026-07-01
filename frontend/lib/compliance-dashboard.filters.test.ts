import { describe, it, expect } from 'vitest';
import {
    filterWorkers,
    sortWorkers,
    paginateWorkers,
    buildQueryString,
    parseQueryString,
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

describe('filterWorkers', () => {
    const list = [
        w({ firstName: 'John', lastName: 'Doe', email: 'john@x.com', jobTitle: 'Nurse' }),
        w({ firstName: 'Jane', lastName: 'Smith', email: 'jane@y.com', jobTitle: 'Carer' }),
    ];

    it('returns all when the term is empty', () => {
        expect(filterWorkers(list, '')).toHaveLength(2);
    });

    it('matches on first/last name, email and job title (case-insensitive)', () => {
        expect(filterWorkers(list, 'JOHN')).toHaveLength(1);
        expect(filterWorkers(list, 'smith')).toHaveLength(1);
        expect(filterWorkers(list, 'jane@y')).toHaveLength(1);
        expect(filterWorkers(list, 'nurse')).toHaveLength(1);
    });

    it('returns none when nothing matches', () => {
        expect(filterWorkers(list, 'zzz')).toHaveLength(0);
    });
});

describe('sortWorkers', () => {
    const list = [
        w({ id: '1', firstName: 'Charlie', complianceScore: 30, lastUpdated: '2026-03-01' }),
        w({ id: '2', firstName: 'Alice', complianceScore: 10, lastUpdated: '2026-01-01' }),
        w({ id: '3', firstName: 'Bob', complianceScore: 20, lastUpdated: '2026-02-01' }),
    ];

    it('sorts by score ascending and descending', () => {
        expect(sortWorkers(list, 'score', 'asc').map(x => x.complianceScore)).toEqual([10, 20, 30]);
        expect(sortWorkers(list, 'score', 'desc').map(x => x.complianceScore)).toEqual([30, 20, 10]);
    });

    it('sorts by name ascending', () => {
        expect(sortWorkers(list, 'name', 'asc').map(x => x.firstName)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('sorts by last-updated ascending', () => {
        expect(sortWorkers(list, 'updated', 'asc').map(x => x.id)).toEqual(['2', '3', '1']);
    });

    it('does not mutate the input array', () => {
        const before = list.map(x => x.id);
        sortWorkers(list, 'score', 'desc');
        expect(list.map(x => x.id)).toEqual(before);
    });
});

describe('paginateWorkers', () => {
    const list = Array.from({ length: 25 }, (_, i) => w({ id: String(i) }));

    it('returns the right page slice and total pages', () => {
        const p1 = paginateWorkers(list, 1, 10);
        expect(p1.workers).toHaveLength(10);
        expect(p1.totalPages).toBe(3);
        expect(p1.workers[0].id).toBe('0');
    });

    it('handles the last (partial) page', () => {
        const p3 = paginateWorkers(list, 3, 10);
        expect(p3.workers).toHaveLength(5);
        expect(p3.workers[0].id).toBe('20');
    });

    it('handles an empty list', () => {
        expect(paginateWorkers([], 1, 10)).toEqual({ workers: [], totalPages: 0 });
    });
});

describe('buildQueryString / parseQueryString', () => {
    it('omits defaults (page 1, name/asc)', () => {
        expect(buildQueryString({})).toBe('');
        expect(buildQueryString({ page: 1, sortBy: 'name', sortOrder: 'asc' })).toBe('');
    });

    it('includes non-default filters', () => {
        const qs = buildQueryString({ page: 2, search: 'jo', status: 'red', sortBy: 'score', sortOrder: 'desc' });
        expect(qs.startsWith('?')).toBe(true);
        const parsed = parseQueryString(qs);
        expect(parsed).toEqual({ page: 2, search: 'jo', status: 'red', sortBy: 'score', sortOrder: 'desc' });
    });

    it('parseQueryString returns defaults for an empty string', () => {
        expect(parseQueryString('')).toEqual({ page: 1, search: '', status: null, sortBy: 'name', sortOrder: 'asc' });
    });

    it('round-trips non-default filters', () => {
        const filters = { page: 3, search: 'nurse', status: 'green' as const, sortBy: 'updated' as const, sortOrder: 'desc' as const };
        expect(parseQueryString(buildQueryString(filters))).toEqual(filters);
    });
});
