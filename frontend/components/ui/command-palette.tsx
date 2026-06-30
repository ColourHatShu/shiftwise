"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    LayoutDashboard,
    Users,
    UserPlus,
    FileText,
    Calendar,
    Archive,
    BarChart3,
    Settings,
    type LucideIcon,
} from "lucide-react";

interface Command {
    id: string;
    label: string;
    hint?: string;
    keywords?: string;
    icon: LucideIcon;
    href: string;
}

// First slice: navigation + quick actions across the coordinator dashboard.
// Live worker/shift/document data search can be layered on later.
const COMMANDS: Command[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", keywords: "home overview" },
    { id: "workers", label: "Workers", icon: Users, href: "/dashboard/workers", keywords: "staff carers nurses" },
    { id: "add-worker", label: "Add Worker", hint: "Create", icon: UserPlus, href: "/dashboard/workers/new", keywords: "new staff create" },
    { id: "documents", label: "Documents", icon: FileText, href: "/dashboard/documents", keywords: "compliance files dbs" },
    { id: "shifts", label: "Shifts", icon: Calendar, href: "/dashboard/shifts", keywords: "rota calendar schedule" },
    { id: "audit-log", label: "Audit Log", icon: FileText, href: "/dashboard/audit-log", keywords: "history activity" },
    { id: "audit-packs", label: "Audit Packs", icon: Archive, href: "/dashboard/audit-packs", keywords: "cqc export zip" },
    { id: "reports", label: "Reports", icon: BarChart3, href: "/dashboard/reports", keywords: "pdf compliance export" },
    { id: "settings", label: "Settings", icon: Settings, href: "/dashboard/settings", keywords: "agency profile config" },
];

/**
 * CommandPalette — a ⌘K / Ctrl+K command palette for fast navigation and
 * quick actions. Mounted once in the dashboard layout. Client-side fuzzy
 * (substring) filtering over the command list; full keyboard navigation.
 */
export function CommandPalette() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Global ⌘K / Ctrl+K toggle (+ Esc close).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            } else if (e.key === "Escape") {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Reset + focus the input each time the palette opens.
    useEffect(() => {
        if (!open) return;
        setQuery("");
        const t = setTimeout(() => inputRef.current?.focus(), 0);
        return () => clearTimeout(t);
    }, [open]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return COMMANDS;
        return COMMANDS.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
    }, [query]);

    // Keep the highlighted row valid as the result set changes.
    useEffect(() => {
        setActive(0);
    }, [query]);

    if (!open) return null;

    const run = (cmd?: Command) => {
        if (!cmd) return;
        setOpen(false);
        router.push(cmd.href);
    };

    const onInputKey = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            run(results[active]);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
        >
            <div
                className="w-full max-w-lg overflow-hidden rounded-xl border border-[#DDE3EE] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search input */}
                <div className="flex items-center gap-3 border-b border-[#DDE3EE] px-4">
                    <Search size={18} className="shrink-0 text-[#5B6E8C]" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onInputKey}
                        placeholder="Search pages and actions…"
                        aria-label="Search pages and actions"
                        className="w-full bg-transparent py-3.5 text-sm text-[#0A1628] placeholder-[#5B6E8C] focus:outline-none"
                    />
                </div>

                {/* Results */}
                <ul className="max-h-80 overflow-y-auto py-2">
                    {results.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-[#5B6E8C]">No matches</li>
                    ) : (
                        results.map((cmd, i) => {
                            const Icon = cmd.icon;
                            const isActive = i === active;
                            return (
                                <li key={cmd.id}>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setActive(i)}
                                        onClick={() => run(cmd)}
                                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                            isActive ? "bg-[#E6EDF8] text-[#003087]" : "text-[#0A1628] hover:bg-[#F5F7FA]"
                                        }`}
                                    >
                                        <Icon size={16} className={isActive ? "text-[#003087]" : "text-[#5B6E8C]"} />
                                        <span className="flex-1">{cmd.label}</span>
                                        {cmd.hint && (
                                            <span className="text-[11px] uppercase tracking-wide text-[#5B6E8C]">{cmd.hint}</span>
                                        )}
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>

                {/* Footer hint */}
                <div className="flex items-center justify-between border-t border-[#DDE3EE] px-4 py-2 text-[11px] text-[#5B6E8C]">
                    <span>↑↓ navigate · ↵ open · esc close</span>
                    <span>⌘K / Ctrl K</span>
                </div>
            </div>
        </div>
    );
}

export default CommandPalette;
