'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWorkerDocuments, uploadWorkerDocument } from '@/lib/api/worker';
import styles from './dashboard.module.css';

interface Document {
    id: string;
    fileName: string;
    docType: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    expiryColor: 'green' | 'yellow' | 'red' | 'gray';
    uploadedAt: string;
}

export default function WorkerDashboardPage() {
    const router = useRouter();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const data = await getWorkerDocuments();
            setDocuments(data.documents || []);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to load documents');
            if (err.message.includes('401')) {
                router.push('/worker-signin');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        if (!formData.get('file') || !formData.get('documentTypeId')) {
            setError('Please select both file and document type');
            return;
        }

        try {
            setUploading(true);
            setUploadProgress(0);
            setError('');

            const file = formData.get('file') as File;

            // Client-side validation
            if (file.size > 10 * 1024 * 1024) {
                setError('File too large (max 10 MB)');
                return;
            }

            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                setError('Invalid file type (PDF or image only)');
                return;
            }

            // Simulate progress
            setUploadProgress(30);
            await new Promise((resolve) => setTimeout(resolve, 300));

            await uploadWorkerDocument(formData);

            setUploadProgress(100);
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Refresh document list
            await loadDocuments();

            // Reset form
            (e.target as HTMLFormElement).reset();
            setUploadProgress(0);
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const getExpiryMessage = (doc: Document): string => {
        if (!doc.expiryDate) return 'No expiry date';
        if (doc.daysUntilExpiry === null) return '';
        if (doc.daysUntilExpiry < 0) return `EXPIRED ${Math.abs(doc.daysUntilExpiry)} days ago`;
        if (doc.daysUntilExpiry === 0) return 'Expires TODAY';
        if (doc.daysUntilExpiry === 1) return 'Expires tomorrow';
        return `Expires in ${doc.daysUntilExpiry} days`;
    };

    const getStatusBadgeClass = (status: string): string => {
        switch (status) {
            case 'APPROVED':
                return styles.statusApproved;
            case 'PENDING':
                return styles.statusPending;
            case 'REJECTED':
                return styles.statusRejected;
            case 'EXPIRED':
                return styles.statusExpired;
            default:
                return styles.statusPending;
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Compliance Documents</h1>
                <p>Manage your compliance documents with ShiftWise</p>
            </header>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.content}>
                {/* Upload Section */}
                <section className={styles.uploadSection}>
                    <h2>Upload Document</h2>
                    <form onSubmit={handleFileUpload} className={styles.uploadForm}>
                        <div className={styles.formGroup}>
                            <label htmlFor="documentTypeId">Document Type</label>
                            <select
                                id="documentTypeId"
                                name="documentTypeId"
                                required
                                disabled={uploading}
                                className={styles.select}
                            >
                                <option value="">Select a document type...</option>
                                <option value="dbs">DBS Check</option>
                                <option value="rtw">Right to Work</option>
                                <option value="passport">Passport</option>
                                <option value="training">Training Certificate</option>
                                <option value="vaccination">Vaccination Records</option>
                                <option value="reference">Reference</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="file">File Upload (PDF or Image)</label>
                            <input
                                id="file"
                                type="file"
                                name="file"
                                accept=".pdf,image/jpeg,image/png"
                                required
                                disabled={uploading}
                                className={styles.fileInput}
                            />
                            <p className={styles.fileHint}>Max 10 MB, PDF or image format</p>
                        </div>

                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className={styles.progressContainer}>
                                <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }} />
                            </div>
                        )}

                        <button
                            type="submit"
                            className={styles.uploadButton}
                            disabled={uploading || !documents}
                        >
                            {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Document'}
                        </button>
                    </form>
                </section>

                {/* Documents List Section */}
                <section className={styles.documentsSection}>
                    <h2>Your Documents</h2>

                    {loading ? (
                        <p className={styles.loading}>Loading documents...</p>
                    ) : documents.length === 0 ? (
                        <p className={styles.emptyState}>No documents uploaded yet. Start by uploading your first document above.</p>
                    ) : (
                        <div className={styles.documentsList}>
                            {documents.map((doc) => (
                                <div key={doc.id} className={`${styles.documentCard} ${styles[`color-${doc.expiryColor}`]}`}>
                                    <div className={styles.docHeader}>
                                        <h3 className={styles.docName}>{doc.docType}</h3>
                                        <span className={`${styles.docStatus} ${getStatusBadgeClass(doc.status)}`}>
                                            {doc.status}
                                        </span>
                                    </div>

                                    <p className={styles.fileName}>{doc.fileName}</p>

                                    <div className={styles.docMeta}>
                                        <span className={styles.uploadDate}>
                                            Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {doc.expiryDate && (
                                        <div className={`${styles.expiryAlert} ${styles[`alert-${doc.expiryColor}`]}`}>
                                            <strong>{getExpiryMessage(doc)}</strong>
                                            {doc.expiryColor === 'red' && <span className={styles.actionBadge}>ACTION REQUIRED</span>}
                                            {doc.expiryColor === 'yellow' && <span className={styles.warningBadge}>REVIEW SOON</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
