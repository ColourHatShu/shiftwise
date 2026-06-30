/**
 * mrzExtractor.ts
 * Extracts Machine Readable Zone (MRZ) data from passports
 * MRZ appears on passport, lines 2-3 contain name and document number
 */

export interface MRZExtractionResult {
  documentNumber: string | null;
  surName: string | null;
  givenNames: string | null;
  documentType: string | null;
  confidence: number;
}

/**
 * Extract MRZ data from passport
 * Passports have MRZ on lines 2-3 after the first line
 * Line 2: Document type (P for passport), country, surname, etc.
 * Line 3: Document number, nationality, date of birth, sex, expiry, etc.
 */
export function extractMRZ(ocrText: string): MRZExtractionResult {
  const lines = ocrText.split('\n');

  // Look for passport indicators
  const lowerText = ocrText.toLowerCase();
  const isPassport = lowerText.includes('passport') ||
                     lowerText.includes('united kingdom') ||
                     lowerText.includes('british passport');

  let documentNumber: string | null = null;
  let surName: string | null = null;
  let givenNames: string | null = null;

  // Search for MRZ pattern: line starting with P< (passport marker)
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1].trim();

    // MRZ line 2 starts with P< for passports
    if (line.startsWith('P<') || line.startsWith('P<')) {
      // Extract surname and given names from MRZ line 2
      // Format: P<CTRY<SURNAME<<GIVEN NAMES<<<<
      const parts = line.split('<<');
      if (parts.length >= 2) {
        // First part contains country and surname
        const countryAndName = parts[0];
        const match = /P<[A-Z]{3}(.+)/.exec(countryAndName);
        if (match) {
          surName = match[1].trim().replace(/[<]/g, '');
        }
        // Second part is given names
        givenNames = parts[1].trim().replace(/[<]/g, '');
      }

      // MRZ line 3 has document number (9 characters, typically)
      if (nextLine && nextLine.length >= 9) {
        documentNumber = nextLine.substring(0, 9).replace(/[<]/g, '');
      }

      if (documentNumber || surName) {
        break;
      }
    }
  }

  // Alternative: look for document number pattern (9 alphanumeric characters)
  if (!documentNumber) {
    const docPattern = /([A-Z0-9]{9})(?:\s|$)/;
    const match = docPattern.exec(ocrText);
    if (match) {
      documentNumber = match[1];
    }
  }

  const confidence = (documentNumber && surName) ? 0.9 : (documentNumber || surName) ? 0.6 : (isPassport ? 0.2 : 0);

  return {
    documentNumber,
    surName,
    givenNames,
    documentType: (documentNumber || surName) && isPassport ? 'PASSPORT' : null,
    confidence
  };
}
