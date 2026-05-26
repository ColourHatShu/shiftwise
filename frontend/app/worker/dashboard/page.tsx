'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWorkerDocuments, uploadWorkerDocument } from '@/lib/api/worker';
import { optimizePhoto } from '@/lib/api/worker';
import { calculateComplianceScore, getComplianceColor, getComplianceMessage } from '@/lib/worker-compliance';
import { getOfflineDocuments, cacheDocuments, startOfflineMonitoring, queueUpload, retryQueuedUploads } from '@/lib/worker-offline';
import toast from 'react-hot-toast';

interface Document {
    id: string;
    fileName: string;
    docType: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    expiryColor: 'green' | 'yellow' | 'red' | 'gray';
    uploadedAt: string;
    rejectionReason?: string;
    documentTypeId: string;
}

interface DocumentType {
    id: string;
    name: string;
    isRequired: boolean;
    expiryWarningDays: number;
    hasExpiry: boolean;
}

export default function WorkerDashboardPage() {
    const router = useRouter();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isOffline, setIsOffline] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState('');
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load documents and document types on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);

                // Try online first, fallback to offline cache
                if (navigator.onLine) {
                    const [docsData, typesData] = await Promise.all([
                        getWorkerDocuments(),
                        fetch('/api/worker/document-types').then(r => {
                            if (!r.ok) throw new Error('Failed to fetch document types');
                            return r.json();
                        })
                    ]);

                    setDocuments(docsData.documents || []);
                    setDocumentTypes(typesData.documentTypes || []);
                    cacheDocuments(docsData.documents || []);
                    setIsOffline(false);
                } else {
                    const cached = getOfflineDocuments();
                    if (cached) {
                        // Cached entries may lack documentTypeId (older schema); coerce to '' so
                        // typing matches the live API shape — compliance scoring will treat
                        // these as "unmatched" rather than crash.
                        setDocuments(cached.map((d) => ({ ...d, documentTypeId: d.documentTypeId ?? '' })));
                        setIsOffline(true);
                    }
                }
                setError('');
            } catch (err: any) {
                // Fallback to cache if available
                const cached = getOfflineDocuments();
                if (cached) {
                    setDocuments(cached.map((d) => ({ ...d, documentTypeId: d.documentTypeId ?? '' })));
                    setIsOffline(true);
                    setError('');
                } else {
                    setError(err.message || 'Failed to load documents');
                    if (err.message?.includes('401')) {
                        router.push('/worker-signin');
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [router]);

    // Monitor offline status and setup retry
    useEffect(() => {
        const unsubscribe = startOfflineMonitoring(async () => {
            setIsOffline(false);
            try {
                const data = await getWorkerDocuments();
                setDocuments(data.documents || []);
                cacheDocuments(data.documents || []);

                // Try to retry queued uploads
                const result = await retryQueuedUploads((formData) => uploadWorkerDocument(formData));
                if (result.success && result.message !== 'No queued uploads') {
                    toast.success(result.message);
                }
            } catch (err) {
                console.error('Failed to refresh documents:', err);
            }
        });

        const handleOffline = () => setIsOffline(true);
        window.addEventListener('offline', handleOffline);

        return () => {
            unsubscribe();
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleCameraClick = () => {
        cameraInputRef.current?.click();
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isCamera: boolean) => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;

        try {
            let fileToUpload = file;

            // Optimize photo if it's from camera
            if (isCamera) {
                toast.loading('Optimizing photo...');
                try {
                    fileToUpload = await optimizePhoto(file);
                    toast.dismiss();
                } catch (err) {
                    console.error('Photo optimization failed, using original:', err);
                    toast.dismiss();
                    // Continue with original if optimization fails
                }
            }

            // Populate form with the file
            if (fileInputRef.current) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(fileToUpload);
                fileInputRef.current.files = dataTransfer.files;
            }
        } catch (err: any) {
            setError(`Camera error: ${err.message}`);
        }
    };

    const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const file = formData.get('file') as File;
        const docTypeId = formData.get('documentTypeId') as string;

        if (!file || !docTypeId) {
            setError('Please select both file and document type');
            return;
        }

        try {
            setUploading(true);
            setUploadProgress(0);
            setError('');

            // Validation
            if (file.size > 10 * 1024 * 1024) {
                setError(`File too large. Maximum size: 10 MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                return;
            }

            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                setError('Invalid file type. Only PDF and image files (JPG, PNG) are allowed.');
                return;
            }

            // Show optimistic document
            const optimisticId = Math.random().toString(36);
            const newFormData = new FormData();
            newFormData.append('file', file);
            newFormData.append('documentTypeId', docTypeId);

            setUploadProgress(30);
            await new Promise((resolve) => setTimeout(resolve, 300));

            await uploadWorkerDocument(newFormData);
            setUploadProgress(100);

            toast.success('Upload complete! Processing your document...');
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Refresh documents
            const data = await getWorkerDocuments();
            setDocuments(data.documents || []);
            cacheDocuments(data.documents || []);

            // Reset form
            (e.target as HTMLFormElement).reset();
            setSelectedDocType('');
            setUploadProgress(0);
        } catch (err: any) {
            if (!navigator.onLine) {
                // Queue for retry
                const queueId = queueUpload(file, docTypeId);
                toast('Offline: Upload queued and will retry when online', { icon: '📡' });
                setError('');
            } else {
                setError(err.message || 'Upload failed. Please try again.');
            }
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // Calculate compliance score
    const { score, completed, required } = calculateComplianceScore(documents, documentTypes);
    const complianceColor = getComplianceColor(documents, score, required);
    const complianceMessage = getComplianceMessage(complianceColor, score);

    const getStatusBadgeClasses = (status: string): string => {
        const baseClasses = 'text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider';
        switch (status) {
            case 'APPROVED':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'PENDING':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            case 'REJECTED':
                return `${baseClasses} bg-red-100 text-red-800`;
            case 'EXPIRED':
                return `${baseClasses} bg-red-100 text-red-800`;
            default:
                return baseClasses;
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

    const getColorBgClass = (color: string): string => {
        switch (color) {
            case 'red':
                return 'bg-red-50 border-l-4 border-red-500';
            case 'yellow':
                return 'bg-yellow-50 border-l-4 border-yellow-500';
            case 'green':
                return 'bg-green-50 border-l-4 border-green-500';
            default:
                return 'bg-gray-50 border-l-4 border-gray-500';
        }
    };

    const getComplianceBgClass = (color: string): string => {
        switch (color) {
            case 'red':
                return 'bg-red-100 text-red-800';
            case 'yellow':
                return 'bg-yellow-100 text-yellow-800';
            case 'green':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
            {/* Offline Banner */}
            {isOffline && (
                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded">
                    <p className="font-semibold">You're offline</p>
                    <p className="text-sm mt-1">Cached data shown below. Changes will sync when online.</p>
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                    <p className="font-semibold">Error</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            )}

            <div className="max-w-4xl mx-auto">
                {/* Compliance Score Card (Mobile-First) */}
                <div className={`mb-6 p-6 rounded-lg shadow-md ${getComplianceBgClass(complianceColor)} text-center`}>
                    <p className="text-sm font-semibold opacity-75 mb-2">Your Compliance Score</p>
                    <div className="text-6xl font-bold mb-3">{Math.round(score)}%</div>
                    <p className="text-lg font-semibold mb-3">{complianceMessage}</p>
                    <p className="text-sm">
                        {completed} of {required} required documents complete
                    </p>
                    {required > 0 && (
                        <div className="mt-4 w-full bg-gray-300 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-blue-600 h-full transition-all duration-300"
                                style={{ width: `${(completed / required) * 100}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Compliance Checklist */}
                {documentTypes.length > 0 && (
                    <div className="mb-6 p-6 bg-white rounded-lg shadow-md">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Document Checklist</h2>
                        <div className="space-y-3">
                            {documentTypes.map((docType) => {
                                const doc = documents.find((d) => d.documentTypeId === docType.id && d.status === 'APPROVED');
                                const isComplete = !!doc;
                                return (
                                    <div key={docType.id} className="flex items-center p-3 bg-gray-50 rounded">
                                        <div className={`text-xl mr-3 ${isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                                            {isComplete ? '✓' : '○'}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-800">
                                                {docType.name} {docType.isRequired ? '(Required)' : '(Optional)'}
                                            </p>
                                            {doc && doc.expiryDate && (
                                                <p className="text-sm text-gray-600">{getExpiryMessage(doc)}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Upload Section - Mobile First */}
                <div className="mb-6 p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-bold mb-6 text-gray-800">Upload Document</h2>
                    <form onSubmit={handleFileUpload} className="space-y-4">
                        {/* Document Type Dropdown */}
                        <div>
                            <label htmlFor="documentTypeId" className="block text-sm font-semibold text-gray-700 mb-2">
                                Document Type
                            </label>
                            <select
                                id="documentTypeId"
                                name="documentTypeId"
                                value={selectedDocType}
                                onChange={(e) => setSelectedDocType(e.target.value)}
                                required
                                disabled={uploading}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                            >
                                <option value="">
                                    {documentTypes.length === 0 ? 'No document types configured. Contact your coordinator.' : 'Select a document type...'}
                                </option>
                                {documentTypes.map((dt) => (
                                    <option key={dt.id} value={dt.id}>
                                        {dt.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Camera and File Input (Hidden) */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleFileSelect(e, true)}
                            className="hidden"
                            disabled={uploading}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,image/jpeg,image/png"
                            onChange={(e) => handleFileSelect(e, false)}
                            className="hidden"
                            name="file"
                            disabled={uploading}
                        />

                        {/* File Display */}
                        {fileInputRef.current?.files?.length ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                <p className="font-semibold">Selected: {fileInputRef.current.files[0].name}</p>
                                <p className="text-xs mt-1">({(fileInputRef.current.files[0].size / 1024 / 1024).toFixed(2)} MB)</p>
                            </div>
                        ) : null}

                        {/* Upload Buttons - Mobile First (Two-Button on Mobile, Single on Desktop) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Camera Button (Mobile Only) */}
                            <button
                                type="button"
                                onClick={handleCameraClick}
                                disabled={uploading}
                                className="block sm:hidden w-full h-12 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                            >
                                📷 Take Photo
                            </button>

                            {/* File Button */}
                            <button
                                type="button"
                                onClick={handleFileClick}
                                disabled={uploading}
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                            >
                                📄 Choose File
                            </button>

                            {/* Upload Button */}
                            <button
                                type="submit"
                                disabled={uploading || !fileInputRef.current?.files?.length}
                                className="w-full h-12 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors sm:col-span-2"
                            >
                                {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
                            </button>
                        </div>

                        {/* Progress Bar */}
                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}

                        <p className="text-xs text-gray-500 mt-2">Max 10 MB. Supported: PDF, JPG, PNG</p>
                    </form>
                </div>

                {/* Documents List - Stacked on Mobile */}
                <div className="p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-bold mb-6 text-gray-800">Your Documents</h2>

                    {loading ? (
                        <p className="text-center text-gray-500 py-8">Loading documents...</p>
                    ) : documents.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No documents uploaded yet. Start by uploading your first document above.</p>
                    ) : (
                        <div className="space-y-4">
                            {documents.map((doc) => (
                                <div key={doc.id} className={`p-4 rounded-lg ${getColorBgClass(doc.expiryColor)}`}>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">{doc.docType}</h3>
                                            <p className="text-sm text-gray-600 mt-1">{doc.fileName}</p>
                                        </div>
                                        <span className={getStatusBadgeClasses(doc.status)}>{doc.status}</span>
                                    </div>

                                    <p className="text-xs text-gray-600 mb-3">Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</p>

                                    {doc.expiryDate && (
                                        <div className="mt-3 p-3 bg-white bg-opacity-70 rounded text-sm font-semibold">
                                            {getExpiryMessage(doc)}
                                        </div>
                                    )}

                                    {doc.status === 'REJECTED' && doc.rejectionReason && (
                                        <div className="mt-3 p-3 bg-red-100 rounded text-sm text-red-800">
                                            <p className="font-semibold mb-2">Rejection Reason:</p>
                                            <p>{doc.rejectionReason}</p>
                                            <button
                                                onClick={() => {
                                                    setSelectedDocType(doc.documentTypeId);
                                                    document.getElementById('documentTypeId')?.focus();
                                                    toast.success('Ready to re-upload. Choose file and submit.');
                                                }}
                                                className="mt-2 px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors"
                                            >
                                                Re-upload
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
