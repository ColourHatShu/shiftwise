"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/use-api";
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
    User,
    Loader2,
    TrendingUp,
    CalendarClock,
    type LucideIcon,
} from "lucide-react";

/** Custom event other components dispatch to open the palette (e.g. a sidebar button). */
export const OPEN_COMMAND_PALETTE_EVENT = "shiftwise:open-command-palette";

interface Command {
    id: string;
    label: string;
    hint?: string;
    keywords?: string;
    icon: LucideIcon;
    href: string;
}

const COMMANDS: Command[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", keywords: "home overview" },
    { id: "workers", label: "Workers", icon: Users, href: "/dashboard/workers", keywords: "staff carers nurses" },
    { id: "add-worker", label: "Add Worker", hint: "Create", icon: UserPlus, href: "/dashboard/workers/new", keywords: "new staff create" },
    { id: "worker-reliability", label: "Worker Reliability", icon: TrendingUp, href: "/dashboard/workers/scorecards", keywords: "scorecards confirmation rate reliable staffing" },
    { id: "documents", label: "Documents", icon: FileText, href: "/dashboard/documents", keywords: "compliance files dbs" },
    { id: "shifts", label: "Shifts", icon: Calendar, href: "/dashboard/shifts", keywords: "rota calendar schedule" },
    { id: "shift-coverage", label: "Shift Coverage", icon: CalendarClock, href: "/dashboard/shifts/coverage", keywords: "gaps understaffed unfilled needs workers" },
    { id: "audit-log", label: "Audit Log", icon: FileText, href: "/dashboard/audit-log", keywords: "history activity" },
    { id: "audit-packs", label: "Audit Packs", icon: Archive, href: "/dashboard/audit-packs", keywords: "cqc export zip" },
    { id: "reports", label: "Reports", icon: BarChart3, href: "/dashboard/reports", keywords: "pdf compliance export" },
    { id: "settings", label: "Settings", icon: Settings, href: "/dashboard/settings", keywords: "agency profile config" },
];

interface WorkerHit {
    id: string;
    name: string;
    email: string;
}

interface ShiftHit {
    id: string;
    facility: string;
    meta: string;
}

// Flat, keyboard-navigable item — a static command, a live worker, or a live shift.
type Item =
    | { kind: "command"; cmd: Command }
    | { kind: "worker"; worker: WorkerHit }
    | { kind: "shift"; shift: ShiftHit };

/**
 * CommandPalette — ⌘K / Ctrl+K command palette. Mounted once in the dashboard
 * layout. Filters static navigation/actions client-side AND searches live worker
 * + shift data (debounced, in parallel, via the backend). Opens on ⌘K, on Ctrl+K,
 * or when any element dispatches OPEN_COMMAND_PALETTE_EVENT (the sidebar button).
 *
 * Documents are intentionally not searched: there's no document search endpoint
 * or detail route, and document hits would have no deep-link target distinct from
 * worker search.
 */
