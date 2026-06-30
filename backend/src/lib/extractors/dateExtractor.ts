/**
 * dateExtractor.ts
 * Extracts dates in various UK formats from OCR'd text
 * Handles: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, and text month patterns
 */

export interface DateExtractionResult {
  issueDate: string | null;
  expiryDate: string | null;
  confidence: number;
}

/**
 * Parse a date string in various UK formats
 * Returns YYYY-MM-DD or null
 */
export function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();

  // Try DD/MM/YYYY
  const dmy1 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(trimmed);
  if (dmy1) {
    const [, d, m, y] = dmy1;
    const parsed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(parsed.getTime())) {
      return formatDate(parsed);
    }
  }

  // Try DD-MM-YYYY
  const dmy2 = /(\d{1,2})-(\d{1,2})-(\d{4})/.exec(trimmed);
  if (dmy2) {
    const [, d, m, y] = dmy2;
    const parsed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(parsed.getTime())) {
      return formatDate(parsed);
    }
  }

  // Try YYYY-MM-DD
  const ymd = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (ymd) {
    const [, y, m, d] = ymd;
    const parsed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(parsed.getTime())) {
      return formatDate(parsed);
    }
  }

  return null;
}

/**
 * Format a Date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Extract dates from OCR text
 * Looks for common patterns: "Issue Date", "Expiry Date", "Valid From", "Valid Until", etc.
 */
export function extractDates(ocrText: string): DateExtractionResult {
  const lines = ocrText.split('\n');

  let issueDate: string | null = null;
  let expiryDate: string | null = null;
  let foundIssue = false;
  let foundExpiry = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Look for issue date patterns
    if (!foundIssue && (
      lowerLine.includes('issue date') ||
      lowerLine.includes('issued') ||
      lowerLine.includes('valid from')
    )) {
      // Try to extract from this line or next
      let dateStr = extractDateFromLine(line);
      if (!dateStr && i + 1 < lines.length) {
        dateStr = extractDateFromLine(lines[i + 1]);
      }
      if (dateStr) {
        issueDate = parseDate(dateStr);
        foundIssue = !!issueDate;
      }
    }

    // Look for expiry date patterns
    if (!foundExpiry && (
      lowerLine.includes('expiry') ||
      lowerLine.includes('expires') ||
      lowerLine.includes('valid until') ||
      lowerLine.includes('valid to') ||
      lowerLine.includes('expiration')
    )) {
      let dateStr = extractDateFromLine(line);
      if (!dateStr && i + 1 < lines.length) {
        dateStr = extractDateFromLine(lines[i + 1]);
      }
      if (dateStr) {
        expiryDate = parseDate(dateStr);
        foundExpiry = !!expiryDate;
      }
    }
  }

  // Confidence: if both found, high; one found, medium; none, low
  const confidence = (foundIssue && foundExpiry) ? 0.9 : (foundIssue || foundExpiry) ? 0.6 : 0.2;

  return {
    issueDate,
    expiryDate,
    confidence
  };
}

/**
 * Extract any date pattern from a single line
 * Returns the first date-like string found
 */
function extractDateFromLine(line: string): string | null {
  // DD/MM/YYYY
  const m1 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(line);
  if (m1) return m1[0];

  // DD-MM-YYYY
  const m2 = /(\d{1,2})-(\d{1,2})-(\d{4})/.exec(line);
  if (m2) return m2[0];

  // YYYY-MM-DD
  const m3 = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(line);
  if (m3) return m3[0];

  return null;
}
