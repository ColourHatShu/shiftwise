/**
 * extractors/index.ts
 * Orchestrates all extractors based on document type
 */

import { extractDates } from './dateExtractor';
import { extractDBSCertificate } from './dbsExtractor';
import { extractNINumber } from './niExtractor';
import { extractMRZ } from './mrzExtractor';
import { detectDocumentType } from './documentTypeDetector';
import { computeConfidenceScore, scoreToLabel, ScoringFactors } from './confidenceScorer';

export interface ExtractorResult {
  documentType: string | null;
  expiryDate: string | null;
  issueDate: string | null;
  issuingAuthority: string | null;
  confidence: number;
  summary: string;
  concerns: string[];
  nameMatchesWorker?: boolean;
  wrongDocumentWarning?: string | null;
}

/**
 * Extract all data from OCR'd text
 */
export async function extractFromOCRText(
  ocrText: string,
  workerName?: { firstName: string; lastName: string }
): Promise<ExtractorResult> {
  const concerns: string[] = [];

  // Detect document type
  const { documentType, confidence: docTypeConfidence } = detectDocumentType(ocrText);

  // Extract dates
  const { issueDate, expiryDate, confidence: dateConfidence } = extractDates(ocrText);

  // Extract document-specific data
  let documentNumber: string | null = null;
  let fullName: string | null = null;
  let issuingAuthority: string | null = null;

  if (documentType === 'DBS_CERTIFICATE') {
    const dbs = extractDBSCertificate(ocrText);
    documentNumber = dbs.certificateNumber;
    issuingAuthority = 'Disclosure and Barring Service';
  } else if (documentType === 'NI_CARD') {
    const ni = extractNINumber(ocrText);
    documentNumber = ni.niNumber;
    issuingAuthority = 'UK National Insurance';
  } else if (documentType === 'PASSPORT') {
    const mrz = extractMRZ(ocrText);
    documentNumber = mrz.documentNumber;
    fullName = mrz.givenNames && mrz.surName
      ? `${mrz.givenNames} ${mrz.surName}`
      : null;
    issuingAuthority = 'UK Passport Office';
  }

  // Check name match if we extracted a name
  let nameMatchesWorker = false;
  if (fullName && workerName) {
    const workerFullName = `${workerName.firstName} ${workerName.lastName}`.toLowerCase();
    const extractedNameLower = fullName.toLowerCase();
    nameMatchesWorker = extractedNameLower.includes(workerName.firstName.toLowerCase()) ||
                        extractedNameLower.includes(workerName.lastName.toLowerCase());
  }

  // Build concerns list
  if (!expiryDate) {
    concerns.push('Could not extract expiry date. Manual review recommended.');
  }
  if (documentNumber && !documentNumber.match(/^[A-Z0-9]+$/)) {
    concerns.push('Extracted document number appears malformed.');
  }
  if (!documentType || documentType === 'OTHER') {
    concerns.push('Document type could not be determined. Please verify this is the correct document.');
  }

  // Compute confidence score
  const scoringFactors: ScoringFactors = {
    hasDocumentType: !!documentType && documentType !== 'OTHER',
    hasExpiryDate: !!expiryDate,
    hasIssueDate: !!issueDate,
    hasDocumentNumber: !!documentNumber,
    hasName: !!fullName,
    ocrTextLength: ocrText.length,
    keywordMatches: detectKeywordMatches(ocrText)
  };

  const confidence = computeConfidenceScore(scoringFactors);
  const confidenceLabel = scoreToLabel(confidence);

  // Build summary
  const summary = buildSummary({
    documentType,
    expiryDate,
    issueDate,
    documentNumber,
    confidence: confidenceLabel,
    concerns
  });

  return {
    documentType,
    expiryDate,
    issueDate,
    issuingAuthority,
    confidence,
    summary,
    concerns,
    nameMatchesWorker
  };
}

/**
 * Count keyword matches for scoring
 */
function detectKeywordMatches(text: string): number {
  const lowerText = text.toLowerCase();
  const keywords = [
    'certificate', 'check', 'passport', 'visa', 'training',
    'issued', 'expires', 'valid', 'authority', 'dated',
    'number', 'reference', 'date of birth', 'signature'
  ];

  return keywords.filter(kw => lowerText.includes(kw)).length;
}

/**
 * Build human-readable summary
 */
function buildSummary(data: {
  documentType: string | null;
  expiryDate: string | null;
  issueDate: string | null;
  documentNumber: string | null;
  confidence: string;
  concerns: string[];
}): string {
  if (!data.documentType || data.documentType === 'OTHER') {
    return 'Document type could not be determined. Manual review required.';
  }

  let summary = `${data.documentType.replace(/_/g, ' ')} extracted`;

  if (data.expiryDate) {
    summary += ` with expiry ${data.expiryDate}`;
  }

  if (data.documentNumber) {
    summary += ` (Ref: ${data.documentNumber})`;
  }

  summary += ` (${data.confidence} confidence)`;

  if (data.concerns.length > 0) {
    summary += `. ${data.concerns[0]}`;
  }

  return summary;
}
