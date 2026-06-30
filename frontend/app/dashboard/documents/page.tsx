"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload, XCircle, Search } from "lucide-react";
import { downloadDocument } from "@/lib/api/documents";
import { useApi } from "@/lib/use-api";
import toast from "react-hot-toast";

// RAG Status Config
const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
    NOT_UPLOADED: { 
        label: "Not Uploaded", 
        bgColor: "bg-[#EBEEF5]",
        textColor: "text-[#5B6E8C]"
    },
    PENDING: { 
        label: "Pending Review", 
        bgColor: "bg-[#FEF3C7]",
        textColor: "text-[#92400E]"
    },
    APPROVED: { 
        label: "Verified", 
        bgColor: "bg-[#DCFCE7]",
        textColor: "text-[#166534]"
    },
    EXPIRING_SOON: { 
        label: "Expiring Soon", 
        bgColor: "bg-[#FEF3C7]",
        textColor: "text-[#92400E]"
    },
    EXPIRED: { 
        label: "Expired", 
        bgColor: "bg-[#FEE2E2]",
        textColor: "text-[#991B1B]"
    },
    REJECTED: { 
        label: "Non-Compliant", 
        bgColor: "bg-[#FEE2E2]",
        textColor: "text-[#991B1B]"
    },
};

export default function DocumentsPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const { apiFetch } = useApi();
    const [workers, setWorkers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetch_ = async () => {
            if (!isLoaded || !isSignedIn) return;
            try {
                const res = await apiFetch(`/api/documents/agency`);
                if (!res.ok) throw new Error("Failed to fetch documents");
                const { data } = await res.json();
                setWorkers(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetch_();
    }, [isLoaded, isSignedIn, apiFetch]);

    if (!isLoaded || isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003087]" />
            </div>
        );
    }

    const getComputedStatus = (doc: any) => {
        if (!doc) return "NOT_UPLOADED";
        if (doc.status === "EXPIRED") return "EXPIRED";
        if (doc.expiryDate) {
            const exp = new Date(doc.expiryDate);
            const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            if (exp <= in30 && doc.status === "APPROVED") return "EXPIRING_SOON";
        }
        return doc.status;
    };

    const getComplianceScore = (docs: any[]) => {
        if (!docs.length) return null;
        const approved = docs.filter(d => d.status === "APPROVED").length;
        return Math.round((approved / docs.length) * 100);
    };

    const getRAGColor = (score: number | null) => {
        if (score === null) return "gray";
        if (score >= 90) return "green";
        if (score >= 70) return "amber";
        return "red";
    };

    const getRAGStyles = (color: string) => {
        switch (color) {
            case "green":
                return { dot: "bg-[#16A34A]", bar: "bg-[#16A34A]", text: "text-[#166534]" };
            case "amber":
                return { dot: "bg-[#D97706]", bar: "bg-[#D97706]", text: "text-[#92400E]" };
            case "red":
                return { dot: "bg-[#DC2626]", bar: "bg-[#DC2626]", text: "text-[#991B1B]" };
            default:
                return { dot: "bg-[#5B6E8C]", bar: "bg-[#5B6E8C]", text: "text-[#5B6E8C]" };
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-medium text-[#0A1628]">Documents</h1>
                <p className="text-[#5B6E8C] mt-1">Compliance documents across all workers</p>
            </div>

            {/* Summary Stats */}
            <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium">Total Documents</p>
                    <p className="text-2xl font-medium text-[#0A1628] mt-1">
                        {workers.reduce((acc, w) => acc + (w.complianceDocuments?.length || 0), 0)}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium">Verified</p>
                    <p className="text-2xl font-medium text-[#166534] mt-1">
                        {workers.reduce((acc, w) => acc + (w.complianceDocuments?.filter((d: any) => d.status === "APPROVED").length || 0), 0)}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium">Needs Attention</p>
                    <p className="text-2xl font-medium text-[#991B1B] mt-1">
                        {workers.reduce((acc, w) => acc + (w.complianceDocuments?.filter((d: any) => d.status === "EXPIRED" || d.status === "REJECTED").length || 0), 0)}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-[#FEE2E2] border border-[#DC2626]/20 text-[#991B1B] px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            {workers.length === 0 ? (
                <div className="bg-white border border-[#DDE3EE] rounded-xl p-12 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-[#F5F7FA] mb-4">
                        <FileText size={24} className="text-[#5B6E8C]" />
                    </div>
                    <p className="text-[#5B6E8C]">No workers added yet.</p>
                    <Link href="/dashboard/workers/new" className="text-[#003087] hover:text-[#003087]/80 font-medium text-sm mt-2 inline-block transition-colors">
                        Add your first worker →
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {workers.map((worker: any) => {
                        const docs = worker.complianceDocuments || [];
                        const score = getComplianceScore(docs);
                        const ragColor = getRAGColor(score);
                        const ragStyles = getRAGStyles(ragColor);
                        return (
                            <div key={worker.id} className="bg-white border border-[#DDE3EE] rounded-xl overflow-hidden">
                                {/* Worker header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EE] bg-[#F5F7FA]">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-[#E6EDF8] text-[#003087] flex items-center justify-center font-medium text-sm">
                                            {worker.firstName[0]}{worker.lastName[0]}
                                        </div>
                                        <div>
                                            <p className="font-medium text-[#0A1628]">{worker.firstName} {worker.lastName}</p>
                                            <p className="text-xs text-[#5B6E8C]">{worker.jobTitle || "Unassigned"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {score !== null && (
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <div className={`w-2 h-2 rounded-full ${ragStyles.dot}`} />
                                                    <span className={`font-medium ${ragStyles.text}`}>
                                                        {score}%
                                                    </span>
                                                </div>
                                                <div className="w-20 bg-[#F5F7FA] rounded-full h-1.5">
                                                    <div 
                                                        className={`h-1.5 rounded-full ${ragStyles.bar}`}
                                                        style={{ width: `${score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <Link href={`/dashboard/workers/${worker.id}`}
                                            className="text-xs text-[#003087] hover:text-[#003087]/80 font-medium px-3 py-1.5 rounded-lg bg-[#E6EDF8] hover:bg-[#E6EDF8]/80 transition-all">
                                            View →
                                        </Link>
                                    </div>
                                </div>

                                {/* Documents Table */}
                                <div className="p-4">
                                    {docs.length === 0 ? (
                                        <p className="text-[#5B6E8C] text-sm text-center py-4">No documents uploaded. <Link href={`/dashboard/workers/${worker.id}`} className="text-[#003087] hover:underline font-medium">Upload on their profile →</Link></p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-[#DDE3EE]">
                                                        <th className="pb-3 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px]">Document</th>
                                                        <th className="pb-3 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px]">Status</th>
                                                        <th className="pb-3 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px]">Expiry</th>
                                                        <th className="pb-3 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px] text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#DDE3EE]">
                                                    {docs.map((doc: any) => {
                                                        const status = getComputedStatus(doc);
                                                        const cfg = statusConfig[status] || statusConfig.NOT_UPLOADED;
                                                        return (
                                                            <tr key={doc.id} className="group hover:bg-[#F5F7FA] transition-colors">
                                                                <td className="py-3">
                                                                    <p className="text-sm font-medium text-[#0A1628]">{doc.documentType?.name}</p>
                                                                </td>
                                                                <td className="py-3">
                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bgColor} ${cfg.textColor}`}>
                                                                        {cfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3">
                                                                    <p className="text-sm text-[#5B6E8C]">
                                                                        {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('en-GB') : 'No expiry'}
                                                                    </p>
                                                                </td>
                                                                <td className="py-3 text-right">
                                                                    {doc.id && (
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
                                                                            className="text-sm text-[#003087] hover:text-[#003087]/80 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer">
                                                                            <FileText size={14} /> Download
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
