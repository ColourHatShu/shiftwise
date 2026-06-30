/**
 * Worker Offline Support Helpers
 * localStorage-based caching, upload queuing, and retry logic
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
  rejectionReason?: string;
  // Optional in the offline-cache shape because legacy cached entries
  // may not have it; required in the live API consumer.
  documentTypeId?: string;
}

/**
 * Cache document list in localStorage.
 * Expires after 1 hour.
 *
 * @param documents Array of documents to cache
 */
export function cacheDocuments(documents: Document[]): void {
  try {
    const cacheData = {
      documents,
      timestamp: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    };
    localStorage.setItem('worker_docs_cache', JSON.stringify(cacheData));
  } catch (err) {
    console.warn('[Offline Cache] Failed to cache documents:', err);
  }
}

/**
 * Retrieve cached document list if valid (not expired).
 *
 * @returns Document[] or null if cache expired/missing
 */
export function getOfflineDocuments(): Document[] | null {
  try {
    const cached = localStorage.getItem('worker_docs_cache');
    if (!cached) return null;

    const { documents, expiresAt } = JSON.parse(cached);
    if (Date.now() > expiresAt) {
      localStorage.removeItem('worker_docs_cache');
      return null;
    }
    return documents;
  } catch (err) {
    console.warn('[Offline Cache] Failed to retrieve cached documents:', err);
    return null;
  }
}

/**
 * Queue a failed upload for retry.
 * Max 1 queued upload (overwrites previous if exists).
 *
 * @param file File to queue
 * @param documentTypeId Document type ID
 * @returns queueId (uuid)
 */
export function queueUpload(file: File, documentTypeId: string): string {
  const queueId = generateUUID();

  try {
    const reader = new FileReader();
    reader.onload = () => {
      const queueData = {
        id: queueId,
        fileName: file.name,
        fileBase64: reader.result as string,
        documentTypeId,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem('worker_uploads_queue', JSON.stringify(queueData));
        console.log('[Upload Queue] Queued upload:', queueId);
      } catch (err) {
        console.warn('[Upload Queue] Failed to queue upload:', err);
      }
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.warn('[Upload Queue] Error reading file for queuing:', err);
  }

  return queueId;
}

/**
 * Clear queued upload after successful retry.
 */
export function clearQueuedUpload(): void {
  try {
    localStorage.removeItem('worker_uploads_queue');
    console.log('[Upload Queue] Cleared queued upload');
  } catch (err) {
    console.warn('[Upload Queue] Failed to clear queue:', err);
  }
}

/**
 * Poll for queued upload and retry when online.
 *
 * @param uploadFunction Async function that takes FormData and returns Promise
 * @returns { success: boolean; message: string }
 */
export async function retryQueuedUploads(
  uploadFunction: (formData: FormData) => Promise<any>
): Promise<{ success: boolean; message: string }> {
  try {
    const queued = localStorage.getItem('worker_uploads_queue');
    if (!queued) return { success: true, message: 'No queued uploads' };

    const { fileName, fileBase64, documentTypeId } = JSON.parse(queued);

    try {
      const file = base64ToFile(fileBase64, fileName);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentTypeId', documentTypeId);

      await uploadFunction(formData);
      clearQueuedUpload();
      console.log('[Upload Queue] Retry successful');
      return { success: true, message: 'Cached upload complete!' };
    } catch (uploadErr) {
      console.warn('[Upload Queue] Retry failed:', uploadErr);
      return { success: false, message: `Retry failed: ${(uploadErr as any).message}` };
    }
  } catch (err) {
    console.warn('[Upload Queue] Error during retry:', err);
    return { success: false, message: 'Failed to process queued upload' };
  }
}

/**
 * Monitor online/offline status and trigger retry callback when connection is restored.
 * Call once on component mount.
 *
 * @param retryCallback Function to call when connection restored
 * @returns Cleanup function to remove event listeners
 */
export function startOfflineMonitoring(retryCallback: () => void): () => void {
  const handleOnline = () => {
    console.log('[Offline Monitor] Connection restored');
    retryCallback();
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => window.removeEventListener('online', handleOnline);
}

/**
 * Generate a UUID v4 string.
 *
 * @returns UUID string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Convert base64 data URL back to File object.
 *
 * @param base64 Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @param fileName Original file name
 * @returns File object
 */
function base64ToFile(base64: string, fileName: string): File {
  try {
    const arr = base64.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }

    return new File([u8arr], fileName, { type: mime });
  } catch (err) {
    console.error('[Offline Cache] Failed to convert base64 to file:', err);
    throw err;
  }
}
