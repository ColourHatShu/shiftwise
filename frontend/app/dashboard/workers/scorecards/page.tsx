"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface Scorecard {
    workerId: string;
    firstName: string;
    lastName: string;
    totalAssignments: number;
    confirmed: number;
    declined: number;
    pending: number;
    confirmationRate: number | null;
}

function rateStyle(rate: number | null): { label: string; cls: string } {
    if (rate === null) return { label: "—", cls: "bg-[#EBEEF5] text-[#5B6E8C]" };
    if (rate >= 80) return { label: `${rate}%`, cls: "bg-[#DCFCE7] text-[#166534]" };
    if (rate >= 50) return { label: `${rate}%`, cls: "bg-[#FEF3C7] text-[#92400E]" };
    return { label: `${rate}%`, cls: "bg-[#FEE2E2] text-[#991B1B]" };
}

export default function WorkerScorecardsPage() {
    const { apiFetch } = useApi();
    const [scorecards, setScorecards] = useState<Scorecard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchScorecards = async () => {
            try {
                const res = await apiFetch(`/api/worker-scorecards`);
                if (!res.ok) throw new Error("Failed to load scorecards");
                const { data } = await res.json();
                setScorecards(data || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load scorecards");
            } finally {
                setLoading(false);
            }
        };
        fetchScorecards();
    }, [apiFetch]);

    const rows = useMemo(
        () =>
            scorecards.map((s) => {
                const r = rateStyle(s.confirmationRate);
                return (
                    <tr key={s.workerId} className="border-t border-[#DDE3EE]">
                        <td className="px-4 py-3">
                            <Link href={`/dashboard/workers/${s.workerId}`} className="font-medium text-[#0A1628] hover:text-[#003087] transition-colors">
                                {s.firstName} {s.lastName}
                            </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-[#0A1628]">{s.totalAssignments}</td>
                        <td className="px-4 py-3 text-center text-[#166534]">{s.confirmed}</td>
                        <td className="px-4 py-3 text-center text-[#991B1B]">{s.declined}</td>
                        <td className="px-4 py-3 text-center text-[#5B6E8C]">{s.pending}</td>
                        <td className="px-4 py-3 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.cls}`}>{r.label}</span>
                        </td>
                    </tr>
                );
            }),
        [scorecards]
    );

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <Link href="/dashboard/workers" className="inline-flex items-center gap-1.5 text-sm text-[#5B6E8C] hover:text-[#003087] transition-colors">
                    <ArrowLeft size={15} /> Back to workers
                </Link>
                <h1 className="mt-2 text-2xl font-medium text-[#0A1628]">Worker reliability</h1>
                <p className="mt-1 text-[#5B6E8C]">
                    How reliably each worker responds to shift assignments. Confirmation rate = confirmed ÷ responded (confirmed + declined).
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-[#DC2626]/20 bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">{error}</div>
            )}

            <div className="overflow-hidden rounded-xl border border-[#DDE3EE] bg-white">
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                    </div>
                ) : scorecards.length === 0 ? (
                    <EmptyState
                        icon={TrendingUp}
                        title="No reliability data yet"
                        message="Once workers are assigned to shifts and confirm or decline, their scorecards appear here."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#F5F7FA] text-left text-xs font-medium uppercase tracking-wide text-[#5B6E8C]">
                                    <th className="px-4 py-3">Worker</th>
                                    <th className="px-4 py-3 text-center">Assigned</th>
                                    <th className="px-4 py-3 text-center">Confirmed</th>
                                    <th className="px-4 py-3 text-center">Declined</th>
                                    <th className="px-4 py-3 text-center">Pending</th>
                                    <th className="px-4 py-3 text-center">Confirmation rate</th>
                                </tr>
                            </thead>
                            <tbody>{rows}</tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
