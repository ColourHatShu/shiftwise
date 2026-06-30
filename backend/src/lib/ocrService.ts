/**
 * ocrService.ts
 * Orchestrates Tesseract.js OCR and calls extractors
 * Singleton pattern for Tesseract worker (expensive to create)
 */

import { createWorker } from 'tesseract.js';
import { extractFromOCRText, ExtractorResult } from './extractors';
import * as fs from 'fs';

// Singleton worker instance (cached globally)
let tesseractWorker: any = null;
let workerInitialized = false;

/**
 * Initialize Tesseract worker (lazy initialization)
 */
async function initializeTesseract(): Promise<any> {
  if (workerInitialized && tesseractWorker) {
    return tesseractWorker;
  }

  try {
    console.log('[OCR] Initializing Tesseract worker...');
    tesseractWorker = await createWorker('eng');
    workerInitialized = true;
    console.log('[OCR] Tesseract worker ready');
    return tesseractWorker;
  } catch (error) {
    console.error('[OCR] Failed to initialize Tesseract:', error);
    throw error;
  }
}

/**
 * Recognize text from an image buffer
 */
async function recognizeImage(imageBuffer: Buffer): Promise<string> {
  try {
    const worker = await initializeTesseract();

    // Convert buffer to base64 for Tesseract
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log('[OCR] Running Tesseract recognition...');
    const result = await worker.recognize(dataUrl);

    return result.data.text;
  } catch (error) {
    console.error('[OCR] Recognition error:', error);
    throw error;
  }
}

/**
 * Cleanup Tesseract worker
 * Call at process shutdown
 */
export async function shutdownOCR(): Promise<void> {
  if (tesseractWorker) {
    try {
      console.log('[OCR] Terminating Tesseract worker...');
      await tesseractWorker.terminate();
      tesseractWorker = null;
      workerInitialized = false;
    } catch (error) {
      console.error('[OCR] Error shutting down Tesseract:', error);
    }
  }
}

export interface OCRAnalysisResult {
  ocrText: string;
  analysis: ExtractorResult;
  error?: string;
}

/**
 * Main entry point: OCR image and extract structured data
 */
export async function analyzeDocumentImage(
  imageBuffer: Buffer,
  workerName?: { firstName: string; lastName: string }
): Promise<OCRAnalysisResult> {
  try {
    // Step 1: OCR the image
    const ocrText = await recognizeImage(imageBuffer);

    if (!ocrText || ocrText.trim().length < 10) {
      return {
        ocrText: '',
        analysis: {
          documentType: null,
          expiryDate: null,
          issueDate: null,
          issuingAuthority: null,
          confidence: 0,
          summary: 'Could not extract text from image. Image may be unclear or blank.',
          concerns: ['Image is unreadable. Please upload a clearer image.']
        }
      };
    }

    console.log(`[OCR] Extracted ${ocrText.length} characters of text`);

    // Step 2: Extract structured data
    const analysis = await extractFromOCRText(ocrText, workerName);

    return {
      ocrText,
      analysis
    };
  } catch (error) {
    console.error('[OCR] Analysis error:', error);
    throw error;
  }
}

/**
 * Convert PDF to image buffer (if image library available)
 * This is a placeholder; actual PDF handling depends on existing codebase pattern
 */
export function isPDFBuffer(buffer: Buffer): boolean {
  // Check PDF magic number
  return buffer.length > 4 &&
         buffer[0] === 0x25 &&
         buffer[1] === 0x50 &&
         buffer[2] === 0x44 &&
         buffer[3] === 0x46;
}

// Export for testing
export function getTesseractWorker() {
  return tesseractWorker;
}

export function isTesseractReady() {
  return workerInitialized;
}
