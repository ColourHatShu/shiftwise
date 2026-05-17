"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
    ArrowLeft, Mail, Phone, Calendar, Briefcase,
    Upload, Eye, CheckCircle2, Clock, AlertCircle, XCircle,
    FileText, X, Edit, UserX, Trash2, UserCheck
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import EditWorkerModal from '../components/EditWorkerModal';
import { downloadDocument, getDocumentStatus, pollDocumentStatus } from "@/lib/api/documents";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const statusConfig: Record<string, { label: string; classes: string; icon: any }> = {
    NOT_UPLOADED: { label: "Not Uploaded", classes: "bg-slate-700/50 text-slate-400 border-slate-600/50", icon: XCircle },
    PENDING: { label: "Pending Review", classes: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
    AI_ANALYSED: { label: "Scanned", classes: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: FileText },
    APPROVED: { label: "Verified", classes: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
    EXPIRING_SOON: { label: "Expiring Soon", classes: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: AlertCircle },
    EXPIRED: { label: "Expired", classes: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertCircle },
    REJECTED: { label: "Non-Compliant", classes: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ docType, workerId, onClose, onSuccess }: any) {
    const { getToken } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;
        setUploading(true);
        setError("");

        try {
            const token = await getToken();
            const fd = new FormData();
            fd.append("file", file);
            fd.append("workerId", workerId);
            fd.append("documentTypeId", docType.id);

            const res = await fetch(`${API_URL}/api/documents/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }

            const payload = await res.json();

            // Reverted upload no longer does synchronous AI scanning.
            toast.success("Document uploaded successfully");
            onSuccess(payload.data); // Pass the new document back upstream to auto-trigger the review modal
        } catch (err: any) {
            setError(err.message);
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold text-white">Upload Document</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{docType.name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* File picker */}
                    <div
                        className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
                        onClick={() => inputRef.current?.click()}
                    >
                        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
                            onChange={e => setFile(e.target.files?.[0] || null)} />
                        {file ? (
                            <div>
                                <FileText size={24} className="text-blue-400 mx-auto mb-2" />
                                <p className="text-sm text-white font-medium">{file.name}</p>
                                <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <>
                                <Upload size={24} className="text-slate-500 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">Click to select a file</p>
                                <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG, DOC up to 10MB</p>
                            </>
                        )}
                    </div>

                    {/* Expiry date input removed - now handled by automated background scan */}
                    {docType.hasExpiry && (
                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-3 rounded-xl flex gap-3 text-sm">
                            <FileText size={16} className="mt-0.5 shrink-0" />
                            <p>This document will be automatically scanned to verify the expiry date after you upload.</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-slate-700 hover:bg-slate-700/50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={!file || uploading}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-wait text-white transition-colors flex items-center justify-center gap-2">
                            {uploading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Uploading...</> : <><Upload size={16} />Upload</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Document Review Modal (Automated Scanning) ──────────────────────────────
function AnalysisModal({ document, onClose, onSuccess }: any) {
    const { getToken } = useAuth();
    const [loadingAI, setLoadingAI] = useState(true);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [notes, setNotes] = useState("");
    const [loadingMsg, setLoadingMsg] = useState("Checking your document...");
    const [manualExpiry, setManualExpiry] = useState("");

    useEffect(() => {
        const msgs = [
            'Checking your document...', 'Reviewing compliance details...',
            'Processing your file...', 'Verifying document information...',
            'Almost there...', 'Reading document details...'
        ];
        setLoadingMsg(msgs[Math.floor(Math.random() * msgs.length)]);
    }, []);


    const runAnalysis = async (forceRescan = false) => {
        setLoadingAI(true);
        setError("");
        try {
            // Try to fetch cached analysis first
            const statusRes = await getDocumentStatus(document.id, getToken);

            if (statusRes.data.status === 'completed' && statusRes.data.analysisResult) {
                // Already has analysis result
                const parsed = statusRes.data.analysisResult;

                // Fire toasts based on the analysis result
                if (document.documentType?.hasExpiry && parsed.expiryDate && parsed.expiryDate !== 'null') {
                    toast.success(`Document scanned — Expiry date found: ${new Date(parsed.expiryDate).toLocaleDateString()}`);
                } else if (document.documentType?.hasExpiry) {
                    toast.error("Document scanned — No expiry date found, please add manually", { icon: "⚠️" });
                } else {
                    toast.success("Document scanned successfully");
                }
                if (parsed.concerns?.some((c: string) => c.includes("mismatch"))) {
                    toast.error("Name mismatch detected — please review", { icon: "⚠️", duration: 6000 });
                }

                setResult(parsed);
            } else if (statusRes.data.status === 'pending') {
                // Polling still in progress
                try {
                    const polled = await pollDocumentStatus(document.id, getToken, {
                        maxRetries: 30,
                        initialDelay: 500,
                        maxDelay: 2000
                    });

                    const parsed = polled.data.analysisResult;
                    if (polled.data.status === 'completed' && parsed) {
                        // Fire toasts based on the analysis result
                        if (document.documentType?.hasExpiry && parsed.expiryDate && parsed.expiryDate !== 'null') {
                            toast.success(`Document scanned — Expiry date found: ${new Date(parsed.expiryDate).toLocaleDateString()}`);
                        } else if (document.documentType?.hasExpiry) {
                            toast.error("Document scanned — No expiry date found, please add manually", { icon: "⚠️" });
                        } else {
                            toast.success("Document scanned successfully");
                        }
                        if (parsed.concerns?.some((c: string) => c.includes("mismatch"))) {
                            toast.error("Name mismatch detected — please review", { icon: "⚠️", duration: 6000 });
                        }
                        setResult(parsed);
                    } else {
                        setError("Document analysis failed or timed out");
                    }
                } catch (pollErr: any) {
                    setError(pollErr.message || "Document analysis timed out");
                }
            } else if (statusRes.data.status === 'failed') {
                setError("Document scanning failed. Please try uploading again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch document status");
        } finally {
            setLoadingAI(false);
        }
    };

    useEffect(() => {
        runAnalysis();
    }, [document.id, getToken]);

    const handleVerify = async (status: "APPROVED" | "REJECTED") => {
        setVerifying(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/documents/${document.id}/verify`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status, notes, manualExpiryDate: manualExpiry || undefined })
            });
            if (!res.ok) throw new Error(`Failed to ${status === "APPROVED" ? "verify" : "reject"} document`);
            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Document Review</h2>
                            <p className="text-sm text-slate-400 mt-0.5">{document.documentType?.name}</p>
                        </div>
                    </div>
                    {!loadingAI && !verifying && (
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}

                {loadingAI ? (
                    <div className="py-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
                        <p className="text-blue-400 font-medium">{loadingMsg}</p>
                        <p className="text-sm text-slate-400 mt-1">Extracting details and checking for anomalies</p>
                    </div>
                ) : result ? (
                    <div className="space-y-5">
                        {result.wrongDocumentWarning && (
                            <div className="bg-amber-500 border border-amber-600 rounded-xl p-4 shadow-lg shadow-amber-500/20 mb-6">
                                <div className="flex items-start gap-3 text-slate-900">
                                    <AlertCircle size={20} className="mt-0.5 shrink-0" />
                                    <div>
                                        <h3 className="font-bold mb-1">Warning: Document Mismatch</h3>
                                        <p className="text-sm font-medium">{result.wrongDocumentWarning}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4">
                            <p className="text-sm text-blue-100 italic">"{result.summary}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-xs text-slate-500 mb-1">Name Found</p>
                                <p className="text-sm font-medium text-white">{result.fullName || "Not found"}</p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-xs text-slate-500 mb-1">Document Type Detected</p>
                                <p className="text-sm font-medium text-white">{result.documentType || "Not found"}</p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-xs text-slate-500 mb-1">Document Number</p>
                                <p className="text-sm font-medium text-white">{result.documentNumber || "Not found"}</p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-xs text-slate-500 mb-1">Issuing Authority</p>
                                <p className="text-sm font-medium text-white">{result.issuingAuthority || "Not found"}</p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-xs text-slate-500 mb-1">Issue Date</p>
                                <p className="text-sm font-medium text-white">{result.issueDate || "Not found"}</p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <p className="text-xs text-slate-500 mb-1">Expiry Date</p>
                                <p className="text-sm font-medium text-white">
                                    {result.expiryDate && result.expiryDate !== 'null' ? result.expiryDate : (document.documentType?.hasExpiry ? "Not found" : "None")}
                                </p>
                            </div>
                        </div>

                        {(() => {
                            const validConcerns = (result.concerns || []).filter((c: string) =>
                                !['array', 'of', 'issues', 'or', 'anomalies', 'noticed', 'empty', 'none', 'null'].includes(c.toLowerCase().trim())
                            );
                            if (validConcerns.length === 0) return null;
                            return (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                    <h3 className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-2">
                                        <AlertCircle size={14} /> Attention Needed
                                    </h3>
                                    <ul className="text-sm text-amber-200/80 list-disc pl-4 space-y-1">
                                        {validConcerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                                    </ul>
                                </div>
                            );
                        })()}

                        {document.documentType?.hasExpiry && (!result.expiryDate || result.expiryDate === 'null' || result.expiryDate === 'None') && (
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-blue-500/30">
                                <label className="text-sm font-bold text-blue-400 block mb-2 flex items-center gap-2">
                                    <Calendar size={14} /> Expiry date not detected — please enter manually
                                </label>
                                <input
                                    type="date"
                                    value={manualExpiry}
                                    onChange={(e) => setManualExpiry(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium text-slate-300 block mb-1.5">Coordinator Notes (Optional)</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add any notes about this verification..."
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 h-20 resize-none transition-colors"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => runAnalysis(true)} disabled={verifying}
                                className="px-4 py-3 rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-sm font-medium transition-colors">
                                Re-scan
                            </button>
                            <button onClick={() => handleVerify("REJECTED")} disabled={verifying}
                                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                                {verifying ? "Processing..." : "Reject Document"}
                            </button>
                            <button onClick={() => handleVerify("APPROVED")} disabled={verifying}
                                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/25 transition-colors">
                                {verifying ? "Processing..." : "Verify & Approve"}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// ─── Main Worker Profile Page ─────────────────────────────────────────────────
export default function WorkerProfilePage() {
    const params = useParams() as any;
    const workerId = params?.id;
    const router = useRouter();
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [worker, setWorker] = useState<any>(null);
    const [docSlots, setDocSlots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [uploadTarget, setUploadTarget] = useState<any>(null);
    const [analysisTarget, setAnalysisTarget] = useState<any>(null);
    const [editTarget, setEditTarget] = useState<boolean>(false);

    const fetchAll = async () => {
        if (!isLoaded || !isSignedIn || !workerId) return;
        try {
            const token = await getToken();
            const [workerRes, docsRes] = await Promise.all([
                fetch(`${API_URL}/api/workers/${workerId}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/api/documents/worker/${workerId}`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            if (!workerRes.ok) throw new Error(workerRes.status === 404 ? "Worker not found" : "Failed to load");
            const { data: w } = await workerRes.json();
            setWorker(w);
            if (docsRes.ok) {
                const { data: slots } = await docsRes.json();
                setDocSlots(slots);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeactivate = async () => {
        if (!worker) return;
        const confirmMsg = `Are you sure you want to deactivate ${worker.firstName} ${worker.lastName}? They will no longer appear in active searches.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/workers/${workerId}/deactivate`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to deactivate worker");
            toast.success("Worker deactivated");
            fetchAll();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleReactivate = async () => {
        if (!worker) return;

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/workers/${workerId}/reactivate`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to reactivate worker");
            toast.success("Worker restored to active status");
            fetchAll();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDeleteWorker = async () => {
        if (!worker) return;
        const confirmMsg = `This will permanently delete ${worker.firstName} ${worker.lastName} and all their documents. This cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/workers/${workerId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete worker");
            toast.success("Worker deleted permanently");
            router.push("/dashboard/workers");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    useEffect(() => { fetchAll(); }, [workerId, isLoaded, isSignedIn]);

    if (!isLoaded || isLoading) {
        return <div className="flex h-[50vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
    }
    if (error) {
        return (
            <div className="text-center py-20">
                <p className="text-red-400 mb-4">{error}</p>
                <Link href="/dashboard/workers" className="text-blue-400 hover:text-blue-300">← Back to Workers</Link>
            </div>
        );
    }
    if (!worker) return null;

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Upload & Analysis modals */}
            {uploadTarget && (
                <UploadModal
                    docType={uploadTarget}
                    workerId={workerId}
                    onClose={() => setUploadTarget(null)}
                    onSuccess={() => { setUploadTarget(null); setIsLoading(true); fetchAll(); }}
                />
            )}
            {analysisTarget && (
                <AnalysisModal
                    document={analysisTarget}
                    onClose={() => setAnalysisTarget(null)}
                    onSuccess={() => { setAnalysisTarget(null); setIsLoading(true); fetchAll(); }}
                />
            )}
            {editTarget && (
                <EditWorkerModal
                    worker={worker}
                    onClose={() => setEditTarget(false)}
                    onSuccess={() => { setEditTarget(false); setIsLoading(true); fetchAll(); }}
                />
            )}

            {/* Back */}
            <Link href="/dashboard/workers" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
                <ArrowLeft size={16} /> Back to Workers
            </Link>

            {/* Worker header card */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-start gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                        {worker.firstName[0]}{worker.lastName[0]}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-white">{worker.firstName} {worker.lastName}</h1>
                                {worker.status === 'INACTIVE' && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-400 border border-slate-600/50">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-400 mt-0.5">{worker.jobTitle || "No role assigned"}</p>
                            <button
                                onClick={() => setEditTarget(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Edit size={16} /> Edit
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-300">
                            <span className="flex items-center gap-2"><Mail size={14} className="text-slate-500" />{worker.email}</span>
                            {worker.phone && <span className="flex items-center gap-2"><Phone size={14} className="text-slate-500" />{worker.phone}</span>}
                            {worker.startDate && <span className="flex items-center gap-2"><Calendar size={14} className="text-slate-500" />Started {format(new Date(worker.startDate), "MMM dd, yyyy")}</span>}
                            <span className="flex items-center gap-2"><Briefcase size={14} className="text-slate-500" />ID: {worker.id.slice(-8).toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                {/* Additional Risk Actions */}
                <div className="mt-6 pt-5 border-t border-slate-700/50 flex gap-4">
                    {worker.status !== 'INACTIVE' ? (
                        <button
                            onClick={handleDeactivate}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-colors"
                        >
                            <UserX size={16} /> Deactivate Worker
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleReactivate}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-500 hover:text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl transition-colors"
                            >
                                <UserCheck size={16} /> Reactivate Worker
                            </button>
                            <button
                                onClick={handleDeleteWorker}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors"
                            >
                                <Trash2 size={16} /> Delete Worker (Permanent)
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Compliance Documents */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900/30">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileText size={18} className="text-blue-400" /> Compliance Documents
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">{docSlots.filter(s => s.document).length} of {docSlots.length} documents uploaded</p>
                    </div>
                </div>

                <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {docSlots.length === 0 ? (
                        <div className="col-span-4 text-center py-8 text-slate-500 text-sm">
                            Document types loading... If this persists, navigate away and return.
                        </div>
                    ) : docSlots.map((slot: any) => {
                        const { documentType: dt, document: doc, computedStatus } = slot;
                        const cfg = statusConfig[computedStatus] || statusConfig.NOT_UPLOADED;
                        const Icon = cfg.icon;

                        return (
                            <div key={dt.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3 hover:border-slate-600 transition-colors">
                                {/* Doc type name + status */}
                                <div>
                                    <p className="text-sm font-semibold text-white">{dt.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{dt.description}</p>
                                </div>

                                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border w-fit ${cfg.classes}`}>
                                    <Icon size={11} /> {cfg.label}
                                </span>

                                {/* Expiry */}
                                {(() => {
                                    if (!doc?.expiryDate) return null;

                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const expDate = new Date(doc.expiryDate);
                                    expDate.setHours(0, 0, 0, 0);

                                    const diffTime = expDate.getTime() - today.getTime();
                                    const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

                                    let expColor = "text-slate-300";
                                    let expText = `Expires in ${daysRemaining} days`;

                                    if (daysRemaining < 0) {
                                        expColor = "text-red-900 font-bold bg-red-100 px-1 rounded"; // Dark red
                                        expText = `Expired ${Math.abs(daysRemaining)} days ago`;
                                    } else if (daysRemaining <= 13) {
                                        expColor = "text-red-500 font-bold";
                                        expText = `Expires in ${daysRemaining} days`;
                                    } else if (daysRemaining <= 30) {
                                        expColor = "text-orange-400 font-semibold";
                                        expText = `Expires in ${daysRemaining} days`;
                                    } else {
                                        expColor = "text-green-400 font-medium";
                                        expText = `Expires in ${daysRemaining} days`;
                                    }

                                    return (
                                        <p className="text-xs text-slate-500">
                                            Expires: <span className={expColor}>{expText}</span>
                                            <span className="block mt-0.5 opacity-60">({format(expDate, "dd MMM yyyy")})</span>
                                        </p>
                                    );
                                })()}

                                {/* Actions */}
                                <div className="flex gap-2 mt-auto">
                                    {doc && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await downloadDocument(doc.id, getToken);
                                                    toast.success('Document downloaded');
                                                } catch (error) {
                                                    console.error('Download failed:', error);
                                                    toast.error(error instanceof Error ? error.message : 'Failed to download document');
                                                }
                                            }}
                                            className="flex-none flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-all"
                                            title="Download document">
                                            <Eye size={12} />
                                        </button>
                                    )}
                                    {doc && (
                                        <>
                                            <button onClick={() => setAnalysisTarget(doc)}
                                                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all">
                                                <FileText size={12} /> Review Document
                                            </button>
                                            <button onClick={() => setUploadTarget(dt)}
                                                className="flex-none flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all"
                                                title="Replace Document">
                                                <Upload size={12} />
                                            </button>
                                        </>
                                    )}
                                    {!doc && (
                                        <button onClick={() => setUploadTarget(dt)}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-all">
                                            <Upload size={12} /> Upload
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Notes */}
            {worker.notes && (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                    <h2 className="font-semibold text-white mb-2">Notes</h2>
                    <p className="text-slate-400 text-sm whitespace-pre-wrap">{worker.notes}</p>
                </div>
            )}
        </div>
    );
}
