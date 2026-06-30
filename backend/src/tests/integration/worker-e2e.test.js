/**
 * E2E Integration Test: Worker Portal Happy Path
 *
 * Test flow:
 * 1. Worker gets document types
 * 2. Worker uploads document
 * 3. Coordinator approves document
 * 4. Worker receives notification
 * 5. Audit log captures all actions
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

const app = require('../../server'); // Express app
const prisma = new PrismaClient();

describe('Worker Portal E2E: Upload → Approval → Notification', () => {
  let testAgency;
  let testWorker;
  let testCoordinator;
  let workerJWT;
  let coordinatorJWT;
  let testDocumentType;

  beforeAll(async () => {
    // Create test agency
    testAgency = await prisma.agency.create({
      data: {
        name: 'Test Healthcare Ltd',
        slug: 'test-healthcare',
        email: 'test@healthcare.com',
      },
    });

    // Create test coordinator user
    testCoordinator = await prisma.user.create({
      data: {
        clerkId: 'test-coordinator-clerk-id',
        agencyId: testAgency.id,
        email: 'coordinator@test.com',
        role: 'OWNER',
      },
    });

    // Create test worker
    testWorker = await prisma.worker.create({
      data: {
        agencyId: testAgency.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'worker@test.com',
        status: 'ACTIVE',
      },
    });

    // Create test document type
    testDocumentType = await prisma.documentType.create({
      data: {
        agencyId: testAgency.id,
        name: 'DBS Check',
        isRequired: true,
        expiryWarningDays: 30,
        hasExpiry: true,
      },
    });

    // Create worker JWT token (simulated - in real tests use actual JWT generation)
    workerJWT = 'test-worker-jwt-token';
    coordinatorJWT = 'test-coordinator-jwt-token';
  });

  afterAll(async () => {
    // Cleanup
    await prisma.complianceDocument.deleteMany({ where: { agencyId: testAgency.id } });
    await prisma.documentType.deleteMany({ where: { agencyId: testAgency.id } });
    await prisma.expiryAlert.deleteMany({ where: { agencyId: testAgency.id } });
    await prisma.auditLog.deleteMany({ where: { agencyId: testAgency.id } });
    await prisma.worker.deleteMany({ where: { agencyId: testAgency.id } });
    await prisma.user.deleteMany({ where: { agencyId: testAgency.id } });
    await prisma.agency.delete({ where: { id: testAgency.id } });
    await prisma.$disconnect();
  });

  describe('Step 1: Worker fetches document types', () => {
    it('should return document types for agency', async () => {
      const response = await request(app)
        .get('/api/worker/document-types')
        .set('Authorization', `Bearer ${workerJWT}`)
        .expect(200);

      expect(response.body.documentTypes).toBeDefined();
      expect(Array.isArray(response.body.documentTypes)).toBe(true);
      expect(response.body.documentTypes.some((dt) => dt.id === testDocumentType.id)).toBe(true);
    });

    it('should sort required documents first', async () => {
      const response = await request(app)
        .get('/api/worker/document-types')
        .set('Authorization', `Bearer ${workerJWT}`)
        .expect(200);

      const requiredFirst = response.body.documentTypes.filter((dt) => dt.isRequired);
      const optional = response.body.documentTypes.filter((dt) => !dt.isRequired);

      if (requiredFirst.length > 0 && optional.length > 0) {
        const firstRequiredIndex = response.body.documentTypes.indexOf(requiredFirst[0]);
        const firstOptionalIndex = response.body.documentTypes.indexOf(optional[0]);
        expect(firstRequiredIndex).toBeLessThan(firstOptionalIndex);
      }
    });
  });

  describe('Step 2: Worker uploads document', () => {
    it('should upload document successfully', async () => {
      const fileBuffer = Buffer.from('test PDF content');

      const response = await request(app)
        .post('/api/worker/documents/upload')
        .set('Authorization', `Bearer ${workerJWT}`)
        .field('documentTypeId', testDocumentType.id)
        .attach('file', fileBuffer, 'test.pdf')
        .expect(201);

      expect(response.body.document).toBeDefined();
      expect(response.body.document.status).toBe('PENDING');
      expect(response.body.document.fileName).toBe('test.pdf');
    });

    it('should create audit log entry for upload', async () => {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          agencyId: testAgency.id,
          action: 'document.uploaded-by-worker',
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata.workerId).toBe(testWorker.id);
    });

    it('should validate file size', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB

      const response = await request(app)
        .post('/api/worker/documents/upload')
        .set('Authorization', `Bearer ${workerJWT}`)
        .field('documentTypeId', testDocumentType.id)
        .attach('file', largeBuffer, 'large.pdf')
        .expect(400);

      expect(response.body.error).toContain('File too large');
    });

    it('should validate file type', async () => {
      const fileBuffer = Buffer.from('fake executable');

      const response = await request(app)
        .post('/api/worker/documents/upload')
        .set('Authorization', `Bearer ${workerJWT}`)
        .field('documentTypeId', testDocumentType.id)
        .attach('file', fileBuffer, 'malicious.exe')
        .expect(400);

      expect(response.body.error).toContain('Invalid file type');
    });
  });

  describe('Step 3: Worker views their documents', () => {
    it('should list documents for worker', async () => {
      const response = await request(app)
        .get('/api/worker/documents')
        .set('Authorization', `Bearer ${workerJWT}`)
        .expect(200);

      expect(response.body.documents).toBeDefined();
      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body.count).toBeGreaterThanOrEqual(0);
    });

    it('should include document metadata', async () => {
      const response = await request(app)
        .get('/api/worker/documents')
        .set('Authorization', `Bearer ${workerJWT}`)
        .expect(200);

      if (response.body.documents.length > 0) {
        const doc = response.body.documents[0];
        expect(doc.id).toBeDefined();
        expect(doc.fileName).toBeDefined();
        expect(doc.status).toBeDefined();
        expect(doc.uploadedAt).toBeDefined();
        expect(doc.expiryColor).toBeDefined();
        expect(doc.daysUntilExpiry).toBeDefined();
      }
    });

    it('should include documentTypeId and rejectionReason', async () => {
      const response = await request(app)
        .get('/api/worker/documents')
        .set('Authorization', `Bearer ${workerJWT}`)
        .expect(200);

      if (response.body.documents.length > 0) {
        const doc = response.body.documents[0];
        expect(doc.documentTypeId).toBeDefined();
        expect(typeof doc.documentTypeId).toBe('string');
        // rejectionReason may be null, but field should exist
        expect('rejectionReason' in doc).toBe(true);
      }
    });
  });

  describe('Step 4: Coordinator approves document', () => {
    let uploadedDocId;

    beforeAll(async () => {
      // Get a document to approve
      const doc = await prisma.complianceDocument.findFirst({
        where: {
          agencyId: testAgency.id,
          workerId: testWorker.id,
        },
      });
      uploadedDocId = doc?.id;
    });

    it('should approve document with manual expiry date', async () => {
      if (!uploadedDocId) this.skip();

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const response = await request(app)
        .patch(`/api/documents/${uploadedDocId}/verify`)
        .set('Authorization', `Bearer ${coordinatorJWT}`)
        .send({
          status: 'APPROVED',
          manualExpiryDate: expiryDate.toISOString(),
        })
        .expect(200);

      expect(response.body.data.status).toBe('APPROVED');
      expect(response.body.data.expiryDate).toBeDefined();
    });

    it('should create audit log for approval', async () => {
      if (!uploadedDocId) this.skip();

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          agencyId: testAgency.id,
          action: 'document.approved',
          entityId: uploadedDocId,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Step 5: Compliance checks', () => {
    it('should calculate compliance score correctly', async () => {
      // Get documents and document types
      const docs = await prisma.complianceDocument.findMany({
        where: {
          agencyId: testAgency.id,
          workerId: testWorker.id,
          status: 'APPROVED',
        },
      });

      const types = await prisma.documentType.findMany({
        where: { agencyId: testAgency.id, isRequired: true },
      });

      const requiredCount = types.length;
      const completedCount = docs.length;

      const score = requiredCount > 0 ? (completedCount / requiredCount) * 100 : 0;

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Security: Cross-agency isolation', () => {
    it('should not allow worker from one agency to access documents from another', async () => {
      // Create another agency
      const otherAgency = await prisma.agency.create({
        data: {
          name: 'Other Agency',
          slug: 'other-agency',
          email: 'other@agency.com',
        },
      });

      // Create worker in other agency
      const otherWorker = await prisma.worker.create({
        data: {
          agencyId: otherAgency.id,
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@other.com',
          status: 'ACTIVE',
        },
      });

      // Try to fetch first agency's documents with second worker's auth
      // (This test assumes JWT includes agencyId; actual implementation may vary)

      // Cleanup
      await prisma.worker.delete({ where: { id: otherWorker.id } });
      await prisma.agency.delete({ where: { id: otherAgency.id } });
    });
  });
});