export function CommandPalette() {
    const router = useRouter();
    const { apiFetch } = useApi();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const [workers, setWorkers] = useState<WorkerHit[]>([]);
    const [shifts, setShifts] = useState<ShiftHit[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Open via ⌘K / Ctrl+K (toggle) or the custom event; Esc closes.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            } else if (e.key === "Escape") {
                setOpen(false);
            }
        };
        const onOpen = () => setOpen(true);
        window.addEventListener("keydown", onKey);
        window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
        };
    }, []);

    // Reset + focus the input each time the palette opens.
    useEffect(() => {
        if (!open) return;
        setQuery("");
        setWorkers([]);
        setShifts([]);
        const t = setTimeout(() => inputRef.current?.focus(), 0);
        return () => clearTimeout(t);
    }, [open]);

    const filteredCommands = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return COMMANDS;
        return COMMANDS.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
    }, [query]);

    // Debounced live search of workers + shifts in parallel (only while open).
    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (!q) {
            setWorkers([]);
            setShifts([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        const t = setTimeout(async () => {
            const [wRes, sRes] = await Promise.allSettled([
                apiFetch(`/api/workers?search=${encodeURIComponent(q)}&limit=5`),
                apiFetch(`/api/shifts?facilityName=${encodeURIComponent(q)}`),
            ]);
            if (cancelled) return;

            // Workers
            try {
                if (wRes.status === "fulfilled" && wRes.value.ok) {
                    const data = await wRes.value.json();
                    setWorkers(
                        (data.data || []).map((w: { id: string; firstName: string; lastName: string; email: string }) => ({
                            id: w.id,
                            name: `${w.firstName} ${w.lastName}`,
                            email: w.email,
                        }))
                    );
                } else {
                    setWorkers([]);
                }
            } catch {
                setWorkers([]);
            }

            // Shifts (cap at 5 client-side; endpoint has no limit param)
            try {
                if (sRes.status === "fulfilled" && sRes.value.ok) {
                    const data = await sRes.value.json();
                    setShifts(
                        (data.data || [])
                            .slice(0, 5)
                            .map((s: { id: string; facilityName: string; role: string; shiftDate: string }) => ({
                                id: s.id,
                                facility: s.facilityName,
                                meta: [s.role, s.shiftDate ? new Date(s.shiftDate).toLocaleDateString("en-GB") : null]
                                    .filter(Boolean)
                                    .join(" · "),
                            }))
                    );
                } else {
                    setShifts([]);
                }
            } catch {
                setShifts([]);
            }

            if (!cancelled) setLoading(false);
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [query, open, apiFetch]);

    // Unified flat list for keyboard navigation: commands, then workers, then shifts.
    const items: Item[] = useMemo(
        () => [
            ...filteredCommands.map((cmd) => ({ kind: "command" as const, cmd })),
            ...workers.map((worker) => ({ kind: "worker" as const, worker })),
            ...shifts.map((shift) => ({ kind: "shift" as const, shift })),
        ],
        [filteredCommands, workers, shifts]
    );

    // Keep the highlighted row valid as the result set changes.
    useEffect(() => {
        setActive(0);
    }, [query, workers.length, shifts.length]);

    if (!open) return null;

    const run = (item?: Item) => {
        if (!item) return;
        setOpen(false);
        if (item.kind === "command") router.push(item.cmd.href);
        else if (item.kind === "worker") router.push(`/dashboard/workers/${item.worker.id}`);
        else router.push("/dashboard/shifts");
    };

    const onInputKey = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            run(items[active]);
        }
    };

    const commandCount = filteredCommands.length;
    const workerStart = commandCount;
    const shiftStart = commandCount + workers.length;
    const nothing = items.length === 0 && !loading;

    const rowClass = (isActive: boolean) =>
        `flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
            isActive ? "bg-[#E6EDF8] text-[#003087]" : "text-[#0A1628] hover:bg-[#F5F7FA]"
        }`;

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
                        placeholder="Search pages, actions, workers, shifts…"
                        aria-label="Search pages, actions, workers, and shifts"
                        className="w-full bg-transparent py-3.5 text-sm text-[#0A1628] placeholder-[#5B6E8C] focus:outline-none"
                    />
                    {loading && <Loader2 size={16} className="shrink-0 animate-spin text-[#5B6E8C]" />}
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto py-2">
                    {nothing ? (
                        <p className="px-4 py-6 text-center text-sm text-[#5B6E8C]">No matches</p>
                    ) : (
                        <>
                            {filteredCommands.length > 0 && (
                                <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[#5B6E8C]">
                                    Pages &amp; actions
                                </p>
                            )}
                            {filteredCommands.map((cmd, i) => {
                                const Icon = cmd.icon;
                                const isActive = i === active;
                                return (
                                    <button
                                        key={cmd.id}
                                        type="button"
                                        onMouseEnter={() => setActive(i)}
                                        onClick={() => run({ kind: "command", cmd })}
                                        className={rowClass(isActive)}
                                    >
                                        <Icon size={16} className={isActive ? "text-[#003087]" : "text-[#5B6E8C]"} />
                                        <span className="flex-1">{cmd.label}</span>
                                        {cmd.hint && (
                                            <span className="text-[11px] uppercase tracking-wide text-[#5B6E8C]">{cmd.hint}</span>
                                        )}
                                    </button>
                                );
                            })}

                            {workers.length > 0 && (
                                <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[#5B6E8C]">
                                    Workers
                                </p>
                            )}
                            {workers.map((worker, j) => {
                                const isActive = workerStart + j === active;
                                return (
                                    <button
                                        key={worker.id}
                                        type="button"
                                        onMouseEnter={() => setActive(workerStart + j)}
                                        onClick={() => run({ kind: "worker", worker })}
                                        className={rowClass(isActive)}
                                    >
                                        <User size={16} className={isActive ? "text-[#003087]" : "text-[#5B6E8C]"} />
                                        <span className="flex-1 truncate">{worker.name}</span>
                                        <span className="max-w-[45%] truncate text-[11px] text-[#5B6E8C]">{worker.email}</span>
                                    </button>
                                );
                            })}

                            {shifts.length > 0 && (
                                <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[#5B6E8C]">
                                    Shifts
                                </p>
                            )}
                            {shifts.map((shift, k) => {
                                const isActive = shiftStart + k === active;
                                return (
                                    <button
                                        key={shift.id}
                                        type="button"
                                        onMouseEnter={() => setActive(shiftStart + k)}
                                        onClick={() => run({ kind: "shift", shift })}
                                        className={rowClass(isActive)}
                                    >
                                        <Calendar size={16} className={isActive ? "text-[#003087]" : "text-[#5B6E8C]"} />
                                        <span className="flex-1 truncate">{shift.facility}</span>
                                        <span className="max-w-[45%] truncate text-[11px] text-[#5B6E8C]">{shift.meta}</span>
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>

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
