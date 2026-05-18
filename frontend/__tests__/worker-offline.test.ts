/**
 * Unit tests for worker offline helpers
 */

import {
  cacheDocuments,
  getOfflineDocuments,
  queueUpload,
  clearQueuedUpload,
  retryQueuedUploads,
} from '@/lib/worker-offline';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('cacheDocuments', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores documents in localStorage', () => {
    const docs = [
      {
        id: '1',
        fileName: 'passport.pdf',
        docType: 'Passport',
        status: 'APPROVED' as const,
        expiryDate: new Date().toISOString(),
        daysUntilExpiry: 60,
        expiryColor: 'green' as const,
        uploadedAt: new Date().toISOString(),
      },
    ];

    cacheDocuments(docs);

    const cached = localStorage.getItem('worker_docs_cache');
    expect(cached).not.toBeNull();

    const parsed = JSON.parse(cached!);
    expect(parsed.documents).toEqual(docs);
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  it('includes expiry timestamp', () => {
    const docs: any[] = [];
    const before = Date.now();

    cacheDocuments(docs);

    const cached = JSON.parse(localStorage.getItem('worker_docs_cache')!);
    const after = Date.now();

    // Cache should expire 1 hour from now
    expect(cached.expiresAt).toBeGreaterThanOrEqual(before + 3600000);
    expect(cached.expiresAt).toBeLessThanOrEqual(after + 3600000);
  });
});

describe('getOfflineDocuments', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no cache exists', () => {
    const result = getOfflineDocuments();
    expect(result).toBeNull();
  });

  it('returns cached documents when valid', () => {
    const docs = [
      {
        id: '1',
        fileName: 'passport.pdf',
        docType: 'Passport',
        status: 'APPROVED' as const,
        expiryDate: new Date().toISOString(),
        daysUntilExpiry: 60,
        expiryColor: 'green' as const,
        uploadedAt: new Date().toISOString(),
      },
    ];

    cacheDocuments(docs);
    const result = getOfflineDocuments();

    expect(result).toEqual(docs);
  });

  it('returns null and clears cache when expired', () => {
    const docs: any[] = [];
    localStorage.setItem(
      'worker_docs_cache',
      JSON.stringify({
        documents: docs,
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      })
    );

    const result = getOfflineDocuments();

    expect(result).toBeNull();
    expect(localStorage.getItem('worker_docs_cache')).toBeNull();
  });

  it('handles malformed cache gracefully', () => {
    localStorage.setItem('worker_docs_cache', 'invalid json');

    const result = getOfflineDocuments();

    expect(result).toBeNull();
  });
});

describe('queueUpload', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('queues a file for retry', () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const docTypeId = 'dbs-check';

    const queueId = queueUpload(file, docTypeId);

    expect(queueId).toBeTruthy();
    expect(typeof queueId).toBe('string');
  });

  it('stores file data in localStorage (async)', async () => {
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const docTypeId = 'dbs-check';

    queueUpload(file, docTypeId);

    // Give async FileReader time to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const queued = localStorage.getItem('worker_uploads_queue');
    expect(queued).not.toBeNull();

    const parsed = JSON.parse(queued!);
    expect(parsed.fileName).toBe('test.pdf');
    expect(parsed.documentTypeId).toBe('dbs-check');
    expect(parsed.fileBase64).toContain('data:');
  });

  it('overwrites previous queue entry', async () => {
    const file1 = new File(['test1'], 'file1.pdf', { type: 'application/pdf' });
    const file2 = new File(['test2'], 'file2.pdf', { type: 'application/pdf' });

    queueUpload(file1, 'dbs-check');
    await new Promise((resolve) => setTimeout(resolve, 50));

    queueUpload(file2, 'passport');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const queued = JSON.parse(localStorage.getItem('worker_uploads_queue')!);
    expect(queued.fileName).toBe('file2.pdf');
    expect(queued.documentTypeId).toBe('passport');
  });
});

describe('clearQueuedUpload', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes queued upload from localStorage', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    queueUpload(file, 'dbs-check');

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(localStorage.getItem('worker_uploads_queue')).not.toBeNull();

    clearQueuedUpload();

    expect(localStorage.getItem('worker_uploads_queue')).toBeNull();
  });

  it('handles clearing when nothing is queued', () => {
    expect(() => clearQueuedUpload()).not.toThrow();
  });
});

describe('retryQueuedUploads', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns success when no queued uploads', async () => {
    const mockUploadFn = jest.fn();

    const result = await retryQueuedUploads(mockUploadFn);

    expect(result.success).toBe(true);
    expect(result.message).toBe('No queued uploads');
    expect(mockUploadFn).not.toHaveBeenCalled();
  });

  it('calls upload function with queued file', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const docTypeId = 'dbs-check';

    queueUpload(file, docTypeId);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockUploadFn = jest.fn().mockResolvedValue({ success: true });

    const result = await retryQueuedUploads(mockUploadFn);

    expect(mockUploadFn).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('clears queue after successful upload', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    queueUpload(file, 'dbs-check');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockUploadFn = jest.fn().mockResolvedValue({ success: true });
    await retryQueuedUploads(mockUploadFn);

    expect(localStorage.getItem('worker_uploads_queue')).toBeNull();
  });

  it('returns failure when upload fails', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    queueUpload(file, 'dbs-check');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockUploadFn = jest.fn().mockRejectedValue(new Error('Upload failed'));

    const result = await retryQueuedUploads(mockUploadFn);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Retry failed');
  });

  it('keeps queue intact on upload failure', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const docTypeId = 'dbs-check';

    queueUpload(file, docTypeId);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const queuedBefore = localStorage.getItem('worker_uploads_queue');

    const mockUploadFn = jest.fn().mockRejectedValue(new Error('Network error'));
    await retryQueuedUploads(mockUploadFn);

    const queuedAfter = localStorage.getItem('worker_uploads_queue');

    expect(queuedAfter).toBe(queuedBefore);
  });
});
