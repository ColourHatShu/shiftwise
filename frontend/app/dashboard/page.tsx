"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Users, FileText, Clock, ShieldCheck } from "lucide-react";

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
            label: "Total Workers",
            value: stats?.totalWorkers ?? 0,
            icon: Users,
            color: "blue",
            href: "/dashboard/workers",
        },
        {
            label: "Documents Pending",
            value: stats?.documentsPending ?? 0,
            icon: FileText,
            color: "amber",
            href: "/dashboard/documents",
        },
        {
            label: "Expiring Soon",
            value: stats?.expiringSoon ?? 0,
            icon: Clock,
            color: "red",
            href: "/dashboard/documents",
        },
        {
            label: "Compliant Workers",
            value: stats?.compliantWorkers ?? 0,
            icon: ShieldCheck,
            color: "green",
            href: "/dashboard/workers",
        },
    ];

    const colorMap: Record<string, string> = {
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        red: "text-red-400 bg-red-500/10 border-red-500/20",
        green: "text-green-400 bg-green-500/10 border-green-500/20",
    };

    return (
        <div className="space-y-8">
            {/* Welcome Banner */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
                <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                    Overview
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
                    {agencyName
                        ? <>Welcome back, <span className="text-blue-400">{agencyName}</span>!</>
                        : "Dashboard"}
                </h1>
                <p className="text-slate-400">
                    Here's a snapshot of your agency's compliance status.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((s) => {
                    const Icon = s.icon;
                    return (
                        <Link
                            key={s.label}
                            href={s.href}
                            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm hover:border-slate-600/50 hover:bg-slate-800/70 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">
                                    {s.label}
                                </p>
                                <div className={`p-2 rounded-lg border ${colorMap[s.color]}`}>
                                    <Icon size={16} />
                                </div>
                            </div>
                            {statsLoading ? (
                                <div className="h-8 w-12 bg-slate-700/50 rounded animate-pulse" />
                            ) : (
                                <p className="text-3xl font-bold text-white">{s.value}</p>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Info Banner */}
            <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-5 text-sm text-blue-200">
                🚧 <strong>Document management is coming soon.</strong> You'll be able to upload, track and get expiry alerts for compliance documents.
            </div>
        </div>
    );
}
