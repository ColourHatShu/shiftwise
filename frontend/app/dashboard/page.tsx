"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Users, FileText, Clock, ShieldCheck, ArrowUpRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Stats {
    totalWorkers: number;
    documentsPending: number;
    expiringSoon: number;
    compliantWorkers: number;
}

export default function DashboardPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [agencyName, setAgencyName] = useState("");
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!isLoaded || !isSignedIn) return;
            try {
                const token = await getToken();
                const [statsRes, agencyRes] = await Promise.all([
                    fetch(`${API_URL}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/agencies/me`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                if (statsRes.ok) setStats(await statsRes.json());
                if (agencyRes.ok) {
                    const { data } = await agencyRes.json();
                    setAgencyName(data.name ?? "");
                }
            } catch (err) {
                console.error("Failed to fetch stats:", err);
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, [isLoaded, isSignedIn, getToken]);

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
        if (rate >= 80) return "#1D9E75";
        if (rate >= 50) return "#EF9F27";
        return "#E24B4A";
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-medium text-[#1A1A2E]">
                    {agencyName ? `Welcome back, ${agencyName}` : "Dashboard"}
                </h1>
                <p className="text-[#6B7280] mt-1">Here's a snapshot of your agency's compliance status.</p>
            </div>

            {/* Compliance Overview Card */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-medium text-[#1A1A2E]">Compliance Overview</h2>
                        <p className="text-sm text-[#6B7280]">Overall agency compliance rate</p>
                    </div>
                    <div className="text-right">
                        <span 
                            className="text-3xl font-medium"
                            style={{ color: getComplianceColor() }}
                        >
                            {getComplianceRate()}%
                        </span>
                        <p className="text-sm text-[#6B7280]">Compliant</p>
                    </div>
                </div>
                <div className="w-full bg-[#F8F9FB] rounded-full h-2">
                    <div 
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${getComplianceRate()}%`, backgroundColor: getComplianceColor() }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-[#6B7280]">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((s) => {
                    const Icon = s.icon;
                    const colorStyles = {
                        navy: { bg: "bg-[#EEF2FF]", text: "text-[#0F2647]", icon: "text-[#0F2647]" },
                        green: { bg: "bg-[#EAF3DE]", text: "text-[#3B6D11]", icon: "text-[#3B6D11]" },
                        amber: { bg: "bg-[#FAEEDA]", text: "text-[#854F0B]", icon: "text-[#854F0B]" },
                        red: { bg: "bg-[#FCEBEB]", text: "text-[#A32D2D]", icon: "text-[#A32D2D]" },
                    };
                    const styles = colorStyles[s.color];
                    return (
                        <Link
                            key={s.label}
                            href={s.href}
                            className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#0F2647]/20 hover:shadow-sm transition-all group"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.5px] font-medium text-[#6B7280]">
                                        {s.label}
                                    </p>
                                    {statsLoading ? (
                                        <div className="h-8 w-12 bg-[#F8F9FB] rounded mt-2 animate-pulse" />
                                    ) : (
                                        <p className={`text-2xl font-medium mt-1 ${styles.text}`}>{s.value}</p>
                                    )}
                                </div>
                                <div className={`p-2 rounded-lg ${styles.bg}`}>
                                    <Icon size={18} className={styles.icon} />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-4 text-xs font-medium text-[#6B7280] group-hover:text-[#0F2647] transition-colors">
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
                    className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#0F2647]/20 hover:shadow-sm transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#0F2647] flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-medium text-[#1A1A2E]">Add New Worker</h3>
                            <p className="text-sm text-[#6B7280]">Register a new staff member</p>
                        </div>
                    </div>
                </Link>
                <Link 
                    href="/dashboard/reports"
                    className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#0F2647]/20 hover:shadow-sm transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#0F2647] flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-medium text-[#1A1A2E]">Generate Report</h3>
                            <p className="text-sm text-[#6B7280]">Download compliance reports</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
