/**
 * Single source of truth for how a worker's shift-confirmation rate maps to
 * a label + colour. Used by the scorecards page, the worker-profile reliability
 * panel, and anywhere else reliability is shown, so the thresholds never drift.
 *
 * Thresholds: green ≥ 80, amber ≥ 50, red below, grey for "no history" (null).
 */
export function reliabilityRateStyle(rate: number | null): {
    label: string;
    badgeClass: string;
    textClass: string;
} {
    if (rate === null) {
        // #52627E (not the lighter #5B6E8C) so the grey badge clears WCAG AA (4.5:1) on #EBEEF5.
        return { label: "—", badgeClass: "bg-[#EBEEF5] text-[#52627E]", textClass: "text-[#52627E]" };
    }
    const label = `${rate}%`;
    if (rate >= 80) return { label, badgeClass: "bg-[#DCFCE7] text-[#166534]", textClass: "text-[#166534]" };
    if (rate >= 50) return { label, badgeClass: "bg-[#FEF3C7] text-[#92400E]", textClass: "text-[#92400E]" };
    return { label, badgeClass: "bg-[#FEE2E2] text-[#991B1B]", textClass: "text-[#991B1B]" };
}
