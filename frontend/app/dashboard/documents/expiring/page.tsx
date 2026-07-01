"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Clock } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface ExpiringDoc {
    documentId: string;
    workerId: string;
    workerName: string;
    documentType: string;
    expiryDate: string;
    daysUntilExpiry: number;
    overdue: boolean;
    status: string;
}

interface Summary {
    total: number;
    overdue: number;
    windowDays: number;
}

const WINDOWS = [7, 30, 60, 90];

function daysLabel(d: ExpiringDoc): { text: string; cls: string } {
    if (d.daysUntilExpiry < 0) return { text: `Expired ${Math.abs(d.daysUntilExpiry)}d ago`, cls: "text-[#991B1B] font-semibold" };
    if (d.daysUntilExpiry === 0) return { text: "Expires today", cls: "text-[#991B1B] font-semibold" };
    if (d.daysUntilExpiry <= 7) return { text: `${d.daysUntilExpiry}d left`, cls: "text-[#92400E] font-medium" };
    return { text: `${d.daysUntilExpiry}d left`, cls: "text-[#5B6E8C]" };
}

export default function ExpiringDocumentsPage() {
    const { apiFetch } = useApi();
    const [docs, setDocs] = useState<ExpiringDoc[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchDocs = useCallback(async (windowDays: number) => {
        setLoading(true);
        setError("");
        try {
            const res = await apiFetch(`/api/expiring-documents?days=${windowDays}`);
            if (!res.ok) throw new Error("Failed to load expiring documents");
            const json = await res.json();
            setDocs(json.data || []);
            setSummary(json.summary || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load expiring documents");
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchDocs(days);
    }, [days, fetchDocs]);

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <Link href="/dashboard/documents" className="inline-flex items-center gap-1.5 text-sm text-[#5B6E8C] hover:text-[#003087] transition-colors">
                    <ArrowLeft size={15} /> Back to documents
                </Link>
                <h1 className="mt-2 text-2xl font-medium text-[#0A1628]">Expiring &amp; overdue documents</h1>
                <p className="mt-1 text-[#5B6E8C]">
                    Compliance documents that need renewing — most urgent first.
                    {summary && (
                        <>
                            {" "}
                            <span className="font-medium text-[#991B1B]">{summary.overdue}</span> overdue, {summary.total} within {summary.windowDays} days.
                        </>
                    )}
                </p>
            </div>

            {/* Window selector */}
            <div className="flex items-center gap-2 text-sm">
                <span className="text-[#5B6E8C]">Window:</span>
                {WINDOWS.map((w) => (
                    <button
                        key={w}
                        onClick={() => setDays(w)}
                        aria-pressed={days === w}
                        aria-label={`Show documents expiring within ${w} days`}
                        className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                            days === w ? "bg-[#003087] text-white" : "border border-[#DDE3EE] text-[#003087] hover:bg-[#F5F7FA]"
                        }`}
                    >
                        {w}d
                    </button>
                ))}
            </div>

            {error && (
                <div className="rounded-lg border border-[#DC2626]/20 bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">{error}</div>
            )}

            <div className="overflow-hidden rounded-xl border border-[#DDE3EE] bg-white">
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                    </div>
                ) : docs.length === 0 ? (
                    <EmptyState
                        icon={Clock}
                        title="Nothing expiring in this window"
                        message={`No active workers have documents that are overdue or expiring within ${days} days. Widen the window to look further ahead.`}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#F5F7FA] text-left text-xs font-medium uppercase tracking-wide text-[#5B6E8C]">
                                    <th scope="col" className="px-4 py-3">Worker</th>
                                    <th scope="col" className="px-4 py-3">Document</th>
                                    <th scope="col" className="px-4 py-3">Expiry</th>
                                    <th scope="col" className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map((d) => {
                                    const dl = daysLabel(d);
                                    return (
                                        <tr key={d.documentId} className={`border-t border-[#DDE3EE] ${d.overdue ? "bg-[#FEE2E2]/30" : ""}`}>
                                            <td className="px-4 py-3">
                                                <Link href={`/dashboard/workers/${d.workerId}`} className="font-medium text-[#0A1628] hover:text-[#003087] transition-colors">
                                                    {d.workerName}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-[#0A1628]">{d.documentType}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-[#0A1628]">{format(new Date(d.expiryDate), "d MMM yyyy")}</span>
                                                <span className={`ml-2 ${dl.cls}`}>· {dl.text}</span>
                                            </td>
                                            <td className="px-4 py-3 text-[#5B6E8C]">{d.status}</td>
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
}
