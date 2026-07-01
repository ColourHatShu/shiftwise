"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface Coverage {
    shiftId: string;
    facilityName: string;
    shiftDate: string;
    role: string;
    requiredCount: number;
    assignedCount: number;
    confirmedCount: number;
    shortfall: number;
    status: "filled" | "understaffed" | "unfilled";
}

interface Summary {
    totalUpcoming: number;
    needingAttention: number;
}

const STATUS_STYLE: Record<Coverage["status"], { label: string; cls: string }> = {
    filled: { label: "Filled", cls: "bg-[#DCFCE7] text-[#166534]" },
    understaffed: { label: "Understaffed", cls: "bg-[#FEF3C7] text-[#92400E]" },
    unfilled: { label: "Unfilled", cls: "bg-[#FEE2E2] text-[#991B1B]" },
};

export default function ShiftCoveragePage() {
    const { apiFetch } = useApi();
    const [coverage, setCoverage] = useState<Coverage[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [attentionOnly, setAttentionOnly] = useState(false);

    useEffect(() => {
        const fetchCoverage = async () => {
            try {
                const res = await apiFetch(`/api/shift-coverage`);
                if (!res.ok) throw new Error("Failed to load shift coverage");
                const json = await res.json();
                setCoverage(json.data || []);
                setSummary(json.summary || null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load shift coverage");
            } finally {
                setLoading(false);
            }
        };
        fetchCoverage();
    }, [apiFetch]);

    const visible = useMemo(
        () => (attentionOnly ? coverage.filter((c) => c.shortfall > 0) : coverage),
        [coverage, attentionOnly]
    );

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <Link href="/dashboard/shifts" className="inline-flex items-center gap-1.5 text-sm text-[#5B6E8C] hover:text-[#003087] transition-colors">
                    <ArrowLeft size={15} /> Back to shifts
                </Link>
                <h1 className="mt-2 text-2xl font-medium text-[#0A1628]">Shift coverage</h1>
                <p className="mt-1 text-[#5B6E8C]">
                    Upcoming shifts and how fully they're staffed (by <span className="font-medium text-[#0A1628]">confirmed</span> workers).
                    {summary && (
                        <>
                            {" "}
                            <span className="font-medium text-[#0A1628]">{summary.needingAttention}</span> of {summary.totalUpcoming} need attention.
                        </>
                    )}
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-[#DC2626]/20 bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">{error}</div>
            )}

            {!loading && coverage.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-[#0A1628]">
                    <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
                    Show only shifts needing attention
                </label>
            )}

            <div className="overflow-hidden rounded-xl border border-[#DDE3EE] bg-white">
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                    </div>
                ) : coverage.length === 0 ? (
                    <EmptyState
                        icon={CalendarClock}
                        title="No upcoming shifts"
                        message="Once you post shifts, their staffing coverage appears here."
                    />
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={CalendarClock}
                        title="All upcoming shifts are covered"
                        message="Every upcoming shift has enough confirmed workers. Nice."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#F5F7FA] text-left text-xs font-medium uppercase tracking-wide text-[#5B6E8C]">
                                    <th scope="col" className="px-4 py-3">Date</th>
                                    <th scope="col" className="px-4 py-3">Facility</th>
                                    <th scope="col" className="px-4 py-3">Role</th>
                                    <th scope="col" className="px-4 py-3 text-center">Confirmed / Required</th>
                                    <th scope="col" className="px-4 py-3 text-center">Short</th>
                                    <th scope="col" className="px-4 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((c) => {
                                    const s = STATUS_STYLE[c.status];
                                    return (
                                        <tr key={c.shiftId} className="border-t border-[#DDE3EE]">
                                            <td className="px-4 py-3 text-[#0A1628]">{format(new Date(c.shiftDate), "EEE d MMM")}</td>
                                            <td className="px-4 py-3 text-[#0A1628]">{c.facilityName}</td>
                                            <td className="px-4 py-3 text-[#5B6E8C]">{c.role}</td>
                                            <td className="px-4 py-3 text-center text-[#0A1628]">
                                                {c.confirmedCount} / {c.requiredCount}
                                            </td>
                                            <td className="px-4 py-3 text-center font-medium text-[#991B1B]">{c.shortfall > 0 ? c.shortfall : "—"}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
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
}
