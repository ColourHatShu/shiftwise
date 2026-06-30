"use client";

import { useEffect, useState } from "react";
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
    Archive,
    Menu,
    X,
} from "lucide-react";

const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Workers", href: "/dashboard/workers", icon: Users },
    { label: "Documents", href: "/dashboard/documents", icon: FileText },
    { label: "Shifts", href: "/dashboard/shifts", icon: Calendar },
    { label: "Availability", href: "/dashboard/availability", icon: Calendar },
    { label: "Audit Log", href: "/dashboard/audit-log", icon: FileText },
    { label: "Audit Packs", href: "/dashboard/audit-packs", icon: Archive },
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
    const [mobileOpen, setMobileOpen] = useState(false);

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

    // Close the mobile drawer whenever the route changes
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Lock body scroll while the mobile drawer is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [mobileOpen]);

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-[#F5F7FA] md:flex">
            {/* ── Mobile Top Bar (hamburger) ── */}
            <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-[#DDE3EE] px-4 py-3 shadow-sm">
                <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation menu"
                    aria-expanded={mobileOpen}
                    aria-controls="dashboard-sidebar"
                    className="p-1.5 -ml-1.5 rounded-lg text-[#5B6E8C] hover:text-[#0A1628] hover:bg-[#F5F7FA] transition-colors duration-150"
                >
                    <Menu size={22} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#003087] flex items-center justify-center">
                        <span className="text-white font-semibold text-xs">SW</span>
                    </div>
                    <span className="text-base font-medium text-[#0A1628] tracking-tight">
                        ShiftWise
                    </span>
                </div>
            </header>

            {/* ── Backdrop (mobile only, when drawer open) ── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                    aria-hidden="true"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Professional White Sidebar with Royal Blue Accents ── */}
            <aside
                id="dashboard-sidebar"
                className={`fixed md:sticky top-0 left-0 z-50 w-[220px] shrink-0 flex flex-col bg-white border-r border-[#DDE3EE] h-screen shadow-sm transform transition-transform duration-200 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
            >
                {/* Logo */}
                <div className="px-5 py-5 border-b border-[#DDE3EE] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#003087] flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">SW</span>
                        </div>
                        <span className="text-lg font-medium text-[#0A1628] tracking-tight">
                            ShiftWise
                        </span>
                    </div>
                    {/* Close button (mobile only) */}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close navigation menu"
                        className="md:hidden p-1.5 -mr-1.5 rounded-lg text-[#5B6E8C] hover:text-[#0A1628] hover:bg-[#F5F7FA] transition-colors duration-150"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navItems.map(({ label, href, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group relative border-l-3 ${active
                                    ? "bg-[#E6EDF8] text-[#003087] border-l-[#003087]"
                                    : "text-[#5B6E8C] hover:text-[#0A1628] hover:bg-[#F5F7FA] border-l-transparent"
                                }`}
                            >
                                <Icon
                                    size={18}
                                    className={`shrink-0 ${active ? "text-[#003087]" : "text-[#5B6E8C] group-hover:text-[#0A1628]"}`}
                                />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* User & Sign Out */}
                <div className="px-3 py-4 border-t border-[#DDE3EE]">
                    <SignOutButton redirectUrl="/sign-in">
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-[#5B6E8C] hover:text-[#0A1628] hover:bg-[#F5F7FA] transition-all duration-150 group border-l-3 border-l-transparent">
                            <LogOut size={18} className="shrink-0 text-[#5B6E8C] group-hover:text-[#0A1628]" />
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
