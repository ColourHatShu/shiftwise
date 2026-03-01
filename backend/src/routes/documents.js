const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('@clerk/backend');
const { pdf } = require('pdf-to-img');
const prisma = require('../lib/prisma');
const { seedDocumentTypes } = require('../lib/seedDocumentTypes');

const router = express.Router();

// ─── Multer disk storage ──────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname.replace(/\s+/g, '_')}`;
        cb(null, unique);
    },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Shared auth helper ───────────────────────────────────────────────────────
const getAgencyUser = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    const token = authHeader.split(' ')[1];
    let payload;
    try {
        payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
            authorizedParties: ['http://localhost:3000'],
            clockSkewInMs: 300000,
        });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }
    const user = await prisma.user.findUnique({ where: { clerkId: payload.sub } });
    if (!user?.agencyId) {
        res.status(403).json({ error: 'No agency found' });
        return null;
    }
    return user;
};

// ─── AI Analysis Helper ────────────────────────────────────────────────────────
const runDocAnalysis = async (doc, worker, filePath) => {
    try {
        if (!fs.existsSync(filePath)) return { error: 'File not found' };

        const ext = path.extname(doc.fileKey).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        const isPdf = ext === '.pdf';

        if (!isImage && !isPdf) {
            return { error: 'Unsupported file type for analysis' };
        }

        let base64Data;
        if (isImage) {
            const fileData = fs.readFileSync(filePath);
            base64Data = fileData.toString('base64');
        } else if (isPdf) {
            try {
                console.log(`Converting first page of PDF to image...`);
                let document = await pdf(filePath, { scale: 2.0 });
                let firstPageBuffer;
                for await (const image of document) {
                    firstPageBuffer = image;
                    break;
                }
                if (!firstPageBuffer) throw new Error('PDF conversion returned empty');

                base64Data = firstPageBuffer.toString('base64');
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

        console.log(`Sending base64 image to local Ollama (${process.env.OLLAMA_MODEL || 'llava'}) for analysis...`);

        const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
        const response = await fetch(`${ollamaHost}/api/generate`, {
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

        return { result, expiryFound, savedExpiryDate, error: null };
    } catch (error) {
        console.error('Claude extraction error:', error);
        return { error: 'Failed to extract AI data' };
    }
};

// ─── POST /api/documents/upload ───────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const agencyUser = await getAgencyUser(req, res);
        if (!agencyUser) return;

        const { workerId, documentTypeId, notes } = req.body;
        if (!req.file || !workerId || !documentTypeId) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'File, workerId and documentTypeId are required' });
        }

        const worker = await prisma.worker.findFirst({
            where: { id: workerId, agencyId: agencyUser.agencyId }
        });
        if (!worker) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Worker not found' });
        }

        const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
        const fileUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/${req.file.filename}`;
        const filePath = path.join(UPLOADS_DIR, req.file.filename);

        const existing = await prisma.complianceDocument.findFirst({
            where: { workerId, documentTypeId, agencyId: agencyUser.agencyId }
        });
        if (existing) {
            const oldPath = path.join(UPLOADS_DIR, path.basename(existing.fileKey));
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            await prisma.complianceDocument.delete({ where: { id: existing.id } });
        }

        const doc = await prisma.complianceDocument.create({
            data: {
                agencyId: agencyUser.agencyId,
                workerId,
                documentTypeId,
                fileUrl,
                fileKey: req.file.filename,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                status: 'PENDING',
                notes: notes || null,
            },
            include: { documentType: true }
        });

        res.status(201).json({ data: doc });
    } catch (error) {
        console.error('Upload error:', error);
        if (req.file) fs.unlink(req.file.path, () => { });
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// ─── GET /api/documents/worker/:workerId ──────────────────────────────────────
// Returns all 8 document type slots merged with any uploaded documents.
router.get('/worker/:workerId', async (req, res) => {
    try {
        const agencyUser = await getAgencyUser(req, res);
        if (!agencyUser) return;

        const { workerId } = req.params;
        const worker = await prisma.worker.findFirst({
            where: { id: workerId, agencyId: agencyUser.agencyId }
        });
        if (!worker) return res.status(404).json({ error: 'Worker not found' });

        // Auto-seed document types for this agency if none exist yet
        const typeCount = await prisma.documentType.count({ where: { agencyId: agencyUser.agencyId } });
        if (typeCount === 0) await seedDocumentTypes(agencyUser.agencyId, prisma);

        const [documentTypes, uploaded] = await Promise.all([
            prisma.documentType.findMany({ where: { agencyId: agencyUser.agencyId }, orderBy: { name: 'asc' } }),
            prisma.complianceDocument.findMany({ where: { workerId, agencyId: agencyUser.agencyId }, include: { documentType: true } })
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
        const agencyUser = await getAgencyUser(req, res);
        if (!agencyUser) return;

        const workers = await prisma.worker.findMany({
            where: { agencyId: agencyUser.agencyId },
            orderBy: { firstName: 'asc' },
            include: {
                complianceDocuments: {
                    include: { documentType: true },
                    orderBy: { uploadedAt: 'desc' }
                }
            }
        });

        res.json({ data: workers });
    } catch (error) {
        console.error('Error fetching agency documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// ─── POST /api/documents/:id/analyse (Claude AI Verification) ────────────────
router.post('/:id/analyse', async (req, res) => {
    try {
        const agencyUser = await getAgencyUser(req, res);
        if (!agencyUser) return;

        const doc = await prisma.complianceDocument.findFirst({
            where: { id: req.params.id, agencyId: agencyUser.agencyId },
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
router.patch('/:id/verify', async (req, res) => {
    try {
        const agencyUser = await getAgencyUser(req, res);
        if (!agencyUser) return;

        const { status, notes } = req.body;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
        }

        const doc = await prisma.complianceDocument.findFirst({
            where: { id: req.params.id, agencyId: agencyUser.agencyId }
        });
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Update document status & create Audit Log transactionally
        const [updated] = await prisma.$transaction([
            prisma.complianceDocument.update({
                where: { id: doc.id },
                data: {
                    status,
                    reviewedAt: new Date(),
                    rejectionReason: status === 'REJECTED' ? notes : null,
                    notes: notes || doc.notes
                },
                include: { documentType: true }
            }),
            prisma.auditLog.create({
                data: {
                    agencyId: agencyUser.agencyId,
                    userId: agencyUser.id,
                    action: `document.${status.toLowerCase()}`,
                    entity: 'ComplianceDocument',
                    entityId: doc.id,
                    metadata: { notes, documentType: doc.documentTypeId }
                }
            })
        ]);

        res.json({ data: updated });
    } catch (error) {
        console.error('Error verifying document:', error);
        res.status(500).json({ error: 'Failed to verify document' });
    }
});

module.exports = router;
