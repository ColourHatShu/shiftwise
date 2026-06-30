/**
 * confidenceScorer.ts
 * Computes overall confidence score based on extractor results
 * Factors: keyword presence, format matches, text length, completeness
 */

export interface ScoringFactors {
  hasDocumentType: boolean;
  hasExpiryDate: boolean;
  hasIssueDate: boolean;
  hasDocumentNumber: boolean;
  hasName: boolean;
  ocrTextLength: number;
  keywordMatches: number;
}

/**
 * Compute overall confidence score (0.0 - 1.0)
 * Based on presence of key extracted data and text quality
 */
export function computeConfidenceScore(factors: ScoringFactors): number {
  let score = 0;
  let maxScore = 0;

  // Document type: 20 points
  if (factors.hasDocumentType) score += 20;
  maxScore += 20;

  // Expiry date: 25 points (crucial for compliance)
  if (factors.hasExpiryDate) score += 25;
  maxScore += 25;

  // Issue date: 15 points
  if (factors.hasIssueDate) score += 15;
  maxScore += 15;

  // Document number: 20 points
  if (factors.hasDocumentNumber) score += 20;
  maxScore += 20;

  // Name extracted: 10 points
  if (factors.hasName) score += 10;
  maxScore += 10;

  // OCR text quality: up to 10 points
  // Longer text = likely better OCR
  const textQualityScore = Math.min(10, Math.max(0, (factors.ocrTextLength / 500) * 10));
  score += textQualityScore;
  maxScore += 10;

  // Normalize to 0.0 - 1.0
  const normalized = Math.max(0, Math.min(1, score / maxScore));

  // Clamp to two decimal places
  return Math.round(normalized * 100) / 100;
}

/**
 * Determine confidence label from score
 */
export function scoreToLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}
