const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAgency, requireRole } = require('../lib/auth');
const { pdf } = require('pdf-to-img');
const prisma = require('../lib/prisma');
const { seedDocumentTypes } = require('../lib/seedDocumentTypes');
const { fetchWithRetry } = require('../lib/fetchWithRetry');
const { encryptFile, encryptFileGCM, decryptFileAuto, readAndDecryptFile, validateEncryptionSetup } = require('../lib/encryption');
const { validate, documentUploadSchema, documentVerifySchema } = require('../middleware/validation');
const { aiAnalysisLimiter, documentUploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply auth to all routes in this router
router.use(requireAgency);

// ─── Encryption Setup Validation ──────────────────────────────────────────────
if (!validateEncryptionSetup()) {
    console.error('❌ [Documents] Encryption setup validation failed. Document uploads will fail.');
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


// ─── AI Analysis Helper ────────────────────────────────────────────────────────
const runDocAnalysis = async (doc, worker, filePath) => {
    try {
        if (!fs.existsSync(filePath)) return { error: 'File not found' };

        const ext = path.extname(doc.fileName).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        const isPdf = ext === '.pdf';

        if (!isImage && !isPdf) {
            return { error: 'Unsupported file type for analysis' };
        }

        let base64Data;

        // Decrypt the file first
        try {
            const decryptedBuffer = readAndDecryptFile(filePath);

            if (isImage) {
                base64Data = decryptedBuffer.toString('base64');
            } else if (isPdf) {
                try {
                    console.log(`Converting first page of PDF to image...`);
                    const tempPath = path.join(UPLOADS_DIR, `temp-${Date.now()}.pdf`);
                    fs.writeFileSync(tempPath, decryptedBuffer);

                    let document = await pdf(tempPath, { scale: 2.0 });
                    let firstPageBuffer;
                    for await (const image of document) {
                        firstPageBuffer = image;
                        break;
                    }
                    if (!firstPageBuffer) throw new Error('PDF conversion returned empty');

                    base64Data = firstPageBuffer.toString('base64');

                    try {
                        fs.unlinkSync(tempPath);
                    } catch (cleanupErr) {
                        console.error('Failed to cleanup temp PDF:', cleanupErr.message);
                    }
                } catch (err) {
                    console.error("PDF to Image conversion failed:", err);
                    return {
                        summary: 'Document uploaded successfully. Please upload as an image for automatic scanning.',
                        concerns: ['Could not read PDF. Please upload an image format (.jpg, .png) for automatic scanning.'],
                        documentType: null,
                        fullName: null,
                        documentNumber: null,
                        expiryDate: null,
                        issueDate: null,
                        issuingAuthority: null,
                        confidence: "low",
                        wrongDocumentWarning: null,
                        nameMatchesWorker: false
                    };
                }
            }
        } catch (decryptErr) {
            console.error('Failed to decrypt or process file:', decryptErr);
            return {
                error: 'Failed to decrypt or process document. File may be corrupted.',
                details: decryptErr.message
            };
        }

        const prompt = `You are a UK healthcare staffing compliance expert. Analyse this ${doc.documentType.name} document and extract key information.
Return ONLY a JSON object with these exact fields:
{
  "documentType": "what type of document this appears to be",
  "fullName": "name found on document",
  "documentNumber": "any ID/reference number",
  "expiryDate": "YYYY-MM-DD or null",
  "issueDate": "YYYY-MM-DD or null",
  "issuingAuthority": "who issued the document",
  "concerns": ["List of any issues or anomalies noticed. Return empty array [] if none."],
  "confidence": "high/medium/low",
  "summary": "one sentence summary of findings"
}`;

        console.log(`[AI Analysis] Processing document ${doc.id} (type: ${doc.documentType.name})...`);

        const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
        const response = await fetchWithRetry(`${ollamaHost}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: process.env.OLLAMA_MODEL || 'llava',
                prompt: prompt,
                images: [base64Data],
                stream: false,
                format: 'json',
                options: {
                    temperature: 0
                }
            })
        }, {
            maxRetries: 3,
            timeout: 30000
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Parse JSON safely in case llava outputs markdown wrappers despite format: json
        const rawText = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(rawText);

        const concerns = result.concerns || [];

        // Name matching Check
        if (result.fullName) {
            const workerName = `${worker.firstName} ${worker.lastName}`.toLowerCase();
            const foundName = result.fullName.toLowerCase();
            const namesMatch = foundName.includes(worker.firstName.toLowerCase()) || foundName.includes(worker.lastName.toLowerCase());
            result.nameMatchesWorker = namesMatch;
            if (!namesMatch) concerns.unshift(`Name mismatch: Document says "${result.fullName}" but worker is "${worker.firstName} ${worker.lastName}"`);
        }
        result.concerns = concerns;

        // Wrong Document Type Detection
        // We check if the expected noun (e.g. "Passport", "DBS") is roughly found in the extracted type
        // E.g. expected: "DBS Check", extracted: "Passport" -> mismatch
        const expectedName = doc.documentType.name.toLowerCase();
        const extractedType = (result.documentType || '').toLowerCase();

        let wrongDocumentWarning = null;
        if (extractedType && extractedType !== 'not found' && extractedType !== 'null') {
            const expectedWords = expectedName.split(' ').filter(w => w.length > 3);
            if (expectedWords.length > 0) {
                const hasMatch = expectedWords.some(w => extractedType.includes(w));
                if (!hasMatch) {
                    wrongDocumentWarning = `This looks like a ${result.documentType}, not a ${doc.documentType.name}. Please check you've uploaded the correct document.`;
                }
            }
        }
        result.wrongDocumentWarning = wrongDocumentWarning;

        // PII Sanitization: Store only non-sensitive analysis results
        const safeResult = {
            documentType: result.documentType,
            expiryDate: result.expiryDate,
            issueDate: result.issueDate,
            issuingAuthority: result.issuingAuthority,
            confidence: result.confidence,
            summary: result.summary,
            concerns: result.concerns,
            nameMatchesWorker: result.nameMatchesWorker,
            wrongDocumentWarning: result.wrongDocumentWarning
            // Note: fullName and documentNumber are intentionally excluded to prevent PII storage
        };

        // Auto-save expiry date if applicable and found
        let savedExpiryDate = doc.expiryDate;
        let expiryFound = false;
        if (doc.documentType.hasExpiry && result.expiryDate && result.expiryDate !== 'null') {
            savedExpiryDate = new Date(result.expiryDate);
            expiryFound = true;
            await prisma.complianceDocument.update({
                where: { id: doc.id },
                data: { expiryDate: savedExpiryDate }
            });
        }

        return { result: safeResult, expiryFound, savedExpiryDate, error: null };
    } catch (error) {
        console.error('Claude extraction error:', error);
        return { error: 'Failed to extract AI data' };
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
                    console.error('Failed to securely delete old file:', err.message);
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

        console.log(`[Documents] Encrypted and stored document: ${encryptedFilename} (${encrypted.length} bytes)`);

        res.status(201).json({ 
            data: {
                ...doc,
                isEncrypted: true,
                encryptionAlgorithm: 'aes-256-cbc'
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload document', details: error.message });
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

        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const merged = documentTypes.map(dt => {
            const doc = uploadedMap[dt.id] || null;
            let computedStatus = 'NOT_UPLOADED';
            if (doc) {
                if (doc.status === 'EXPIRED') computedStatus = 'EXPIRED';
                else if (doc.expiryDate && new Date(doc.expiryDate) <= in30Days && doc.status === 'APPROVED')
                    computedStatus = 'EXPIRING_SOON';
                else computedStatus = doc.status; // will fall back to PENDING, APPROVED, REJECTED
            }
            return { documentType: dt, document: doc, computedStatus };
        });

        res.json({ data: merged });
    } catch (error) {
        console.error('Error fetching worker documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// ─── GET /api/documents/agency ────────────────────────────────────────────────
router.get('/agency', async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
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
        console.error('Error fetching agency documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// ─── POST /api/documents/:id/analyse (Claude AI Verification) ────────────────
router.post('/:id/analyse', aiAnalysisLimiter, async (req, res) => {
    try {

        const doc = await prisma.complianceDocument.findFirst({
            where: { id: req.params.id, agencyId: req.agencyId },
            include: { documentType: true, worker: true }
        });
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        const forceRescan = req.query.force === 'true';

        // 1. Check Cache first
        if (doc.analysisResult && !forceRescan) {
            console.log(`Serving cached analysis for document ${doc.id}`);
            return res.json({ data: doc.analysisResult });
        }

        // 2. Otherwise run inference
        const filePath = path.join(UPLOADS_DIR, path.basename(doc.fileKey));
        const aiAnalysis = await runDocAnalysis(doc, doc.worker, filePath);

        if (aiAnalysis.error || !aiAnalysis.result) {
            return res.status(500).json({ error: aiAnalysis.error || 'Failed to extract AI data' });
        }

        // 3. Save the result to the cache
        await prisma.complianceDocument.update({
            where: { id: doc.id },
            data: { analysisResult: aiAnalysis.result }
        });

        res.json({ data: aiAnalysis.result });
    } catch (error) {
        console.error('AI Analysis API error:', error);
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
        console.error('Error verifying document:', error);
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
            console.error(`[Documents] File missing on disk for document ${document.id}: ${filePath}`);
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
                    console.error('[encryption] GCM auth failure', {
                        documentId: document.id,
                        agencyId: req.agencyId,
                        error: 'GCM_AUTH_FAIL'
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
            console.error(`[Documents] Decryption failed for document ${document.id}:`, decryptError.message);
            // Return sanitized 500 (no file path or key info in response)
            return res.status(500).json({ error: 'Document decryption failed' });
        }
    } catch (error) {
        console.error('Error in download endpoint:', error);
        res.status(500).json({ error: 'Failed to download document' });
    }
});

module.exports = router;
