"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Users, FileText, Clock, ShieldCheck, ArrowUpRight, CalendarClock } from "lucide-react";
import { useApi } from "@/lib/use-api";

interface Stats {
    totalWorkers: number;
    documentsPending: number;
    expiringSoon: number;
    compliantWorkers: number;
}

export default function DashboardPage() {
    const { isLoaded, isSignedIn } = useAuth();
    const { apiFetch } = useApi();
    const [stats, setStats] = useState<Stats | null>(null);
    const [agencyName, setAgencyName] = useState("");
    const [statsLoading, setStatsLoading] = useState(true);
    const [shiftsNeedingAttention, setShiftsNeedingAttention] = useState(0);

    useEffect(() => {
        const fetchStats = async () => {
            if (!isLoaded || !isSignedIn) return;
            try {
                const [statsRes, agencyRes, coverageRes] = await Promise.all([
                    apiFetch(`/api/dashboard/stats`),
                    apiFetch(`/api/agencies/me`),
                    apiFetch(`/api/shift-coverage`),
                ]);
                if (statsRes.ok) setStats(await statsRes.json());
                if (agencyRes.ok) {
                    const { data } = await agencyRes.json();
                    setAgencyName(data.name ?? "");
                }
                if (coverageRes.ok) {
                    const { summary } = await coverageRes.json();
                    setShiftsNeedingAttention(summary?.needingAttention ?? 0);
                }
            } catch (err) {
                console.error("Failed to fetch stats:", err);
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, [isLoaded, isSignedIn, apiFetch]);

    const statCards = [
        {
            label: "TOTAL WORKERS",
            value: stats?.totalWorkers ?? 0,
            icon: Users,
            color: "navy" as const,
            href: "/dashboard/workers",
        },
        {
            label: "PENDING REVIEW",
            value: stats?.documentsPending ?? 0,
            icon: FileText,
            color: "amber" as const,
            href: "/dashboard/documents",
        },
        {
            label: "EXPIRING SOON",
            value: stats?.expiringSoon ?? 0,
            icon: Clock,
            color: "red" as const,
            href: "/dashboard/documents",
        },
        {
            label: "COMPLIANT",
            value: stats?.compliantWorkers ?? 0,
            icon: ShieldCheck,
            color: "green" as const,
            href: "/dashboard/workers",
        },
    ];

    const getComplianceRate = () => {
        if (!stats || stats.totalWorkers === 0) return 0;
        return Math.round((stats.compliantWorkers / stats.totalWorkers) * 100);
    };

    const getComplianceColor = () => {
        const rate = getComplianceRate();
        if (rate >= 80) return "#16A34A";
        if (rate >= 50) return "#D97706";
        return "#DC2626";
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-medium text-[#0A1628]">
                    {agencyName ? `Welcome back, ${agencyName}` : "Dashboard"}
                </h1>
                <p className="text-[#5B6E8C] mt-1">Here's a snapshot of your agency's compliance status.</p>
            </div>

            {/* Compliance Overview Card */}
            <div className="bg-white rounded-xl border border-[#DDE3EE] p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-medium text-[#0A1628]">Compliance Overview</h2>
                        <p className="text-sm text-[#5B6E8C]">Overall agency compliance rate</p>
                    </div>
                    <div className="text-right">
                        <span 
                            className="text-3xl font-medium"
                            style={{ color: getComplianceColor() }}
                        >
                            {getComplianceRate()}%
                        </span>
                        <p className="text-sm text-[#5B6E8C]">Compliant</p>
                    </div>
                </div>
                <div className="w-full bg-[#F5F7FA] rounded-full h-2">
                    <div 
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${getComplianceRate()}%`, backgroundColor: getComplianceColor() }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-[#5B6E8C]">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                </div>
            </div>

            {/* Shift coverage alert — only when upcoming shifts are short of workers */}
            {!statsLoading && shiftsNeedingAttention > 0 && (
                <Link
                    href="/dashboard/shifts/coverage"
                    className="flex items-center justify-between rounded-xl border border-[#FEF3C7] bg-[#FEF3C7]/50 p-5 transition-all hover:border-[#92400E]/30 hover:shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-[#FEF3C7] p-2">
                            <CalendarClock size={18} className="text-[#92400E]" />
                        </div>
                        <div>
                            <h3 className="font-medium text-[#0A1628]">
                                {shiftsNeedingAttention} upcoming shift{shiftsNeedingAttention === 1 ? "" : "s"} need{shiftsNeedingAttention === 1 ? "s" : ""} workers
                            </h3>
                            <p className="text-sm text-[#5B6E8C]">Not enough confirmed workers yet — review coverage.</p>
                        </div>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-[#92400E]">
                        Review coverage <ArrowUpRight size={14} />
                    </span>
                </Link>
            )}

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((s) => {
                    const Icon = s.icon;
                    const colorStyles = {
                        navy: { bg: "bg-[#E6EDF8]", text: "text-[#003087]", icon: "text-[#003087]" },
                        green: { bg: "bg-[#DCFCE7]", text: "text-[#166534]", icon: "text-[#166534]" },
                        amber: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: "text-[#92400E]" },
                        red: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", icon: "text-[#991B1B]" },
                    };
                    const styles = colorStyles[s.color];
                    return (
                        <Link
                            key={s.label}
                            href={s.href}
                            className="bg-white rounded-xl border border-[#DDE3EE] p-5 hover:border-[#003087]/20 hover:shadow-sm transition-all group"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.5px] font-medium text-[#5B6E8C]">
                                        {s.label}
                                    </p>
                                    {statsLoading ? (
                                        <div className="h-8 w-12 bg-[#F5F7FA] rounded mt-2 animate-pulse" />
                                    ) : (
                                        <p className={`text-2xl font-medium mt-1 ${styles.text}`}>{s.value}</p>
                                    )}
                                </div>
                                <div className={`p-2 rounded-lg ${styles.bg}`}>
                                    <Icon size={18} className={styles.icon} />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-4 text-xs font-medium text-[#5B6E8C] group-hover:text-[#003087] transition-colors">
                                View details
                                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="grid sm:grid-cols-2 gap-4">
                <Link 
                    href="/dashboard/workers/new"
                    className="bg-white rounded-xl border border-[#DDE3EE] p-5 hover:border-[#003087]/20 hover:shadow-sm transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#003087] flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-medium text-[#0A1628]">Add New Worker</h3>
                            <p className="text-sm text-[#5B6E8C]">Register a new staff member</p>
                        </div>
                    </div>
                </Link>
                <Link 
                    href="/dashboard/reports"
                    className="bg-white rounded-xl border border-[#DDE3EE] p-5 hover:border-[#003087]/20 hover:shadow-sm transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#003087] flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-medium text-[#0A1628]">Generate Report</h3>
                            <p className="text-sm text-[#5B6E8C]">Download compliance reports</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
