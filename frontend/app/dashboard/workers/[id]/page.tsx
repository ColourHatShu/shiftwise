"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
    ArrowLeft, Mail, Phone, Calendar, Briefcase,
    Upload, Eye, CheckCircle2, Clock, AlertCircle, XCircle,
    FileText, X, Edit, UserX, Trash2, UserCheck, TrendingUp
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import EditWorkerModal from '../components/EditWorkerModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { downloadDocument, getDocumentStatus, pollDocumentStatus } from "@/lib/api/documents";
import { useApi } from "@/lib/use-api";
import type { Worker, DocumentType, ComplianceDocument, DocSlot, AnalysisResult } from "@/types/api";
import { reliabilityRateStyle } from "@/lib/reliability";

const statusConfig: Record<string, { label: string; classes: string; icon: any }> = {
    NOT_UPLOADED: { label: "Not Uploaded", classes: "bg-[#EBEEF5] text-[#5B6E8C] border-[#DDE3EE]", icon: XCircle },
    PENDING: { label: "Pending Review", classes: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    AI_ANALYSED: { label: "Scanned", classes: "bg-blue-50 text-blue-700 border-blue-200", icon: FileText },
    APPROVED: { label: "Verified", classes: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
    EXPIRING_SOON: { label: "Expiring Soon", classes: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: AlertCircle },
    EXPIRED: { label: "Expired", classes: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
    REJECTED: { label: "Non-Compliant", classes: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ docType, workerId, onClose, onSuccess }: { docType: DocumentType; workerId: string; onClose: () => void; onSuccess: (doc?: ComplianceDocument) => void }) {
    const { apiFetch } = useApi();
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
            const fd = new FormData();
            fd.append("file", file);
            fd.append("workerId", workerId);
            fd.append("documentTypeId", docType.id);

            const res = await apiFetch(`/api/documents/upload`, {
                method: "POST",
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white border border-[#DDE3EE] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold text-[#0A1628]">Upload Document</h2>
                        <p className="text-sm text-[#5B6E8C] mt-0.5">{docType.name}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close dialog" className="text-[#5B6E8C] hover:text-[#0A1628] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* File picker */}
                    <div
                        className="border-2 border-dashed border-[#DDE3EE] hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
                        onClick={() => inputRef.current?.click()}
                    >
                        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
                            onChange={e => setFile(e.target.files?.[0] || null)} />
                        {file ? (
                            <div>
                                <FileText size={24} className="text-blue-700 mx-auto mb-2" />
                                <p className="text-sm text-[#0A1628] font-medium">{file.name}</p>
                                <p className="text-xs text-[#5B6E8C] mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <>
                                <Upload size={24} className="text-[#5B6E8C] mx-auto mb-2" />
                                <p className="text-sm text-[#5B6E8C]">Click to select a file</p>
                                <p className="text-xs text-[#5B6E8C] mt-1">PDF, JPG, PNG, DOC up to 10MB</p>
                            </>
                        )}
                    </div>

                    {/* Expiry date input removed - now handled by automated background scan */}
                    {docType.hasExpiry && (
                        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-xl flex gap-3 text-sm">
                            <FileText size={16} className="mt-0.5 shrink-0" />
                            <p>This document will be automatically scanned to verify the expiry date after you upload.</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#5B6E8C] border border-[#DDE3EE] hover:bg-[#F5F7FA] transition-colors">
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
function AnalysisModal({ document, onClose, onSuccess }: { document: ComplianceDocument; onClose: () => void; onSuccess: () => void }) {
    const { getToken } = useAuth();
    const { apiFetch } = useApi();
    const [loadingAI, setLoadingAI] = useState(true);
    const [result, setResult] = useState<AnalysisResult | null>(null);
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
            const res = await apiFetch(`/api/documents/${document.id}/verify`, {
                method: "PATCH",
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-[#DDE3EE] rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#0A1628]">Document Review</h2>
                            <p className="text-sm text-[#5B6E8C] mt-0.5">{document.documentType?.name}</p>
                        </div>
                    </div>
                    {!loadingAI && !verifying && (
                        <button onClick={onClose} aria-label="Close dialog" className="text-[#5B6E8C] hover:text-[#0A1628] transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}

                {loadingAI ? (
                    <div className="py-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
                        <p className="text-blue-700 font-medium">{loadingMsg}</p>
                        <p className="text-sm text-[#5B6E8C] mt-1">Extracting details and checking for anomalies</p>
                    </div>
                ) : result ? (
                    <div className="space-y-5">
                        {result.wrongDocumentWarning && (
                            <div className="bg-amber-500 border border-amber-600 rounded-xl p-4 shadow-lg shadow-amber-500/20 mb-6">
                                <div className="flex items-start gap-3 text-[#0A1628]">
                                    <AlertCircle size={20} className="mt-0.5 shrink-0" />
                                    <div>
                                        <h3 className="font-bold mb-1">Warning: Document Mismatch</h3>
                                        <p className="text-sm font-medium">{result.wrongDocumentWarning}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-900 italic">"{result.summary}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DDE3EE]">
                                <p className="text-xs text-[#5B6E8C] mb-1">Name Found</p>
                                <p className="text-sm font-medium text-[#0A1628]">{result.fullName || "Not found"}</p>
                            </div>
                            <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DDE3EE]">
                                <p className="text-xs text-[#5B6E8C] mb-1">Document Type Detected</p>
                                <p className="text-sm font-medium text-[#0A1628]">{result.documentType || "Not found"}</p>
                            </div>
                            <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DDE3EE]">
                                <p className="text-xs text-[#5B6E8C] mb-1">Document Number</p>
                                <p className="text-sm font-medium text-[#0A1628]">{result.documentNumber || "Not found"}</p>
                            </div>
                            <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DDE3EE]">
                                <p className="text-xs text-[#5B6E8C] mb-1">Issuing Authority</p>
                                <p className="text-sm font-medium text-[#0A1628]">{result.issuingAuthority || "Not found"}</p>
                            </div>
                            <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DDE3EE]">
                                <p className="text-xs text-[#5B6E8C] mb-1">Issue Date</p>
                                <p className="text-sm font-medium text-[#0A1628]">{result.issueDate || "Not found"}</p>
                            </div>
                            <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DDE3EE]">
                                <p className="text-xs text-[#5B6E8C] mb-1">Expiry Date</p>
                                <p className="text-sm font-medium text-[#0A1628]">
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
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
                                        <AlertCircle size={14} /> Attention Needed
                                    </h3>
                                    <ul className="text-sm text-amber-700 list-disc pl-4 space-y-1">
                                        {validConcerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                                    </ul>
                                </div>
                            );
                        })()}

                        {document.documentType?.hasExpiry && (!result.expiryDate || result.expiryDate === 'null' || result.expiryDate === 'None') && (
                            <div className="bg-[#F5F7FA] p-4 rounded-xl border border-blue-200">
                                <label className="text-sm font-bold text-blue-700 block mb-2 flex items-center gap-2">
                                    <Calendar size={14} /> Expiry date not detected — please enter manually
                                </label>
                                <input
                                    type="date"
                                    value={manualExpiry}
                                    onChange={(e) => setManualExpiry(e.target.value)}
                                    className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium text-[#5B6E8C] block mb-1.5">Coordinator Notes (Optional)</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add any notes about this verification..."
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 h-20 resize-none transition-colors"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => runAnalysis(true)} disabled={verifying}
                                className="px-4 py-3 rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium transition-colors">
                                Re-scan
                            </button>
                            <button onClick={() => handleVerify("REJECTED")} disabled={verifying}
                                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors">
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
    const params = useParams();
    const workerId = params?.id as string;
    const router = useRouter();
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const { apiFetch } = useApi();

    const [worker, setWorker] = useState<Worker | null>(null);
    const [docSlots, setDocSlots] = useState<DocSlot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [uploadTarget, setUploadTarget] = useState<DocumentType | null>(null);
    const [analysisTarget, setAnalysisTarget] = useState<ComplianceDocument | null>(null);
    const [editTarget, setEditTarget] = useState<boolean>(false);
    const [pendingConfirm, setPendingConfirm] = useState<null | { kind: 'deactivate' | 'delete'; busy: boolean }>(null);
    const [reliability, setReliability] = useState<null | { totalAssignments: number; confirmed: number; declined: number; pending: number; confirmationRate: number | null }>(null);

    const fetchAll = async () => {
        if (!isLoaded || !isSignedIn || !workerId) return;
        try {
            const [workerRes, docsRes, scorecardRes] = await Promise.all([
                apiFetch(`/api/workers/${workerId}`),
                apiFetch(`/api/documents/worker/${workerId}`),
                apiFetch(`/api/worker-scorecards/${workerId}`),
            ]);
            if (!workerRes.ok) throw new Error(workerRes.status === 404 ? "Worker not found" : "Failed to load");
            const { data: w } = await workerRes.json();
            setWorker(w);
            if (docsRes.ok) {
                const { data: slots } = await docsRes.json();
                setDocSlots(slots);
            }
            if (scorecardRes.ok) {
                const { data: sc } = await scorecardRes.json();
                setReliability(sc);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeactivate = () => {
        if (!worker) return;
        setPendingConfirm({ kind: 'deactivate', busy: false });
    };

    const performDeactivate = async () => {
        if (!worker) return;
        setPendingConfirm((p) => p && { ...p, busy: true });
        try {
            const res = await apiFetch(`/api/workers/${workerId}/deactivate`, {
                method: "PATCH",
            });
            if (!res.ok) throw new Error("Failed to deactivate worker");
            toast.success("Worker deactivated");
            setPendingConfirm(null);
            fetchAll();
        } catch (err: any) {
            toast.error(err.message);
            setPendingConfirm(null);
        }
    };

    const handleReactivate = async () => {
        if (!worker) return;

        try {
            const res = await apiFetch(`/api/workers/${workerId}/reactivate`, {
                method: "PATCH",
            });
            if (!res.ok) throw new Error("Failed to reactivate worker");
            toast.success("Worker restored to active status");
            fetchAll();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDeleteWorker = () => {
        if (!worker) return;
        setPendingConfirm({ kind: 'delete', busy: false });
    };

    const performDeleteWorker = async () => {
        if (!worker) return;
        setPendingConfirm((p) => p && { ...p, busy: true });
        try {
            const res = await apiFetch(`/api/workers/${workerId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete worker");
            toast.success("Worker deleted permanently");
            router.push("/dashboard/workers");
        } catch (err: any) {
            toast.error(err.message);
            setPendingConfirm(null);
        }
    };

    useEffect(() => { fetchAll(); }, [workerId, isLoaded, isSignedIn]);

    if (!isLoaded || isLoading) {
        return <div className="flex h-[50vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
    }
    if (error) {
        return (
            <div className="text-center py-20">
                <p className="text-red-700 mb-4">{error}</p>
                <Link href="/dashboard/workers" className="text-blue-700 hover:text-blue-800">← Back to Workers</Link>
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
            <ConfirmDialog
                open={!!pendingConfirm}
                busy={!!pendingConfirm?.busy}
                title={pendingConfirm?.kind === 'delete' ? 'Delete worker permanently?' : 'Deactivate worker?'}
                message={
                    pendingConfirm?.kind === 'delete'
                        ? `This will permanently delete ${worker.firstName} ${worker.lastName} and all their documents. This cannot be undone.`
                        : `Are you sure you want to deactivate ${worker.firstName} ${worker.lastName}? They will no longer appear in active searches.`
                }
                confirmLabel={pendingConfirm?.kind === 'delete' ? 'Delete permanently' : 'Deactivate'}
                variant="destructive"
                onConfirm={() => (pendingConfirm?.kind === 'delete' ? performDeleteWorker() : performDeactivate())}
                onCancel={() => setPendingConfirm(null)}
            />


            {/* Back */}
            <Link href="/dashboard/workers" className="inline-flex items-center gap-2 text-[#5B6E8C] hover:text-[#0A1628] text-sm transition-colors">
                <ArrowLeft size={16} /> Back to Workers
            </Link>

            {/* Worker header card */}
            <div className="bg-white border border-[#DDE3EE] rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-start gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                        {worker.firstName[0]}{worker.lastName[0]}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-[#0A1628]">{worker.firstName} {worker.lastName}</h1>
                                {worker.status === 'INACTIVE' && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EBEEF5] text-[#5B6E8C] border border-[#DDE3EE]">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            <p className="text-[#5B6E8C] mt-0.5">{worker.jobTitle || "No role assigned"}</p>
                            <button
                                onClick={() => setEditTarget(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Edit size={16} /> Edit
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-[#5B6E8C]">
                            <span className="flex items-center gap-2"><Mail size={14} className="text-[#5B6E8C]" />{worker.email}</span>
                            {worker.phone && <span className="flex items-center gap-2"><Phone size={14} className="text-[#5B6E8C]" />{worker.phone}</span>}
                            {worker.startDate && <span className="flex items-center gap-2"><Calendar size={14} className="text-[#5B6E8C]" />Started {format(new Date(worker.startDate), "MMM dd, yyyy")}</span>}
                            <span className="flex items-center gap-2"><Briefcase size={14} className="text-[#5B6E8C]" />ID: {worker.id.slice(-8).toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                {/* Additional Risk Actions */}
                <div className="mt-6 pt-5 border-t border-[#DDE3EE] flex gap-4">
                    {worker.status !== 'INACTIVE' ? (
                        <button
                            onClick={handleDeactivate}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
                        >
                            <UserX size={16} /> Deactivate Worker
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleReactivate}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-colors"
                            >
                                <UserCheck size={16} /> Reactivate Worker
                            </button>
                            <button
                                onClick={handleDeleteWorker}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                            >
                                <Trash2 size={16} /> Delete Worker (Permanent)
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Reliability */}
            {reliability && (
                <div className="bg-white border border-[#DDE3EE] rounded-2xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-[#0A1628] flex items-center gap-2">
                                <TrendingUp size={18} className="text-blue-700" /> Reliability
                            </h2>
                            <p className="text-xs text-[#5B6E8C] mt-0.5">Based on shift-assignment responses</p>
                        </div>
                        <div className="text-right">
                            {reliability.confirmationRate === null ? (
                                <span className="text-sm text-[#5B6E8C]">No history yet</span>
                            ) : (
                                <span className={`text-2xl font-medium ${reliabilityRateStyle(reliability.confirmationRate).textClass}`}>
                                    {reliability.confirmationRate}%
                                </span>
                            )}
                            <p className="text-xs text-[#5B6E8C]">confirmation rate</p>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-[#0A1628]">{reliability.totalAssignments} assigned</span>
                        <span className="text-[#166534]">{reliability.confirmed} confirmed</span>
                        <span className="text-[#991B1B]">{reliability.declined} declined</span>
                        <span className="text-[#5B6E8C]">{reliability.pending} pending</span>
                    </div>
                </div>
            )}

            {/* Compliance Documents */}
            <div className="bg-white border border-[#DDE3EE] rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EE] bg-[#F5F7FA]">
                    <div>
                        <h2 className="text-lg font-semibold text-[#0A1628] flex items-center gap-2">
                            <FileText size={18} className="text-blue-700" /> Compliance Documents
                        </h2>
                        <p className="text-xs text-[#5B6E8C] mt-0.5">{docSlots.filter(s => s.document).length} of {docSlots.length} documents uploaded</p>
                    </div>
                </div>

                <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {docSlots.length === 0 ? (
                        <div className="col-span-4 text-center py-8 text-[#5B6E8C] text-sm">
                            Document types loading... If this persists, navigate away and return.
                        </div>
                    ) : docSlots.map((slot: DocSlot) => {
                        const { documentType: dt, document: doc, computedStatus } = slot;
                        const cfg = statusConfig[computedStatus] || statusConfig.NOT_UPLOADED;
                        const Icon = cfg.icon;

                        return (
                            <div key={dt.id} className="bg-white border border-[#DDE3EE] rounded-xl p-4 flex flex-col gap-3 hover:border-[#DDE3EE] transition-colors">
                                {/* Doc type name + status */}
                                <div>
                                    <p className="text-sm font-semibold text-[#0A1628]">{dt.name}</p>
                                    <p className="text-xs text-[#5B6E8C] mt-0.5">{dt.description}</p>
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

                                    let expColor = "text-[#5B6E8C]";
                                    let expText = `Expires in ${daysRemaining} days`;

                                    if (daysRemaining < 0) {
                                        expColor = "text-red-900 font-bold bg-red-100 px-1 rounded"; // Dark red
                                        expText = `Expired ${Math.abs(daysRemaining)} days ago`;
                                    } else if (daysRemaining <= 13) {
                                        expColor = "text-red-700 font-bold";
                                        expText = `Expires in ${daysRemaining} days`;
                                    } else if (daysRemaining <= 30) {
                                        expColor = "text-orange-600 font-semibold";
                                        expText = `Expires in ${daysRemaining} days`;
                                    } else {
                                        expColor = "text-green-700 font-medium";
                                        expText = `Expires in ${daysRemaining} days`;
                                    }

                                    return (
                                        <p className="text-xs text-[#5B6E8C]">
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
                                            className="flex-none flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#DDE3EE] text-[#5B6E8C] hover:text-[#0A1628] hover:border-[#DDE3EE] transition-all"
                                            aria-label="Download document"
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
                                                aria-label="Replace document"
                                                className="flex-none flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#EBEEF5] hover:bg-[#DDE3EE] text-[#0A1628] transition-all"
                                                title="Replace Document">
                                                <Upload size={12} />
                                            </button>
                                        </>
                                    )}
                                    {!doc && (
                                        <button onClick={() => setUploadTarget(dt)}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 hover:text-blue-800 transition-all">
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
                <div className="bg-white border border-[#DDE3EE] rounded-2xl p-6">
                    <h2 className="font-semibold text-[#0A1628] mb-2">Notes</h2>
                    <p className="text-[#5B6E8C] text-sm whitespace-pre-wrap">{worker.notes}</p>
                </div>
            )}
        </div>
    );
}
