"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, SignOutButton } from "@clerk/nextjs";
import {
    LayoutDashboard,
    Users,
    FileText,
    BarChart3,
    Settings,
    LogOut,
    Shield,
    Calendar,
} from "lucide-react";

const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Workers", href: "/dashboard/workers", icon: Users },
    { label: "Documents", href: "/dashboard/documents", icon: FileText },
    { label: "Shifts", href: "/dashboard/shifts", icon: Calendar },
    { label: "Availability", href: "/dashboard/availability", icon: Calendar },
    { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
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
        <div className="min-h-screen bg-[#F8F9FB] flex">
            {/* ── Professional Sidebar ── */}
            <aside className="w-[220px] shrink-0 flex flex-col bg-white border-r border-[#E5E7EB] sticky top-0 h-screen">
                {/* Logo */}
                <div className="px-5 py-5 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#0F2647] flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">SW</span>
                        </div>
                        <span className="text-lg font-medium text-[#1A1A2E] tracking-tight">
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
                                key={href} 
                                href={href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${active
                                    ? "bg-[#EEF2FF] text-[#0F2647]"
                                    : "text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F8F9FB]"
                                }`}
                            >
                                <Icon
                                    size={18}
                                    className={`shrink-0 ${active ? "text-[#0F2647]" : "text-[#6B7280] group-hover:text-[#1A1A2E]"}`}
                                />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* User & Sign Out */}
                <div className="px-3 py-4 border-t border-[#E5E7EB]">
                    <SignOutButton redirectUrl="/sign-in">
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F8F9FB] transition-all duration-150 group">
                            <LogOut size={18} className="shrink-0 text-[#6B7280] group-hover:text-[#1A1A2E]" />
                            Sign Out
                        </button>
                    </SignOutButton>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
