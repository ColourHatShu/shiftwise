const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Sentry = require('@sentry/node');
const { requireAgency, requireRole } = require('../lib/auth');
const { computeDocumentDisplayStatus } = require('../lib/document-status');
const { pdf } = require('pdf-to-img');
const prisma = require('../lib/prisma');
const { seedDocumentTypes } = require('../lib/seedDocumentTypes');
const { encryptFile, encryptFileGCM, decryptFileAuto, readAndDecryptFile, validateEncryptionSetup } = require('../lib/encryption');
const { validate, documentUploadSchema, documentVerifySchema } = require('../middleware/validation');
const { aiAnalysisLimiter, documentUploadLimiter } = require('../middleware/rateLimiter');
const { analyzeDocumentImage, shutdownOCR } = require('../lib/ocrService');
const { recordAnalysisFailure, recordIdentityMismatch } = require('../lib/analysis-failure');
const logger = require('../lib/logger');

const router = express.Router();

// Apply auth to all routes in this router
router.use(requireAgency);

// ─── Encryption Setup Validation ──────────────────────────────────────────────
if (!validateEncryptionSetup()) {
    logger.error('Encryption setup validation failed. Document uploads will fail.');
}

// ─── Multer memory storage (encrypt before writing to disk) ─────────────────────
const storage = multer.memoryStorage();
const upload = multer({ 
    storage, 
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        // Only allow specific document types
        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp'
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF and images are allowed.`), false);
        }
    }
});

// ─── Uploads Directory for encrypted files ────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });


// ─── Async Document Analysis (via setImmediate) ──────────────────────────────
const analyzeDocument = async (doc, worker, filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            logger.error({ filePath }, '[OCR] File not found');
            return;
        }

        const ext = path.extname(doc.fileName).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        const isPdf = ext === '.pdf';

        if (!isImage && !isPdf) {
            await recordAnalysisFailure(doc, `Unsupported file type: ${ext}`);
            return;
        }

        let imageBuffer;

        try {
            const decryptedBuffer = readAndDecryptFile(filePath);

            if (isImage) {
                imageBuffer = decryptedBuffer;
            } else if (isPdf) {
                try {
                    logger.debug({ documentId: doc.id }, '[OCR] Converting PDF to image');
                    const tempPath = path.join(UPLOADS_DIR, `temp-${Date.now()}.pdf`);
                    fs.writeFileSync(tempPath, decryptedBuffer);

                    let document = await pdf(tempPath, { scale: 2.0 });
                    let firstPageBuffer;
                    for await (const image of document) {
                        firstPageBuffer = image;
                        break;
                    }

                    try {
                        fs.unlinkSync(tempPath);
                    } catch (cleanupErr) {
                        logger.warn({ err: cleanupErr }, '[OCR] Temp-file cleanup error');
                    }

                    if (!firstPageBuffer) {
                        await recordAnalysisFailure(doc, 'PDF conversion returned empty');
                        return;
                    }

                    imageBuffer = firstPageBuffer;
                } catch (err) {
                    await recordAnalysisFailure(doc, 'PDF conversion failed', err);
                    return;
                }
            }
        } catch (decryptErr) {
            await recordAnalysisFailure(doc, 'Decryption failed', decryptErr);
            return;
        }

        // Run Tesseract OCR and extract
        try {
            logger.info({ documentId: doc.id }, '[OCR] Analyzing document');
            const workerData = { firstName: worker.firstName, lastName: worker.lastName };
            const ocrResult = await analyzeDocumentImage(imageBuffer, workerData);

            if (ocrResult.error) {
                await recordAnalysisFailure(doc, `OCR analysis error: ${ocrResult.error}`);
                return;
            }

            const { analysis } = ocrResult;

            // Build final analysisResult (excluding PII like fullName, documentNumber)
            const analysisResult = {
                documentType: analysis.documentType,
                expiryDate: analysis.expiryDate,
                issueDate: analysis.issueDate,
                issuingAuthority: analysis.issuingAuthority,
                confidence: analysis.confidence,
                summary: analysis.summary,
                concerns: analysis.concerns,
                nameMatchesWorker: analysis.nameMatchesWorker || false,
                wrongDocumentWarning: null
            };

            // Detect wrong document type
            if (analysis.documentType && analysis.documentType !== 'OTHER') {
                const expectedDocType = doc.documentType.name.toLowerCase();
                const detectedType = analysis.documentType.replace(/_/g, ' ').toLowerCase();

                if (!expectedDocType.includes(detectedType) && !detectedType.includes(expectedDocType)) {
                    analysisResult.wrongDocumentWarning =
                        `This appears to be a ${detectedType}, not a ${doc.documentType.name}. Please verify.`;
                }
            }

            // Update document with analysis result and save expiry date if found
            const updateData = { analysisResult, status: 'PENDING' };
            if (doc.documentType.hasExpiry && analysis.expiryDate) {
                updateData.expiryDate = new Date(analysis.expiryDate);
            }

            await prisma.complianceDocument.update({
                where: { id: doc.id },
                data: updateData
            });

            // If the OCR actually read a name and it doesn't match the worker, leave an
            // identity-mismatch audit trail (fraud/compliance signal). Gated on a name
            // being extracted so "no name found" never raises a false mismatch.
            if (analysis.fullName && analysis.nameMatchesWorker === false) {
                await recordIdentityMismatch(doc, worker, analysis.fullName);
            }

            logger.info({ documentId: doc.id }, '[OCR] Analysis complete');
        } catch (analysisErr) {
            await recordAnalysisFailure(doc, 'Analysis exception', analysisErr);
        }
    } catch (error) {
        await recordAnalysisFailure(doc, 'Unexpected analysis error', error);
    }
};

// ─── POST /api/documents/upload ───────────────────────────────────────────────
router.post('/upload', documentUploadLimiter, upload.single('file'), validate(documentUploadSchema), async (req, res) => {
    try {

        const { workerId, documentTypeId, notes } = req.body;
        if (!req.file || !workerId || !documentTypeId) {
            return res.status(400).json({ error: 'File, workerId and documentTypeId are required' });
        }

        const worker = await prisma.worker.findFirst({
            where: { id: workerId, agencyId: req.agencyId }
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
        
        // Generate encrypted filename
        const originalName = req.file.originalname.replace(/\s+/g, '_');
        const uniqueId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const encryptedFilename = `${uniqueId}-${originalName}.enc`;
        const encryptedFilePath = path.join(UPLOADS_DIR, encryptedFilename);

        // Encrypt and save the file using GCM (new authenticated cipher)
        const encrypted = encryptFileGCM(req.file.buffer);
        fs.writeFileSync(encryptedFilePath, encrypted);

        const fileUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/${encryptedFilename}`;

        // Delete any existing document of this type for this worker
        const existing = await prisma.complianceDocument.findFirst({
            where: { workerId, documentTypeId, agencyId: req.agencyId }
        });
        if (existing) {
            const oldPath = path.join(UPLOADS_DIR, path.basename(existing.fileKey));
            if (fs.existsSync(oldPath)) {
                try {
                    // Securely delete old file (overwrite then unlink)
                    const stats = fs.statSync(oldPath);
                    const overwriteBuffer = Buffer.alloc(stats.size, 0);
                    fs.writeFileSync(oldPath, overwriteBuffer);
                    fs.unlinkSync(oldPath);
                } catch (err) {
                    (req.log || logger).warn({ err }, 'Failed to securely delete old file');
                }
            }
            await prisma.complianceDocument.delete({ where: { id: existing.id } });
        }

        const [doc] = await prisma.$transaction([
            prisma.complianceDocument.create({
                data: {
                    agencyId: req.agencyId,
                    workerId,
                    documentTypeId,
                    fileUrl,
                    fileKey: encryptedFilename,
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    encryptionAlgorithm: 'aes-256-gcm',  // New uploads use authenticated GCM
                    status: 'PENDING',
                    notes: notes || null,
                },
                include: { documentType: true }
            }),
            prisma.auditLog.create({
                data: {
                    agencyId: req.agencyId,
                    userId: req.user.id,
                    action: 'document.uploaded',
                    entity: 'ComplianceDocument',
                    entityId: encryptedFilename, // Use fileKey as reference before doc is created
                    metadata: {
                        workerId,
                        documentTypeId,
                        fileName: req.file.originalname,
                        fileSize: req.file.size,
                        mimeType: req.file.mimetype,
                        encrypted: true
                    },
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.headers['user-agent']
                }
            })
        ]);

        // Update the audit log with the actual document ID after creation
        await prisma.auditLog.updateMany({
            where: {
                agencyId: req.agencyId,
                userId: agencyUser.id,
                action: 'document.uploaded',
                entityId: encryptedFilename
            },
            data: {
                entityId: doc.id
            }
        });

        (req.log || logger).info({ file: encryptedFilename, bytes: encrypted.length }, 'Encrypted and stored document');

        // Return 201 immediately (non-blocking)
        res.status(201).json({
            data: {
                ...doc,
                isEncrypted: true,
                encryptionAlgorithm: 'aes-256-cbc',
                status: 'pending',
                analysisResult: null
            }
        });

        // Dispatch async OCR analysis via setImmediate
        setImmediate(async () => {
            const filePath = path.join(UPLOADS_DIR, encryptedFilename);
            await analyzeDocument(doc, worker, filePath);
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Upload error');
        res.status(500).json({ error: 'Failed to upload document', details: error.message });
    }
});

// ─── GET /api/documents/:id/status ────────────────────────────────────────────
// Returns document status and analysis result (for frontend polling)
router.get('/:id/status', async (req, res) => {
    try {
        const doc = await prisma.complianceDocument.findFirst({
            where: { id: req.params.id, agencyId: req.agencyId }
        });
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        const status = doc.analysisResult ? 'completed' : (doc.status === 'FAILED' ? 'failed' : 'pending');

        res.json({
            data: {
                id: doc.id,
                status,
                analysisResult: doc.analysisResult,
                expiryDate: doc.expiryDate
            }
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching document status');
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// ─── GET /api/documents/worker/:workerId ──────────────────────────────────────
// Returns all 8 document type slots merged with any uploaded documents.
router.get('/worker/:workerId', async (req, res) => {
    try {

        const { workerId } = req.params;
        const worker = await prisma.worker.findFirst({
            where: { id: workerId, agencyId: req.agencyId }
        });
        if (!worker) return res.status(404).json({ error: 'Worker not found' });

        // Auto-seed document types for this agency if none exist yet
        const typeCount = await prisma.documentType.count({ where: { agencyId: req.agencyId } });
        if (typeCount === 0) await seedDocumentTypes(req.agencyId, prisma);

        const [documentTypes, uploaded] = await Promise.all([
            prisma.documentType.findMany({ where: { agencyId: req.agencyId }, orderBy: { name: 'asc' } }),
            prisma.complianceDocument.findMany({ where: { workerId, agencyId: req.agencyId }, include: { documentType: true } })
        ]);

        const uploadedMap = {};
        for (const d of uploaded) uploadedMap[d.documentTypeId] = d;

        const merged = documentTypes.map(dt => {
            const doc = uploadedMap[dt.id] || null;
            return { documentType: dt, document: doc, computedStatus: computeDocumentDisplayStatus(doc) };
        });

        res.json({ data: merged });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching worker documents');
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// ─── GET /api/documents/agency ────────────────────────────────────────────────
router.get('/agency', async (req, res) => {
    try {

        // Clamp pagination: page >= 1, limit in [1, 100] so `take` can't be unbounded.
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const skip = (page - 1) * limit;

        const [workers, total] = await Promise.all([
            prisma.worker.findMany({
                where: { agencyId: req.agencyId },
                orderBy: { firstName: 'asc' },
                skip,
                take: limit,
                include: {
                    complianceDocuments: {
                        include: { documentType: true },
                        orderBy: { uploadedAt: 'desc' }
                    }
                }
            }),
            prisma.worker.count({ where: { agencyId: req.agencyId } })
        ]);

        const totalPages = Math.ceil(total / limit);

        res.json({
            data: workers,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error fetching agency documents');
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// ─── POST /api/documents/:id/analyse (Tesseract OCR Verification) ──────────────
// Manually trigger re-scan of a document
router.post('/:id/analyse', aiAnalysisLimiter, async (req, res) => {
    try {

        const doc = await prisma.complianceDocument.findFirst({
            where: { id: req.params.id, agencyId: req.agencyId },
            include: { documentType: true, worker: true }
        });
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Return current analysis if available
        if (doc.analysisResult) {
            (req.log || logger).debug({ documentId: doc.id }, 'Serving cached analysis');
            return res.json({ data: doc.analysisResult });
        }

        // If no analysis yet, return pending status
        res.json({
            data: {
                status: 'pending',
                message: 'Document is being scanned. Please try again in a moment.'
            }
        });

        // Trigger re-analysis in background
        const filePath = path.join(UPLOADS_DIR, path.basename(doc.fileKey));
        setImmediate(async () => {
            await analyzeDocument(doc, doc.worker, filePath);
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'AI analysis API error');
        res.status(500).json({ error: 'Failed to analyse document with AI' });
    }
});

// ─── PATCH /api/documents/:id/verify ─────────────────────────────────────────
router.patch('/:id/verify', validate(documentVerifySchema), requireRole(['OWNER', 'ADMIN']), async (req, res) => {
    try {

        const { status, notes, manualExpiryDate, version } = req.body;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
        }

        // Optimistic Locking: Fetch document with version check
        const doc = await prisma.complianceDocument.findFirst({
            where: { id: req.params.id, agencyId: req.agencyId }
        });
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Check for version conflict (optimistic locking)
        if (version !== undefined && doc.updatedAt.getTime() !== new Date(version).getTime()) {
            return res.status(409).json({ 
                error: 'Document was modified by another user. Please refresh and try again.',
                currentVersion: doc.updatedAt
            });
        }

        const updateData = {
            status,
            reviewedAt: new Date(),
            rejectionReason: status === 'REJECTED' ? notes : null,
            notes: notes || doc.notes
        };

        if (manualExpiryDate && status === 'APPROVED') {
            updateData.expiryDate = new Date(manualExpiryDate);
        }

        // Update document status & create Audit Log transactionally
        const [updated] = await prisma.$transaction([
            prisma.complianceDocument.update({
                where: { id: doc.id },
                data: updateData,
                include: { documentType: true }
            }),
            prisma.auditLog.create({
                data: {
                    agencyId: req.agencyId,
                    userId: req.user.id,
                    action: `document.${status.toLowerCase()}`,
                    entity: 'ComplianceDocument',
                    entityId: doc.id,
                    metadata: {
                        notes,
                        documentType: doc.documentTypeId,
                        previousStatus: doc.status,
                        newStatus: status
                    }
                }
            })
        ]);

        res.json({ 
            data: updated,
            version: updated.updatedAt 
        });
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error verifying document');
        res.status(500).json({ error: 'Failed to verify document' });
    }
});

// ─── GET /api/documents/:id/download ───────────────────────────────────────
// Streaming download of a decrypted document.
// Requires: valid JWT for the owning agency, document must belong to user's agency.
// Returns: decrypted file with proper headers (Content-Disposition, Content-Type).
// On auth failure: 401. On cross-agency access: 404 (not 403, to avoid existence leak).
// On missing file: 500 with sanitized error.
router.get('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;

        // Load document scoped to user's agency (return null on cross-agency, not throw)
        const document = await prisma.complianceDocument.findFirst({
            where: { id, agencyId: req.agencyId }
        });

        // Return 404 on both not-found and cross-agency (intentional: no existence leak)
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Construct file path from fileKey
        const filePath = path.join(UPLOADS_DIR, path.basename(document.fileKey));

        // Check if file exists on disk
        if (!fs.existsSync(filePath)) {
            (req.log || logger).error({ documentId: document.id, filePath }, 'File missing on disk');
            return res.status(500).json({ error: 'Document file unavailable' });
        }

        try {
            // Read encrypted file
            const encryptedBuffer = fs.readFileSync(filePath);

            // Determine encryption algorithm (default to CBC for backward compat with old docs)
            const algorithm = document.encryptionAlgorithm || 'aes-256-cbc';

            // Decrypt using the appropriate algorithm
            // Note: GCM documents require full-buffer decryption for auth-tag verification.
            // CBC documents could stream, but for simplicity all documents are buffered.
            let decryptedBuffer;
            try {
                decryptedBuffer = decryptFileAuto(encryptedBuffer, algorithm);
            } catch (err) {
                // Handle GCM auth failures with structured logging
                if (err.code === 'GCM_AUTH_FAIL') {
                    (req.log || logger).error({
                        documentId: document.id,
                        agencyId: req.agencyId,
                        reason: 'GCM_AUTH_FAIL'
                    }, 'GCM auth failure');
                    // Log to Sentry
                    Sentry.captureException(err, {
                        tags: {
                            userId: req.user?.id,
                            agencyId: req.agencyId,
                            documentId: document.id,
                            context: 'gcm-decryption-failure'
                        },
                        extra: {
                            algorithm,
                            fileSize: encryptedBuffer.length
                        }
                    });
                    return res.status(500).json({ error: 'Document decryption failed' });
                }
                // Re-throw for outer catch
                throw err;
            }

            // Set response headers BEFORE sending
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName)}"`);
            res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
            res.setHeader('Content-Length', decryptedBuffer.length);

            // Send decrypted buffer
            res.send(decryptedBuffer);
        } catch (decryptError) {
            (req.log || logger).error({ err: decryptError, documentId: document.id }, 'Decryption failed');
            // Log to Sentry
            Sentry.captureException(decryptError, {
                tags: {
                    userId: req.user?.id,
                    agencyId: req.agencyId,
                    documentId: document.id,
                    context: 'document-decryption-error'
                }
            });
            // Return sanitized 500 (no file path or key info in response)
            return res.status(500).json({ error: 'Document decryption failed' });
        }
    } catch (error) {
        (req.log || logger).error({ err: error }, 'Error in download endpoint');
        // Log to Sentry
        Sentry.captureException(error, {
            tags: {
                userId: req.user?.id,
                agencyId: req.agencyId,
                context: 'document-download-error'
            }
        });
        res.status(500).json({ error: 'Failed to download document' });
    }
});

module.exports = router;
