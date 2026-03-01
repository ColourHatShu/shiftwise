"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload, XCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const statusConfig: Record<string, { label: string; classes: string; icon: any }> = {
    NOT_UPLOADED: { label: "Not Uploaded", classes: "bg-slate-700/50 text-slate-400 border-slate-600/50", icon: XCircle },
    PENDING: { label: "Pending Review", classes: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
    APPROVED: { label: "Verified", classes: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
    EXPIRING_SOON: { label: "Expiring Soon", classes: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: AlertCircle },
    EXPIRED: { label: "Expired", classes: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertCircle },
    REJECTED: { label: "Non-Compliant", classes: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                <h1 className="text-2xl font-bold text-white">Documents</h1>
                <p className="text-slate-400 mt-1">Compliance documents across all workers</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            {workers.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-12 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 mb-4">
                        <FileText size={24} className="text-slate-500" />
                    </div>
                    <p className="text-slate-400">No workers added yet.</p>
                    <Link href="/dashboard/workers/new" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block transition-colors">
                        Add your first worker →
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {workers.map((worker: any) => {
                        const docs = worker.complianceDocuments || [];
                        const score = getComplianceScore(docs);
                        return (
                            <div key={worker.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm">
                                {/* Worker header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900/30">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center text-sm font-bold">
                                            {worker.firstName[0]}{worker.lastName[0]}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{worker.firstName} {worker.lastName}</p>
                                            <p className="text-xs text-slate-500">{worker.jobTitle || "Unassigned"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {score !== null && (
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${score === 100 ? "bg-green-500/10 text-green-400 border-green-500/20" : score >= 50 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                                {score}% Compliant
                                            </span>
                                        )}
                                        <Link href={`/dashboard/workers/${worker.id}`}
                                            className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-all">
                                            View Profile →
                                        </Link>
                                    </div>
                                </div>

                                {/* Documents grid */}
                                <div className="p-4">
                                    {docs.length === 0 ? (
                                        <p className="text-slate-500 text-sm text-center py-4">No documents uploaded. <Link href={`/dashboard/workers/${worker.id}`} className="text-blue-400 hover:underline">Upload on their profile →</Link></p>
                                    ) : (
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            {docs.map((doc: any) => {
                                                const status = getComputedStatus(doc);
                                                const cfg = statusConfig[status] || statusConfig.NOT_UPLOADED;
                                                const Icon = cfg.icon;
                                                return (
                                                    <div key={doc.id} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <p className="text-xs font-medium text-white leading-tight">{doc.documentType?.name}</p>
                                                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.classes}`}>
                                                                <Icon size={10} />
                                                                {cfg.label}
                                                            </span>
                                                        </div>
                                                        {doc.expiryDate && (
                                                            <p className="text-xs text-slate-500">Expires: {new Date(doc.expiryDate).toLocaleDateString('en-GB')}</p>
                                                        )}
                                                        {doc.fileUrl && (
                                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                                                className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-flex items-center gap-1 transition-colors">
                                                                <FileText size={10} /> View file
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
