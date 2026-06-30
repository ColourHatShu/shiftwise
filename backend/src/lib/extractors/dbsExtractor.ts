/**
 * dbsExtractor.ts
 * Extracts DBS (Disclosure and Barring Service) certificate information
 * UK DBS cert format: NNNNNNNNNNNN (6 digits + 2 letters + 6 digits)
 */

export interface DBSExtractionResult {
  certificateNumber: string | null;
  documentType: string | null;
  confidence: number;
}

/**
 * Extract DBS certificate number
 * Pattern: 6 digits, 2 uppercase letters, 6 digits
 * Example: 123456AB789012
 */
export function extractDBSCertificate(ocrText: string): DBSExtractionResult {
  const certificatePattern = /\b(\d{6}[A-Z]{2}\d{6})\b/;
  const match = certificatePattern.exec(ocrText);

  const certificateNumber = match ? match[1] : null;

  // Check if text contains DBS keywords
  const lowerText = ocrText.toLowerCase();
  const isDBS = lowerText.includes('dbs') ||
                lowerText.includes('disclosure') ||
                lowerText.includes('barring') ||
                lowerText.includes('certificate');

  return {
    certificateNumber,
    documentType: certificateNumber && isDBS ? 'DBS_CERTIFICATE' : null,
    confidence: certificateNumber ? 0.95 : (isDBS ? 0.3 : 0)
  };
}
