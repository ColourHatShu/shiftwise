"use client";

import { useState } from "react";
import { X, Check, XCircle, Eye, EyeOff } from "lucide-react";

interface Document {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    documentType: {
        name: string;
    };
    expiryDate?: string;
    issueDate?: string;
    rejectionReason?: string;
}

interface WorkerProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    jobTitle?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    complianceScore: number;
    complianceStatus: 'red' | 'yellow' | 'green';
    completedDocs: number;
    totalRequiredDocs: number;
    documents?: Document[];
}

interface WorkerDetailModalProps {
    isOpen: boolean;
    worker: WorkerProfile | null;
    onClose: () => void;
    onApprove: (documentId: string) => Promise<void>;
    onReject: (documentId: string, reason: string) => Promise<void>;
    onDeactivate: () => Promise<void>;
}

export default function WorkerDetailModal({
    isOpen,
    worker,
    onClose,
    onApprove,
    onReject,
    onDeactivate
}: WorkerDetailModalProps) {
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

    if (!isOpen || !worker) return null;

    const handleApprove = async (docId: string) => {
        setActionLoading(`approve-${docId}`);
        try {
            await onApprove(docId);
            setSelectedDocId(null);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (docId: string) => {
        if (!rejectionReason.trim()) {
            alert("Please provide a rejection reason");
            return;
        }
        setActionLoading(`reject-${docId}`);
        try {
            await onReject(docId, rejectionReason);
            setSelectedDocId(null);
            setRejectionReason("");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeactivate = async () => {
        setActionLoading("deactivate");
        try {
            await onDeactivate();
            onClose();
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBg = (status: 'red' | 'yellow' | 'green') => {
        const colors = {
            green: 'bg-[#DCFCE7]',
            yellow: 'bg-[#FEF3C7]',
            red: 'bg-[#FEE2E2]'
        };
        return colors[status];
    };

    const getStatusText = (status: 'red' | 'yellow' | 'green') => {
        const colors = {
            green: 'text-[#166534]',
            yellow: 'text-[#92400E]',
            red: 'text-[#991B1B]'
        };
        return colors[status];
    };

    const getDocStatusBadge = (status: string) => {
        const styles = {
            APPROVED: 'bg-[#DCFCE7] text-[#166534]',
            REJECTED: 'bg-[#FEE2E2] text-[#991B1B]',
            PENDING: 'bg-[#FEF3C7] text-[#92400E]',
            EXPIRED: 'bg-[#FEE2E2] text-[#991B1B]'
        };
        return styles[status as keyof typeof styles] || styles.PENDING;
    };

    const pendingDocs = (worker.documents || []).filter(d => d.status === 'PENDING');

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b border-[#DDE3EE] p-6 flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-medium text-[#0A1628]">
                                {worker.firstName} {worker.lastName}
                            </h2>
                            <p className="text-sm text-[#5B6E8C] mt-1">{worker.email}</p>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close dialog"
                            className="text-[#5B6E8C] hover:text-[#0A1628] transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Worker Profile Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-[#0A1628] uppercase tracking-wider">Profile</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-[#5B6E8C] uppercase tracking-wider">Job Title</p>
                                    <p className="text-sm font-medium text-[#0A1628] mt-1">{worker.jobTitle || 'Not specified'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-[#5B6E8C] uppercase tracking-wider">Status</p>
                                    <p className="text-sm font-medium text-[#0A1628] mt-1">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                            worker.status === 'ACTIVE'
                                                ? 'bg-[#DCFCE7] text-[#166534]'
                                                : 'bg-[#FEE2E2] text-[#991B1B]'
                                        }`}>
                                            {worker.status}
                                        </span>
                                    </p>
                                </div>
                                {worker.phone && (
                                    <div>
                                        <p className="text-xs text-[#5B6E8C] uppercase tracking-wider">Phone</p>
                                        <p className="text-sm font-medium text-[#0A1628] mt-1">{worker.phone}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Compliance Score */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-[#0A1628] uppercase tracking-wider">Compliance</h3>
                            <div className={`p-4 rounded-lg ${getStatusBg(worker.complianceStatus)}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className={`text-2xl font-bold ${getStatusText(worker.complianceStatus)}`}>
                                            {worker.complianceScore}%
                                        </p>
                                        <p className={`text-xs font-medium ${getStatusText(worker.complianceStatus)} mt-1`}>
                                            {worker.completedDocs}/{worker.totalRequiredDocs} documents
                                        </p>
                                    </div>
                                    <div className={`text-3xl ${getStatusText(worker.complianceStatus)}`}>
                                        {worker.complianceStatus === 'green' && '✓'}
                                        {worker.complianceStatus === 'yellow' && '⚠'}
                                        {worker.complianceStatus === 'red' && '✕'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pending Documents */}
                        {pendingDocs.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-[#0A1628] uppercase tracking-wider">
                                    Pending Documents ({pendingDocs.length})
                                </h3>
                                <div className="space-y-3">
                                    {pendingDocs.map((doc) => (
                                        <div key={doc.id} className="border border-[#DDE3EE] rounded-lg p-4 space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-[#0A1628]">{doc.documentType.name}</p>
                                                    <p className="text-xs text-[#5B6E8C] mt-1">
                                                        Uploaded • Status: <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDocStatusBadge(doc.status)}`}>
                                                            {doc.status}
                                                        </span>
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedDocId(selectedDocId === doc.id ? null : doc.id)}
                                                    aria-label="Toggle document review actions"
                                                    className="text-[#003087] hover:text-[#003087]/80 transition-colors"
                                                >
                                                    {selectedDocId === doc.id ? (
                                                        <EyeOff className="w-4 h-4" />
                                                    ) : (
                                                        <Eye className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* Action Buttons */}
                                            {selectedDocId === doc.id && (
                                                <div className="pt-3 border-t border-[#DDE3EE] space-y-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApprove(doc.id)}
                                                            disabled={actionLoading === `approve-${doc.id}`}
                                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#16A34A] text-white rounded-lg hover:bg-[#16A34A]/90 transition-colors text-sm font-medium disabled:opacity-50"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                            {actionLoading === `approve-${doc.id}` ? 'Approving...' : 'Approve'}
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedDocId(`reject-${doc.id}`)}
                                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-[#DDE3EE] text-[#0A1628] rounded-lg hover:bg-[#F5F7FA] transition-colors text-sm font-medium"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                            Reject
                                                        </button>
                                                    </div>

                                                    {/* Rejection Reason Input */}
                                                    {selectedDocId === `reject-${doc.id}` && (
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-[#0A1628]">
                                                                Rejection Reason
                                                            </label>
                                                            <textarea
                                                                value={rejectionReason}
                                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                                placeholder="E.g., Document quality too poor, information unclear..."
                                                                className="w-full px-3 py-2 border border-[#DDE3EE] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/30"
                                                                rows={3}
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleReject(doc.id)}
                                                                    disabled={actionLoading === `reject-${doc.id}`}
                                                                    className="flex-1 px-4 py-2 bg-[#DC2626] text-white rounded-lg hover:bg-[#DC2626]/90 transition-colors text-sm font-medium disabled:opacity-50"
                                                                >
                                                                    {actionLoading === `reject-${doc.id}` ? 'Rejecting...' : 'Confirm Rejection'}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedDocId(`edit-${doc.id}`);
                                                                        setRejectionReason("");
                                                                    }}
                                                                    className="flex-1 px-4 py-2 border border-[#DDE3EE] text-[#0A1628] rounded-lg hover:bg-[#F5F7FA] transition-colors text-sm font-medium"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All Documents */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-[#0A1628] uppercase tracking-wider">
                                All Documents ({worker.documents?.length || 0})
                            </h3>
                            <div className="space-y-2">
                                {(worker.documents || []).map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 border border-[#DDE3EE] rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-[#0A1628]">{doc.documentType.name}</p>
                                            <p className="text-xs text-[#5B6E8C] mt-1">
                                                {doc.expiryDate ? `Expires: ${new Date(doc.expiryDate).toLocaleDateString()}` : 'No expiry'}
                                            </p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getDocStatusBadge(doc.status)}`}>
                                            {doc.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-white border-t border-[#DDE3EE] p-6 flex gap-3">
                        {!showDeactivateConfirm ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-[#DDE3EE] text-[#0A1628] rounded-lg hover:bg-[#F5F7FA] transition-colors text-sm font-medium"
                                >
                                    Close
                                </button>
                                {worker.status === 'ACTIVE' && (
                                    <button
                                        onClick={() => setShowDeactivateConfirm(true)}
                                        className="flex-1 px-4 py-2 bg-[#DC2626] text-white rounded-lg hover:bg-[#DC2626]/90 transition-colors text-sm font-medium"
                                    >
                                        Deactivate Worker
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setShowDeactivateConfirm(false)}
                                    className="flex-1 px-4 py-2 border border-[#DDE3EE] text-[#0A1628] rounded-lg hover:bg-[#F5F7FA] transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeactivate}
                                    disabled={actionLoading === "deactivate"}
                                    className="flex-1 px-4 py-2 bg-[#DC2626] text-white rounded-lg hover:bg-[#DC2626]/90 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {actionLoading === "deactivate" ? 'Deactivating...' : 'Confirm Deactivate'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
