/**
 * documentTypeDetector.ts
 * Detects document type based on keywords and patterns in OCR text
 */

export interface DocumentTypeDetectionResult {
  documentType: string | null;
  confidence: number;
}

export type DetectedDocumentType =
  | 'DBS_CERTIFICATE'
  | 'RIGHT_TO_WORK'
  | 'TRAINING_CERT'
  | 'PASSPORT'
  | 'NI_CARD'
  | 'IMMUNISATION'
  | 'REFERENCE'
  | 'OTHER';

/**
 * Detect document type from OCR text
 */
export function detectDocumentType(ocrText: string): DocumentTypeDetectionResult {
  const lowerText = ocrText.toLowerCase();
  const confidence: Record<DetectedDocumentType, number> = {
    DBS_CERTIFICATE: 0,
    RIGHT_TO_WORK: 0,
    TRAINING_CERT: 0,
    PASSPORT: 0,
    NI_CARD: 0,
    IMMUNISATION: 0,
    REFERENCE: 0,
    OTHER: 0
  };

  // DBS Detection
  if (lowerText.includes('dbs') || lowerText.includes('disclosure') || lowerText.includes('barring')) {
    confidence.DBS_CERTIFICATE = 0.95;
  }

  // Right to Work Detection
  if (lowerText.includes('right to work') ||
      lowerText.includes('immigration') ||
      lowerText.includes('visa') ||
      lowerText.includes('settled status') ||
      lowerText.includes('points based')) {
    confidence.RIGHT_TO_WORK = 0.9;
  }

  // Passport Detection
  if (lowerText.includes('passport') ||
      lowerText.includes('british passport') ||
      lowerText.includes('united kingdom passport')) {
    confidence.PASSPORT = 0.95;
  }

  // NI Card Detection
  if (lowerText.includes('national insurance') ||
      lowerText.includes('ni card') ||
      lowerText.includes('ni number')) {
    confidence.NI_CARD = 0.9;
  }

  // Training Certificate Detection
  if (lowerText.includes('training') ||
      lowerText.includes('certificate') ||
      lowerText.includes('certified') ||
      lowerText.includes('completion') ||
      lowerText.includes('course')) {
    // Elevate only if no other specific type was detected
    if (Math.max(...Object.values(confidence)) < 0.5) {
      confidence.TRAINING_CERT = 0.7;
    }
  }

  // Immunisation Detection
  if (lowerText.includes('vaccine') ||
      lowerText.includes('immunisation') ||
      lowerText.includes('immunization') ||
      lowerText.includes('vaccination')) {
    confidence.IMMUNISATION = 0.85;
  }

  // Reference Detection
  if (lowerText.includes('reference') && lowerText.includes('employment')) {
    confidence.REFERENCE = 0.8;
  }

  // Find the highest confidence type
  let bestType: DetectedDocumentType | null = null;
  let bestConfidence = 0;

  for (const [type, conf] of Object.entries(confidence)) {
    if (conf > bestConfidence) {
      bestConfidence = conf;
      bestType = type as DetectedDocumentType;
    }
  }

  // If no strong match, mark as OTHER
  if (bestConfidence < 0.5) {
    return { documentType: 'OTHER', confidence: 0 };
  }

  return { documentType: bestType, confidence: bestConfidence };
}
