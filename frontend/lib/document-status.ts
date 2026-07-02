/**
 * Derive a document's display status from its stored status + expiry date.
 *
 * The backend flips APPROVED→EXPIRED nightly, but between the moment a document
 * lapses and that job running (up to ~24h) its status is still APPROVED — so the
 * UI must date-check itself. An already-lapsed doc must read EXPIRED (red), not
 * EXPIRING_SOON (amber): "expiring soon" for something already expired is
 * misleading in a compliance tool.
 *
 * Returns: "NOT_UPLOADED" | "EXPIRED" | "EXPIRING_SOON" | the raw status.
 */
export function computeDocumentStatus(
    doc: { status?: string | null; expiryDate?: string | Date | null } | null
): string {
    if (!doc) return "NOT_UPLOADED";
    if (doc.status === "EXPIRED") return "EXPIRED";

    if (doc.expiryDate && doc.status === "APPROVED") {
        const exp = new Date(doc.expiryDate);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (exp < startOfToday) return "EXPIRED"; // lapsed but status not yet flipped
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        if (exp <= in30) return "EXPIRING_SOON";
    }

    return doc.status ?? "NOT_UPLOADED";
}
