"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload, XCircle, Search } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// RAG Status Config
const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
    NOT_UPLOADED: { 
        label: "Not Uploaded", 
        bgColor: "bg-[#F3F4F6]",
        textColor: "text-[#6B7280]"
    },
    PENDING: { 
        label: "Pending Review", 
        bgColor: "bg-[#FAEEDA]",
        textColor: "text-[#854F0B]"
    },
    APPROVED: { 
        label: "Verified", 
        bgColor: "bg-[#EAF3DE]",
        textColor: "text-[#3B6D11]"
    },
    EXPIRING_SOON: { 
        label: "Expiring Soon", 
        bgColor: "bg-[#FAEEDA]",
        textColor: "text-[#854F0B]"
    },
    EXPIRED: { 
        label: "Expired", 
        bgColor: "bg-[#FCEBEB]",
        textColor: "text-[#A32D2D]"
    },
    REJECTED: { 
        label: "Non-Compliant", 
        bgColor: "bg-[#FCEBEB]",
        textColor: "text-[#A32D2D]"
    },
};

export default function DocumentsPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [workers, setWorkers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetch_ = async () => {
            if (!isLoaded || !isSignedIn) return;
            try {
                const token = await getToken();
                const res = await fetch(`${API_URL}/api/documents/agency`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
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
    }, [isLoaded, isSignedIn, getToken]);

    if (!isLoaded || isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F2647]" />
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
                return { dot: "bg-[#1D9E75]", bar: "bg-[#1D9E75]", text: "text-[#3B6D11]" };
            case "amber":
                return { dot: "bg-[#EF9F27]", bar: "bg-[#EF9F27]", text: "text-[#854F0B]" };
            case "red":
                return { dot: "bg-[#E24B4A]", bar: "bg-[#E24B4A]", text: "text-[#A32D2D]" };
            default:
                return { dot: "bg-[#6B7280]", bar: "bg-[#6B7280]", text: "text-[#6B7280]" };
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-medium text-[#1A1A2E]">Documents</h1>
                <p className="text-[#6B7280] mt-1">Compliance documents across all workers</p>
            </div>

            {/* Summary Stats */}
            <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-[0.5px] font-medium">Total Documents</p>
                    <p className="text-2xl font-medium text-[#1A1A2E] mt-1">
                        {workers.reduce((acc, w) => acc + (w.complianceDocuments?.length || 0), 0)}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-[0.5px] font-medium">Verified</p>
                    <p className="text-2xl font-medium text-[#3B6D11] mt-1">
                        {workers.reduce((acc, w) => acc + (w.complianceDocuments?.filter((d: any) => d.status === "APPROVED").length || 0), 0)}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-[0.5px] font-medium">Needs Attention</p>
                    <p className="text-2xl font-medium text-[#A32D2D] mt-1">
                        {workers.reduce((acc, w) => acc + (w.complianceDocuments?.filter((d: any) => d.status === "EXPIRED" || d.status === "REJECTED").length || 0), 0)}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-[#FCEBEB] border border-[#E24B4A]/20 text-[#A32D2D] px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            {workers.length === 0 ? (
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-12 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-[#F8F9FB] mb-4">
                        <FileText size={24} className="text-[#6B7280]" />
                    </div>
                    <p className="text-[#6B7280]">No workers added yet.</p>
                    <Link href="/dashboard/workers/new" className="text-[#0F2647] hover:text-[#0F2647]/80 font-medium text-sm mt-2 inline-block transition-colors">
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
                            <div key={worker.id} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                                {/* Worker header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#F8F9FB]">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-[#EEF2FF] text-[#0F2647] flex items-center justify-center font-medium text-sm">
                                            {worker.firstName[0]}{worker.lastName[0]}
                                        </div>
                                        <div>
                                            <p className="font-medium text-[#1A1A2E]">{worker.firstName} {worker.lastName}</p>
                                            <p className="text-xs text-[#6B7280]">{worker.jobTitle || "Unassigned"}</p>
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
                                                <div className="w-20 bg-[#F8F9FB] rounded-full h-1.5">
                                                    <div 
                                                        className={`h-1.5 rounded-full ${ragStyles.bar}`}
                                                        style={{ width: `${score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <Link href={`/dashboard/workers/${worker.id}`}
                                            className="text-xs text-[#0F2647] hover:text-[#0F2647]/80 font-medium px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#EEF2FF]/80 transition-all">
                                            View →
                                        </Link>
                                    </div>
                                </div>

                                {/* Documents Table */}
                                <div className="p-4">
                                    {docs.length === 0 ? (
                                        <p className="text-[#6B7280] text-sm text-center py-4">No documents uploaded. <Link href={`/dashboard/workers/${worker.id}`} className="text-[#0F2647] hover:underline font-medium">Upload on their profile →</Link></p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-[#E5E7EB]">
                                                        <th className="pb-3 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px]">Document</th>
                                                        <th className="pb-3 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px]">Status</th>
                                                        <th className="pb-3 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px]">Expiry</th>
                                                        <th className="pb-3 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px] text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#E5E7EB]">
                                                    {docs.map((doc: any) => {
                                                        const status = getComputedStatus(doc);
                                                        const cfg = statusConfig[status] || statusConfig.NOT_UPLOADED;
                                                        return (
                                                            <tr key={doc.id} className="group hover:bg-[#F8F9FB] transition-colors">
                                                                <td className="py-3">
                                                                    <p className="text-sm font-medium text-[#1A1A2E]">{doc.documentType?.name}</p>
                                                                </td>
                                                                <td className="py-3">
                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bgColor} ${cfg.textColor}`}>
                                                                        {cfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3">
                                                                    <p className="text-sm text-[#6B7280]">
                                                                        {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('en-GB') : 'No expiry'}
                                                                    </p>
                                                                </td>
                                                                <td className="py-3 text-right">
                                                                    {doc.fileUrl && (
                                                                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                                                            className="text-sm text-[#0F2647] hover:text-[#0F2647]/80 font-medium inline-flex items-center gap-1 transition-colors">
                                                                            <FileText size={14} /> View
                                                                        </a>
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
