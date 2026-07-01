/**
 * Rule-based ordering for the shift-matcher's suggested workers.
 *
 * Pure + deterministic so the ranking rule lives in ONE place, is unit-testable,
 * and can be tuned without touching the route. The default rule (tune on founder
 * preference — this is the single spot to change, and where distance/skills/
 * rotation would be layered in):
 *   1) confirmation rate (reliability) descending — workers with no history (null) rank last
 *   2) then compliance score descending
 *   3) then name ascending (stable, human-friendly tie-break)
 *
 * Does not mutate the input array.
 *
 * @param {Array<{ firstName: string, lastName: string, complianceScore: number, confirmationRate: number|null }>} candidates
 * @returns {Array} the same objects, ordered best-first
 */
function rankSuggestedWorkers(candidates) {
    return [...candidates].sort((a, b) => {
        if (a.confirmationRate !== b.confirmationRate) {
            if (a.confirmationRate === null) return 1;
            if (b.confirmationRate === null) return -1;
            return b.confirmationRate - a.confirmationRate;
        }
        if (b.complianceScore !== a.complianceScore) return b.complianceScore - a.complianceScore;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
}

module.exports = { rankSuggestedWorkers };
