"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, SignOutButton } from "@clerk/nextjs";
import {
    LayoutDashboard,
    Users,
    FileText,
    BarChart2,
    Settings,
    LogOut,
} from "lucide-react";

const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Workers", href: "/dashboard/workers", icon: Users },
    { label: "Documents", href: "/dashboard/documents", icon: FileText },
    { label: "Reports", href: "/dashboard/reports", icon: BarChart2 },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { getToken, isLoaded, isSignedIn } = useAuth();

    // On every dashboard load: ensure agency exists, then check onboarding status
    useEffect(() => {
        const checkOnboarding = async () => {
            if (!isLoaded || !isSignedIn) return;
            try {
                const token = await getToken();

                // 1. Ensure agency + user record exist
                await fetch(`${API_URL}/api/agencies/setup`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                // 2. Check if agency has completed onboarding
                const meRes = await fetch(`${API_URL}/api/agencies/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (meRes.ok) {
                    const { data: agency } = await meRes.json();
                    if (!agency.isOnboarded) {
                        router.replace("/onboarding");
                    }
                }
            } catch (err) {
                console.error("Onboarding check failed:", err);
            }
        };
        checkOnboarding();
    }, [isLoaded, isSignedIn, getToken, router]);

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex">
            {/* ── Sidebar ── */}
            <aside className="w-64 shrink-0 flex flex-col bg-slate-900/80 backdrop-blur-md border-r border-slate-700/50 sticky top-0 h-screen">
                {/* Logo */}
                <div className="px-6 py-5 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-blue-500/30">
                            SW
                        </div>
                        <span className="text-lg font-bold tracking-tight text-white">
                            ShiftWise
                        </span>
                    </div>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navItems.map(({ label, href, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={href} href={href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${active
                                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
                                    }`}
                            >
                                <Icon
                                    size={18}
                                    className={`shrink-0 transition-colors ${active
                                        ? "text-blue-400"
                                        : "text-slate-500 group-hover:text-slate-300"
                                        }`}
                                />
                                {label}
                                {active && (
                                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Sign Out */}
                <div className="px-3 py-4 border-t border-slate-700/50">
                    <SignOutButton redirectUrl="/sign-in">
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-150 group">
                            <LogOut
                                size={18}
                                className="shrink-0 text-slate-500 group-hover:text-red-400 transition-colors"
                            />
                            Sign Out
                        </button>
                    </SignOutButton>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
