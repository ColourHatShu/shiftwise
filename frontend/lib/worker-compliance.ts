/**
 * Worker Compliance Scoring Helpers
 * Pure functions for calculating compliance score and status colors
 * No state management or API calls - called from dashboard component
 */

export interface Document {
  id: string;
  fileName: string;
  docType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  expiryColor: 'green' | 'yellow' | 'red' | 'gray';
  uploadedAt: string;
  documentTypeId: string;
}

export interface DocumentType {
  id: string;
  name: string;
  isRequired: boolean;
  expiryWarningDays: number;
  hasExpiry: boolean;
}

/**
 * Calculate compliance score (0–100%) based on required documents.
 * Score = (completed_required / total_required) * 100
 *
 * @param documents Array of worker's uploaded documents
 * @param documentTypes Array of agency's configured document types
 * @returns { score, completed, required }
 */
export function calculateComplianceScore(
  documents: Document[],
  documentTypes: DocumentType[]
): { score: number; completed: number; required: number } {
  const requiredTypes = documentTypes.filter((dt) => dt.isRequired);
  const required = requiredTypes.length;

  if (required === 0) {
    return { score: 100, completed: 0, required: 0 };
  }

  // Count completed required documents (APPROVED and not expired)
  const completed = requiredTypes.filter((docType) => {
    const doc = documents.find(
      (d) => d.documentTypeId === docType.id && d.status === 'APPROVED'
    );
    if (!doc) return false;
    // Check if not expired
    if (!doc.expiryDate) return true; // No expiry = always valid
    if (doc.daysUntilExpiry === null) return true;
    return doc.daysUntilExpiry >= 0;
  }).length;

  const score = (completed / required) * 100;
  return { score, completed, required };
}

/**
 * Determine color-code for compliance status.
 * Red: score < 100 OR any doc < 30 days to expiry
 * Yellow: score = 100 AND at least one doc between 5–30 days
 * Green: score = 100 AND all docs > 30 days
 *
 * @param documents Array of worker's documents
 * @param score Compliance score (0-100)
 * @param requiredCount Total required documents
 * @returns 'red' | 'yellow' | 'green'
 */
export function getComplianceColor(
  documents: Document[],
  score: number,
  requiredCount: number
): 'red' | 'yellow' | 'green' {
  // Red: incomplete or any document < 5 days to expiry or expired
  if (score < 100) return 'red';

  const approvedDocs = documents.filter((d) => d.status === 'APPROVED' && d.expiryDate);

  for (const doc of approvedDocs) {
    if (!doc.daysUntilExpiry || doc.daysUntilExpiry < 0) return 'red'; // Expired
    if (doc.daysUntilExpiry < 5) return 'red'; // Critical
  }

  // Yellow: score = 100 AND at least one document between 5–30 days
  const hasWarning = approvedDocs.some(
    (d) => d.daysUntilExpiry && d.daysUntilExpiry >= 5 && d.daysUntilExpiry <= 30
  );
  if (hasWarning) return 'yellow';

  // Green: all conditions met
  return 'green';
}

/**
 * Human-readable message for compliance status.
 *
 * @param color Status color from getComplianceColor
 * @param score Compliance score (0-100)
 * @returns Friendly message string
 */
export function getComplianceMessage(
  color: 'red' | 'yellow' | 'green',
  score: number
): string {
  switch (color) {
    case 'red':
      return score === 0
        ? 'No documents submitted'
        : score < 50
        ? 'Multiple documents missing or expiring'
        : 'Some documents are expiring soon';
    case 'yellow':
      return 'Your compliance is up to date, but some documents are expiring soon';
    case 'green':
      return 'Your compliance is up to date';
    default:
      return 'Unable to determine compliance status';
  }
}

/**
 * Helper to check if a document is expired or expiring.
 *
 * @param document Single document
 * @returns 'expired' | 'critical' (< 5 days) | 'warning' (5–30 days) | 'safe' (> 30 days)
 */
export function getDocumentUrgency(
  document: Document
): 'expired' | 'critical' | 'warning' | 'safe' {
  if (!document.expiryDate || document.daysUntilExpiry === null) {
    return 'safe';
  }

  if (document.daysUntilExpiry < 0) return 'expired';
  if (document.daysUntilExpiry < 5) return 'critical';
  if (document.daysUntilExpiry <= 30) return 'warning';
  return 'safe';
}
