/**
 * Worker Document Routes
 *
 * GET /worker/documents - fetch worker's compliance documents
 * POST /worker/documents/upload - upload a new document
 *
 * All endpoints require JWT authentication (workerAuthMiddleware)
 * Multi-tenant isolation: documents filtered by workerId + agencyId
 */

const prisma = require('../lib/prisma');
const { workerAuthMiddleware } = require('./worker-auth');
const { uploadToR2, downloadFromR2 } = require('../lib/r2');
const { encryptFileGCM, decryptFileAuto } = require('../lib/encryption');
const Sentry = require('@sentry/node');

/**
 * Helper: Calculate expiry urgency
 * Returns color: 'green' (>30 days), 'yellow' (5-30 days), 'red' (<5 days or expired)
 */
function getExpiryColor(expiryDate) {
    if (!expiryDate) return 'gray'; // No expiry

    const now = new Date();
    const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return 'red'; // Expired
    if (daysUntilExpiry < 5) return 'red'; // <5 days: urgent
    if (daysUntilExpiry <= 30) return 'yellow'; // 5-30 days: warning
    return 'green'; // >30 days: safe
}

/**
 * GET /worker/documents
 * Returns list of worker's compliance documents with expiry status
 */
async function getWorkerDocuments(req, res) {
    try {
        const { workerId, agencyId } = req.worker;

        // Fetch documents for this worker + agency
        const documents = await prisma.complianceDocument.findMany({
            where: {
                workerId,
                agencyId,
            },
            include: {
                documentType: {
                    select: { name: true },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });

        // Add expiry urgency calculation
        const enrichedDocs = documents.map((doc) => {
            const daysUntilExpiry = doc.expiryDate
                ? Math.floor((doc.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
                : null;

            return {
                id: doc.id,
                fileName: doc.fileName,
                docType: doc.documentType.name,
                status: doc.status,
                expiryDate: doc.expiryDate,
                daysUntilExpiry,
                expiryColor: getExpiryColor(doc.expiryDate),
                uploadedAt: doc.uploadedAt,
            };
        });

        res.status(200).json({
            documents: enrichedDocs,
            count: enrichedDocs.length,
        });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { workerId: req.worker?.id, context: 'worker.get-documents' },
        });
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
}

/**
 * POST /worker/documents/upload
 * Upload a new compliance document
 * Form data: file (multipart), documentTypeId
 */
async function uploadWorkerDocument(req, res) {
    try {
        const { workerId, agencyId } = req.worker;
        const { documentTypeId } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'File is required' });
        }

        if (!documentTypeId) {
            return res.status(400).json({ error: 'Document type is required' });
        }

        // Validate file size (10 MB max)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({ error: 'File too large (max 10 MB)' });
        }

        // Validate file type
        const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
            return res.status(400).json({ error: 'Invalid file type' });
        }

        // Verify document type exists and belongs to agency
        const docType = await prisma.documentType.findFirst({
            where: {
                id: documentTypeId,
                agencyId,
            },
        });

        if (!docType) {
            return res.status(404).json({ error: 'Document type not found' });
        }

        // Encrypt file (GCM for new uploads)
        const encrypted = encryptFileGCM(file.buffer);
        const encryptedBuffer = encrypted.ciphertext;
        const iv = encrypted.iv;
        const authTag = encrypted.authTag;

        // Upload to R2
        const key = `${agencyId}/workers/${workerId}/documents/${Date.now()}-${file.originalname}`;
        const fileUrl = await uploadToR2(encryptedBuffer, key, file.mimetype);

        // Create document record
        const document = await prisma.complianceDocument.create({
            data: {
                agencyId,
                workerId,
                documentTypeId,
                fileName: file.originalname,
                fileUrl,
                fileKey: key,
                fileSize: file.size,
                mimeType: file.mimetype,
                encryptionAlgorithm: 'aes-256-gcm',
                status: 'PENDING',
                uploadedAt: new Date(),
            },
            include: {
                documentType: { select: { name: true } },
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                agencyId,
                userId: null, // Worker uploads have no userId
                action: 'document.uploaded-by-worker',
                entity: 'ComplianceDocument',
                entityId: document.id,
                metadata: {
                    workerId,
                    fileName: file.originalname,
                    docType: docType.name,
                },
            },
        });

        res.status(201).json({
            message: 'Document uploaded successfully',
            document: {
                id: document.id,
                fileName: document.fileName,
                docType: document.documentType.name,
                status: document.status,
                uploadedAt: document.uploadedAt,
            },
        });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { workerId: req.worker?.id, context: 'worker.upload-document' },
        });
        console.error('Upload document error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
}

module.exports = {
    getWorkerDocuments,
    uploadWorkerDocument,
};
