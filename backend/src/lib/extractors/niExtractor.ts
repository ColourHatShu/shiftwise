/**
 * niExtractor.ts
 * Extracts UK National Insurance number
 * Pattern: 2 letters, 6 digits, 1 letter (e.g. AB123456C)
 */

export interface NIExtractionResult {
  niNumber: string | null;
  documentType: string | null;
  confidence: number;
}

/**
 * Extract National Insurance number
 * Pattern: AA 99 99 99 A (2 letters, 6 digits, 1 letter, ignoring spacing)
 */
export function extractNINumber(ocrText: string): NIExtractionResult {
  // Remove spaces for matching, but the pattern is: 2 letters, 6 digits, 1 letter
  const cleanText = ocrText.replace(/\s/g, '');
  const niPattern = /\b([A-Z]{2}\d{6}[A-Z])\b/;
  const match = niPattern.exec(cleanText);

  const niNumber = match ? match[1] : null;

  // Check for NI document keywords
  const lowerText = ocrText.toLowerCase();
  const isNIDoc = lowerText.includes('national insurance') ||
                  lowerText.includes('ni number') ||
                  lowerText.includes('ni card') ||
                  lowerText.includes('national insurance number');

  return {
    niNumber,
    documentType: niNumber && isNIDoc ? 'NI_CARD' : null,
    confidence: niNumber ? 0.9 : (isNIDoc ? 0.4 : 0)
  };
}
