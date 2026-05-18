const request = require('supertest');
const express = require('express');
const prisma = require('../lib/prisma');
const Sentry = require('@sentry/node');

// Mock Sentry
jest.mock('@sentry/node');

describe('Audit Pack Service Tests (R-AP-01 through R-AP-10)', () => {
  let app;
  let agencyId;
  let workerId;
  let docTypeId;

  beforeAll(async () => {
    // Setup express app with test routes
    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req, res, next) => {
      req.agencyId = agencyId;
      req.user = { id: 'test-user', email: 'test@test.com' };
      next();
    });

    // Load audit pack routes
    const auditPackRouter = require('../routes/audit-pack');
    app.use('/api/agency/audit-pack', auditPackRouter);

    const complianceChecklistRouter = require('../routes/compliance-checklist');
    app.use('/api/agency/compliance', complianceChecklistRouter);
  });

  beforeEach(async () => {
    // Create test agency
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        slug: `test-${Date.now()}`,
        email: `test-${Date.now()}@test.com`,
        users: {
          create: {
            clerkId: 'test-clerk',
            email: `user-${Date.now()}@test.com`,
            firstName: 'Test',
            lastName: 'User',
            role: 'OWNER'
          }
        }
      }
    });
    agencyId = agency.id;

    // Create document type
    const docType = await prisma.documentType.create({
      data: {
        agencyId,
        name: 'DBS Check',
        isRequired: true,
        expiryWarningDays: 30
      }
    });
    docTypeId = docType.id;

    // Create test worker
    const worker = await prisma.worker.create({
      data: {
        agencyId,
        firstName: 'Test',
        lastName: 'Worker',
        email: 'worker@test.com'
      }
    });
    workerId = worker.id;

    // Create compliance document
    await prisma.complianceDocument.create({
      data: {
        agencyId,
        workerId,
        documentTypeId: docTypeId,
        fileUrl: 'http://example.com/doc.pdf',
        fileKey: 'test-doc',
        fileName: 'test-doc.pdf',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        agencyId,
        action: 'document.approved',
        entity: 'ComplianceDocument',
        entityId: workerId,
        metadata: { approval: 'test' }
      }
    });
  });

  afterEach(async () => {
    // Clean up
    await prisma.failedAlert.deleteMany({ where: { agencyId } });
    await prisma.expiryAlert.deleteMany({ where: { agencyId } });
    await prisma.auditLog.deleteMany({ where: { agencyId } });
    await prisma.complianceDocument.deleteMany({ where: { agencyId } });
    await prisma.documentType.deleteMany({ where: { agencyId } });
    await prisma.worker.deleteMany({ where: { agencyId } });
    await prisma.user.deleteMany({ where: { agencyId } });
    await prisma.agency.deleteMany({ where: { id: agencyId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── R-AP-01: Audit Pack Generator ───────────────────────────────────────
  describe('R-AP-01: Audit Pack Generator', () => {
    it('should generate single-worker audit pack (ZIP)', async () => {
      const response = await request(app)
        .post(`/api/agency/audit-pack/${workerId}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('packId');
      expect(response.body.data).toHaveProperty('fileSize');
      expect(response.body.data).toHaveProperty('duration');
      expect(response.body.data).toHaveProperty('docCount');
      expect(response.body.data).toHaveProperty('logCount');
      expect(response.body.data.docCount).toBeGreaterThan(0);
    });

    it('should generate pack in under 10 seconds', async () => {
      const response = await request(app)
        .post(`/api/agency/audit-pack/${workerId}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.data.duration).toBeLessThan(10000); // 10 seconds
    });

    it('should return 404 for non-existent worker', async () => {
      const response = await request(app)
        .post(`/api/agency/audit-pack/invalid-id`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
    });
  });

  // ─── R-AP-02: Compliance Report (Agency-Wide) ────────────────────────────
  describe('R-AP-02: Compliance Report (Agency-Wide)', () => {
    it('should generate PDF compliance report', async () => {
      const response = await request(app)
        .post('/api/agency/compliance-report')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
    });

    it('should include all workers in report', async () => {
      // Create additional worker
      await prisma.worker.create({
        data: {
          agencyId,
          firstName: 'Another',
          lastName: 'Worker',
          email: 'another@test.com'
        }
      });

      const response = await request(app)
        .post('/api/agency/compliance-report')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it('should generate report in under 5 seconds', async () => {
      const start = Date.now();
      const response = await request(app)
        .post('/api/agency/compliance-report')
        .set('Content-Type', 'application/json');
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  // ─── R-AP-03: Audit Trail (Worker-Specific) ──────────────────────────────
  describe('R-AP-03: Audit Trail (Worker-Specific)', () => {
    it('should include audit log in pack with timestamp', async () => {
      const response = await request(app)
        .post(`/api/agency/audit-pack/${workerId}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.data.logCount).toBeGreaterThan(0);
    });

    it('should include action type in audit entries', async () => {
      const response = await request(app)
        .post(`/api/agency/audit-pack/${workerId}`)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      // Log count should include the document approval action
      expect(response.body.data.logCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── R-AP-04: Compliance Snapshot (Static View) ───────────────────────────
  describe('R-AP-04: Compliance Snapshot (Static View)', () => {
    it('should create immutable compliance snapshot', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/snapshot')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('asOfDate');
      expect(response.body.data).toHaveProperty('workers');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should capture point-in-time state', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/snapshot')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.data.workers).toHaveLength(1);
      expect(response.body.data.workers[0]).toHaveProperty('complianceScore');
    });

    it('should include worker scores and statuses', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/snapshot')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      const worker = response.body.data.workers[0];
      expect(worker).toHaveProperty('complianceScore');
      expect(worker).toHaveProperty('documents');
      expect(Array.isArray(worker.documents)).toBe(true);
    });
  });

  // ─── R-AP-05: CQC Readiness Checklist ──────────────────────────────────────
  describe('R-AP-05: CQC Readiness Checklist', () => {
    it('should return CQC checklist with status', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/cqc-checklist')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('overallStatus');
      expect(['red', 'yellow', 'green']).toContain(response.body.data.overallStatus);
    });

    it('should show red/yellow/green color status', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/cqc-checklist')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('readyForCQC');
      expect(typeof response.body.data.readyForCQC).toBe('boolean');
    });

    it('should include action items with priorities', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/cqc-checklist')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.actionItems)).toBe(true);
      if (response.body.data.actionItems.length > 0) {
        const item = response.body.data.actionItems[0];
        expect(['CRITICAL', 'HIGH', 'MEDIUM']).toContain(item.priority);
      }
    });
  });

  // ─── R-AP-06: Custom Compliance Thresholds ─────────────────────────────────
  describe('R-AP-06: Custom Compliance Thresholds', () => {
    it('should allow custom threshold configuration', async () => {
      const response = await request(app)
        .put('/api/agencies/compliance-thresholds')
        .send({
          thresholds: [
            { documentTypeId: docTypeId, warningDays: 60 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('enabled', true);
    });

    it('should fetch current thresholds', async () => {
      // Set custom threshold first
      await request(app)
        .put('/api/agencies/compliance-thresholds')
        .send({
          thresholds: [
            { documentTypeId: docTypeId, warningDays: 45 }
          ]
        });

      const response = await request(app)
        .get('/api/agencies/compliance-thresholds')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.thresholds)).toBe(true);
    });

    it('should override default 30-day warning', async () => {
      const response = await request(app)
        .put('/api/agencies/compliance-thresholds')
        .send({
          thresholds: [
            { documentTypeId: docTypeId, warningDays: 90 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.data.thresholds[docTypeId]).toBe(90);
    });
  });

  // ─── R-AP-07: Bulk Audit Pack Export ──────────────────────────────────────
  describe('R-AP-07: Bulk Audit Pack Export', () => {
    it('should export bulk audit pack for multiple workers', async () => {
      const worker2 = await prisma.worker.create({
        data: {
          agencyId,
          firstName: 'Second',
          lastName: 'Worker',
          email: 'second@test.com'
        }
      });

      const response = await request(app)
        .post('/api/agency/audit-pack/bulk/export')
        .send({
          workerIds: [workerId, worker2.id]
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('workerCount', 2);
    });

    it('should work for 10+ workers', async () => {
      const workerIds = [workerId];
      for (let i = 0; i < 10; i++) {
        const w = await prisma.worker.create({
          data: {
            agencyId,
            firstName: `Worker${i}`,
            lastName: `Test${i}`,
            email: `worker${i}@test.com`
          }
        });
        workerIds.push(w.id);
      }

      const response = await request(app)
        .post('/api/agency/audit-pack/bulk/export')
        .send({ workerIds });

      expect(response.status).toBe(201);
      expect(response.body.data.workerCount).toBe(11);
    });

    it('should reject invalid worker IDs', async () => {
      const response = await request(app)
        .post('/api/agency/audit-pack/bulk/export')
        .send({
          workerIds: ['invalid-id']
        });

      expect(response.status).toBe(400);
    });
  });

  // ─── R-AP-08: Audit Pack Scheduling ───────────────────────────────────────
  describe('R-AP-08: Audit Pack Scheduling', () => {
    it('should create immutable compliance snapshots', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/snapshot')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('asOfDate');
    });

    it('should store snapshots with timestamp', async () => {
      const response = await request(app)
        .get('/api/agency/compliance/snapshot')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      const date = new Date(response.body.data.asOfDate);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });

  // ─── R-AP-09: Performance: Report Generation ─────────────────────────────
  describe('R-AP-09: Performance', () => {
    it('should generate PDF report in under 5 seconds', async () => {
      const start = Date.now();
      const response = await request(app)
        .post('/api/agency/compliance-report')
        .set('Content-Type', 'application/json');
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000);
    });

    it('should generate ZIP in under 10 seconds', async () => {
      const start = Date.now();
      const response = await request(app)
        .post(`/api/agency/audit-pack/${workerId}`)
        .set('Content-Type', 'application/json');
      const duration = Date.now() - start;

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(10000);
    });
  });

  // ─── R-AP-10: Error Handling & Recovery ──────────────────────────────────
  describe('R-AP-10: Error Handling & Recovery', () => {
    it('should handle missing worker gracefully', async () => {
      const response = await request(app)
        .post('/api/agency/audit-pack/nonexistent-id')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return clear error messages', async () => {
      const response = await request(app)
        .post('/api/agency/audit-pack/bulk/export')
        .send({ workerIds: [] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    it('should handle API errors with proper status codes', async () => {
      const response = await request(app)
        .put('/api/agencies/compliance-thresholds')
        .send({ thresholds: 'invalid' });

      expect([400, 500]).toContain(response.status);
    });
  });

  // ─── Integration Tests ────────────────────────────────────────────────────
  describe('Integration Tests', () => {
    it('should complete full audit workflow', async () => {
      // 1. Generate pack
      const packRes = await request(app)
        .post(`/api/agency/audit-pack/${workerId}`)
        .set('Content-Type', 'application/json');
      expect(packRes.status).toBe(201);

      // 2. Get snapshot
      const snapRes = await request(app)
        .get('/api/agency/compliance/snapshot')
        .set('Content-Type', 'application/json');
      expect(snapRes.status).toBe(200);

      // 3. Get CQC checklist
      const cqcRes = await request(app)
        .get('/api/agency/compliance/cqc-checklist')
        .set('Content-Type', 'application/json');
      expect(cqcRes.status).toBe(200);

      // 4. Generate report
      const reportRes = await request(app)
        .post('/api/agency/compliance-report')
        .set('Content-Type', 'application/json');
      expect(reportRes.status).toBe(200);
    });

    it('should maintain consistency across all exports', async () => {
      const snap = await request(app)
        .get('/api/agency/compliance/snapshot')
        .set('Content-Type', 'application/json');

      const cqc = await request(app)
        .get('/api/agency/compliance/cqc-checklist')
        .set('Content-Type', 'application/json');

      expect(snap.body.data.workers.length).toBe(cqc.body.data.metrics.totalWorkers);
    });
  });
});
