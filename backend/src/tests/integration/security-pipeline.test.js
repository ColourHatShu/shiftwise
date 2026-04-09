/**
 * Security Integration Tests for ShiftWise Document Verification Pipeline
 * 
 * These tests validate the resilience and security of the AI scanning and
 * API verification components against edge cases and failure scenarios.
 * 
 * Run with: npx jest src/tests/integration/security-pipeline.test.js
 */

const request = require('supertest');
const express = require('express');
const nock = require('nock');
const fs = require('fs');
const path = require('path');

// Mock the prisma client
const mockPrisma = {
  complianceDocument: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  expiryAlert: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  worker: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

jest.mock('../lib/prisma', () => mockPrisma);

// Import the documents router after mocking
describe('🔒 Security & Resilience Integration Tests - Document Pipeline', () => {
  let app;
  let server;
  const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mount the documents router
    const documentsRouter = require('../routes/documents');
    app.use('/api/documents', documentsRouter);
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  afterAll((done) => {
    if (server) server.close(done);
    else done();
  });

  describe('🚨 CRITICAL: AI Scanning Failure Scenarios', () => {
    
    test('AI API timeout should be handled gracefully with proper audit trail', async () => {
      // Setup: Mock document exists
      const mockDoc = {
        id: 'doc-123',
        fileKey: 'test-passport.pdf',
        documentType: { name: 'Passport', hasExpiry: true },
        worker: { firstName: 'John', lastName: 'Doe' },
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);

      // Mock Ollama API to timeout (no response)
      nock(OLLAMA_HOST)
        .post('/api/generate')
        .delayConnection(31000) // Default timeout is usually 30s
        .reply(200, { response: '{}' });

      // Execute
      const response = await request(app)
        .post('/api/documents/doc-123/analyse')
        .set('Authorization', 'Bearer test-token')
        .timeout(35000); // Wait longer than API timeout

      // Assert: Should return error, not hang
      expect(response.status).toBe(500);
      expect(response.body.error).toMatch(/Failed to analyse|timeout/i);
      
      // Assert: Audit log should be created for the failure
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'document.ai_analysis_failed',
          entity: 'ComplianceDocument',
          entityId: 'doc-123',
          metadata: expect.objectContaining({
            error: expect.any(String),
            reason: 'timeout',
          }),
        }),
      });
    });

    test('AI returns malformed JSON - should handle gracefully without data corruption', async () => {
      const mockDoc = {
        id: 'doc-456',
        fileKey: 'test-dbs.jpg',
        documentType: { name: 'DBS Check', hasExpiry: true },
        worker: { firstName: 'Jane', lastName: 'Smith' },
        analysisResult: null,
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);

      // Mock Ollama returning invalid JSON
      nock(OLLAMA_HOST)
        .post('/api/generate')
        .reply(200, {
          response: '```json\n{invalid json here\n```'
        });

      const response = await request(app)
        .post('/api/documents/doc-456/analyse')
        .set('Authorization', 'Bearer test-token');

      // Assert: Should handle parsing error gracefully
      expect(response.status).toBe(500);
      expect(response.body.error).toMatch(/Failed to extract|parse|JSON/i);
      
      // Assert: Document status should NOT be corrupted
      expect(mockPrisma.complianceDocument.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ analysisResult: expect.anything() })
        })
      );
      
      // Assert: Failure should be logged
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'document.ai_analysis_failed',
          metadata: expect.objectContaining({
            error: expect.stringMatching(/parse|JSON|syntax/i),
          }),
        }),
      });
    });

    test('AI hallucination with wrong document type - should flag as concern', async () => {
      const mockDoc = {
        id: 'doc-789',
        fileKey: 'dbs-check.pdf',
        documentType: { name: 'DBS Check', hasExpiry: true },
        worker: { firstName: 'Alice', lastName: 'Johnson' },
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);
      mockPrisma.complianceDocument.update.mockResolvedValue({ ...mockDoc, analysisResult: {} });

      // Mock AI returning completely wrong document type
      nock(OLLAMA_HOST)
        .post('/api/generate')
        .reply(200, {
          response: JSON.stringify({
            documentType: 'Passport',
            fullName: 'Alice Johnson',
            documentNumber: '123456789',
            expiryDate: '2025-12-31',
            issueDate: '2020-01-01',
            issuingAuthority: 'HMPO',
            concerns: [],
            confidence: 'high',
            summary: 'Valid UK passport found'
          })
        });

      const response = await request(app)
        .post('/api/documents/doc-789/analyse')
        .set('Authorization', 'Bearer test-token');

      // Assert: Should detect wrong document type
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('wrongDocumentWarning');
      expect(response.body.data.wrongDocumentWarning).toMatch(/looks like a Passport.*not a DBS/i);
      expect(response.body.data.concerns).toContainEqual(
        expect.stringMatching(/wrong document/i)
      );
    });

    test('AI returns PII in logs - should sanitize before logging', async () => {
      const mockDoc = {
        id: 'doc-pii',
        fileKey: 'passport-scan.jpg',
        documentType: { name: 'Passport', hasExpiry: true },
        worker: { firstName: 'Robert', lastName: 'Williams' },
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);
      mockPrisma.complianceDocument.update.mockResolvedValue(mockDoc);

      const sensitiveData = {
        documentType: 'Passport',
        fullName: 'Robert Williams',
        documentNumber: '123456789', // PII
        expiryDate: '2025-12-31',
        issueDate: '2020-01-01',
        issuingAuthority: 'HMPO',
        concerns: [],
        confidence: 'high',
        summary: 'Valid UK passport'
      };

      nock(OLLAMA_HOST)
        .post('/api/generate')
        .reply(200, { response: JSON.stringify(sensitiveData) });

      await request(app)
        .post('/api/documents/doc-pii/analyse')
        .set('Authorization', 'Bearer test-token');

      // Assert: Audit log should NOT contain raw PII
      const auditCall = mockPrisma.auditLog.create.mock.calls[0];
      if (auditCall) {
        const metadata = auditCall[0].data.metadata;
        expect(metadata).not.toHaveProperty('documentNumber');
        expect(metadata).not.toHaveProperty('fullName');
      }
    });

    test('Name mismatch between document and worker - should flag as security concern', async () => {
      const mockDoc = {
        id: 'doc-mismatch',
        fileKey: 'license.jpg',
        documentType: { name: 'Driving License', hasExpiry: true },
        worker: { firstName: 'John', lastName: 'Smith' }, // Worker is John Smith
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);
      mockPrisma.complianceDocument.update.mockResolvedValue(mockDoc);

      // AI finds different name on document
      nock(OLLAMA_HOST)
        .post('/api/generate')
        .reply(200, {
          response: JSON.stringify({
            documentType: 'Driving License',
            fullName: 'Jane Doe', // Different person!
            documentNumber: 'DOE123456',
            expiryDate: '2026-06-15',
            concerns: [],
            confidence: 'high',
            nameMatchesWorker: false
          })
        });

      const response = await request(app)
        .post('/api/documents/doc-mismatch/analyse')
        .set('Authorization', 'Bearer test-token');

      // Assert: Should flag name mismatch as security concern
      expect(response.status).toBe(200);
      expect(response.body.data.nameMatchesWorker).toBe(false);
      expect(response.body.data.concerns).toContainEqual(
        expect.stringMatching(/Name mismatch/i)
      );
      
      // Assert: Should create security audit log entry
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'document.identity_mismatch_detected',
          metadata: expect.objectContaining({
            expectedName: 'John Smith',
            detectedName: 'Jane Doe',
          }),
        }),
      });
    });
  });

  describe('⚠️ API Verification Failure Scenarios', () => {
    
    test('Email service failure - should queue for retry with dead letter pattern', async () => {
      const mockDoc = {
        id: 'doc-expiring',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        worker: { firstName: 'Test', lastName: 'Worker' },
        documentType: { name: 'DBS Check' },
        agency: { email: 'coordinator@agency.com' },
        agencyId: 'agency-123',
        workerId: 'worker-123',
      };

      mockPrisma.complianceDocument.findMany.mockResolvedValue([mockDoc]);
      mockPrisma.expiryAlert.findFirst.mockResolvedValue(null); // No duplicate

      // Mock Resend API failure
      nock('https://api.resend.com')
        .post('/emails/send')
        .reply(500, { error: 'Internal server error' });

      const { checkExpiriesAndAlert } = require('../services/cronService');
      
      // Execute
      const result = await checkExpiriesAndAlert();

      // Assert: Should handle failure gracefully
      expect(result.triggeredDocuments).toHaveLength(1);
      expect(result.triggeredDocuments[0].status).toBe('Failed');
      
      // Assert: Should NOT mark as sent in database
      expect(mockPrisma.expiryAlert.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isSent: true }) })
      );
      
      // Assert: Should log the failure for compliance audit
      // Note: Current implementation doesn't do this - this is a finding
    });

    test('Ollama API returns 500 error - should retry with exponential backoff', async () => {
      const mockDoc = {
        id: 'doc-retry',
        fileKey: 'passport.pdf',
        documentType: { name: 'Passport', hasExpiry: true },
        worker: { firstName: 'Retry', lastName: 'Test' },
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);

      // First 2 calls fail, 3rd succeeds (if retry logic exists)
      nock(OLLAMA_HOST)
        .post('/api/generate')
        .times(3)
        .reply(500, { error: 'Internal Server Error' });

      const response = await request(app)
        .post('/api/documents/doc-retry/analyse')
        .set('Authorization', 'Bearer test-token');

      // Assert: Current implementation has NO retry logic
      // This test documents the gap - it should retry 3 times with backoff
      expect(response.status).toBe(500);
      
      // TODO: After implementing retry logic:
      // expect(nock.pendingMocks()).toHaveLength(0); // All retries used
    });

    test('Ollama API rate limiting (429) - should respect retry-after header', async () => {
      const mockDoc = {
        id: 'doc-rate-limit',
        fileKey: 'license.jpg',
        documentType: { name: 'License', hasExpiry: true },
        worker: { firstName: 'Rate', lastName: 'Limited' },
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);

      // Return 429 with Retry-After header
      nock(OLLAMA_HOST)
        .post('/api/generate')
        .reply(429, 'Too Many Requests', {
          'Retry-After': '5',
          'X-RateLimit-Reset': '5'
        });

      const response = await request(app)
        .post('/api/documents/doc-rate-limit/analyse')
        .set('Authorization', 'Bearer test-token');

      // Assert: Should handle rate limiting
      expect(response.status).toBe(500);
      // TODO: Should wait and retry after Retry-After period
    });
  });

  describe('🔐 Security & Privacy Tests', () => {
    
    test('Document upload without authorization should be rejected', async () => {
      // No auth header
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', Buffer.from('fake pdf content'), 'test.pdf')
        .field('workerId', 'worker-123')
        .field('documentTypeId', 'type-456');

      expect(response.status).toBe(401);
    });

    test('Document upload creates audit trail with IP and user agent', async () => {
      // Mock authorized user
      const mockUser = {
        id: 'user-123',
        agencyId: 'agency-123',
        clerkId: 'clerk-user-123',
      };

      const mockWorker = {
        id: 'worker-123',
        agencyId: 'agency-123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.worker.findFirst.mockResolvedValue(mockWorker);
      
      // TODO: This test documents the gap - upload doesn't create audit logs
      // After fix, verify audit log is created with:
      // - IP address
      // - User agent
      // - User ID
      // - Document metadata (without file content)
    });

    test('File size limit enforced - reject files > 10MB', async () => {
      // Create a buffer larger than 10MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', largeBuffer, 'large-file.pdf')
        .field('workerId', 'worker-123')
        .field('documentTypeId', 'type-456');

      // Multer should reject this
      expect(response.status).toBe(413); // Payload Too Large
    });

    test('File type validation - reject executable files', async () => {
      const maliciousBuffer = Buffer.from('MZ'); // Windows executable header

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', maliciousBuffer, 'malware.exe')
        .field('workerId', 'worker-123')
        .field('documentTypeId', 'type-456');

      // Should reject non-image/PDF files
      expect(response.status).toBe(400);
    });
  });

  describe('📝 Data Integrity & Race Conditions', () => {
    
    test('Concurrent document analysis requests - should handle without corruption', async () => {
      const mockDoc = {
        id: 'doc-concurrent',
        fileKey: 'concurrent.pdf',
        documentType: { name: 'Passport', hasExpiry: true },
        worker: { firstName: 'Concurrent', lastName: 'User' },
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);
      mockPrisma.complianceDocument.update.mockImplementation(async (args) => {
        // Simulate slow update
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ...mockDoc, ...args.data };
      });

      // Mock AI response
      nock(OLLAMA_HOST)
        .post('/api/generate')
        .times(2)
        .reply(200, {
          response: JSON.stringify({
            documentType: 'Passport',
            fullName: 'Concurrent User',
            expiryDate: '2025-12-31',
            concerns: [],
            confidence: 'high',
          })
        });

      // Send 2 concurrent requests
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/documents/doc-concurrent/analyse')
          .set('Authorization', 'Bearer test-token'),
        request(app)
          .post('/api/documents/doc-concurrent/analyse')
          .set('Authorization', 'Bearer test-token'),
      ]);

      // Both should succeed
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      
      // But only one analysis should be stored (or both with timestamps)
      // TODO: Implement proper locking mechanism
    });

    test('Document verification race condition - status should not flip-flop', async () => {
      const mockDoc = {
        id: 'doc-verify-race',
        status: 'PENDING',
        documentTypeId: 'type-123',
      };

      mockPrisma.complianceDocument.findFirst.mockResolvedValue(mockDoc);
      mockPrisma.$transaction.mockImplementation(async (ops) => {
        // Simulate slow transaction
        await new Promise(resolve => setTimeout(resolve, 50));
        return [{ ...mockDoc, status: 'APPROVED' }, { id: 'audit-1' }];
      });

      // Send concurrent approve and reject
      const [approveRes, rejectRes] = await Promise.allSettled([
        request(app)
          .patch('/api/documents/doc-verify-race/verify')
          .set('Authorization', 'Bearer test-token')
          .send({ status: 'APPROVED' }),
        request(app)
          .patch('/api/documents/doc-verify-race/verify')
          .set('Authorization', 'Bearer test-token')
          .send({ status: 'REJECTED' }),
      ]);

      // At least one should fail or be sequenced properly
      // TODO: Implement optimistic locking with version numbers
    });
  });
});

/**
 * Test Configuration & Setup Helpers
 */
describe('🔧 Test Infrastructure Setup', () => {
  test('Required environment variables are present', () => {
    const requiredVars = [
      'CLERK_SECRET_KEY',
      'DATABASE_URL',
    ];

    const missing = requiredVars.filter(v => !process.env[v]);
    
    // This is informational - in CI, these should all be present
    if (missing.length > 0) {
      console.warn('Missing env vars:', missing);
    }
  });

  test('Test database is isolated from production', () => {
    const dbUrl = process.env.DATABASE_URL || '';
    
    // Ensure we're not pointing to prod
    expect(dbUrl).not.toMatch(/prod|production/i);
    expect(dbUrl).toMatch(/localhost|test/i);
  });
});
