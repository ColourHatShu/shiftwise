const { rankSuggestedWorkers } = require('../../lib/rank-suggested-workers');

const mk = (firstName, lastName, confirmationRate, complianceScore = 100) => ({
    firstName,
    lastName,
    confirmationRate,
    complianceScore,
});

describe('rankSuggestedWorkers', () => {
    it('orders by confirmation rate descending', () => {
        const out = rankSuggestedWorkers([mk('A', 'A', 40), mk('B', 'B', 90), mk('C', 'C', 70)]);
        expect(out.map((w) => w.confirmationRate)).toEqual([90, 70, 40]);
    });

    it('places no-history (null rate) workers last', () => {
        const out = rankSuggestedWorkers([mk('New', 'Hire', null), mk('Solid', 'Worker', 55)]);
        expect(out.map((w) => `${w.firstName}`)).toEqual(['Solid', 'New']);
    });

    it('breaks equal rates by compliance score descending', () => {
        const out = rankSuggestedWorkers([mk('A', 'A', 80, 90), mk('B', 'B', 80, 100)]);
        expect(out.map((w) => w.complianceScore)).toEqual([100, 90]);
    });

    it('breaks full ties by name ascending', () => {
        const out = rankSuggestedWorkers([mk('Zoe', 'Z', 80, 100), mk('Amy', 'A', 80, 100)]);
        expect(out.map((w) => w.firstName)).toEqual(['Amy', 'Zoe']);
    });

    it('keeps two no-history workers stable-by-name (both null)', () => {
        const out = rankSuggestedWorkers([mk('Bob', 'B', null), mk('Ann', 'A', null)]);
        expect(out.map((w) => w.firstName)).toEqual(['Ann', 'Bob']);
    });

    it('does not mutate the input array', () => {
        const input = [mk('A', 'A', 10), mk('B', 'B', 90)];
        const snapshot = input.map((w) => w.confirmationRate);
        rankSuggestedWorkers(input);
        expect(input.map((w) => w.confirmationRate)).toEqual(snapshot);
    });
});
