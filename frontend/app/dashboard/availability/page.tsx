"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@/components/ui/skeleton";

type Status = "AVAILABLE" | "UNAVAILABLE" | "ON_LEAVE";

interface WorkerOption {
    id: string;
    firstName: string;
    lastName: string;
}

interface AvailabilityEntry {
    date: string; // ISO from the API
    status: Status;
}

const STATUS_META: Record<Status, { label: string; idle: string; active: string }> = {
    AVAILABLE: { label: "Available", idle: "bg-[#F5F7FA] text-[#5B6E8C] hover:bg-[#DCFCE7]", active: "bg-[#16A34A] text-white" },
    UNAVAILABLE: { label: "Unavailable", idle: "bg-[#F5F7FA] text-[#5B6E8C] hover:bg-[#FEE2E2]", active: "bg-[#DC2626] text-white" },
    ON_LEAVE: { label: "On Leave", idle: "bg-[#F5F7FA] text-[#5B6E8C] hover:bg-[#FEF3C7]", active: "bg-[#D97706] text-white" },
};

// Local YYYY-MM-DD (avoids UTC off-by-one from toISOString()).
function ymd(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AvailabilityPage() {
    const { isLoaded, isSignedIn } = useAuth();
    const { apiFetch } = useApi();

    const [workers, setWorkers] = useState<WorkerOption[]>([]);
    const [workerId, setWorkerId] = useState("");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [availability, setAvailability] = useState<Record<string, Status>>({});
    const [loadingWorkers, setLoadingWorkers] = useState(true);
    const [loadingCal, setLoadingCal] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();

    // Load the agency's workers for the picker.
    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;
        (async () => {
            try {
                const res = await apiFetch(`/api/workers?limit=100`);
                if (!res.ok) throw new Error("failed");
                const data = await res.json();
                setWorkers(data.data || []);
            } catch {
                setWorkers([]);
            } finally {
                setLoadingWorkers(false);
            }
        })();
    }, [isLoaded, isSignedIn, apiFetch]);

    // Load the selected worker's availability for the visible month.
    useEffect(() => {
        if (!workerId) {
            setAvailability({});
            return;
        }
        let cancelled = false;
        setLoadingCal(true);
        (async () => {
            try {
                const startDate = ymd(year, month, 1);
                const endDate = ymd(year, month, daysInMonth);
                const res = await apiFetch(
                    `/api/workers/${workerId}/availability?startDate=${startDate}&endDate=${endDate}`
                );
                if (!res.ok) throw new Error("failed");
                const data = await res.json();
                if (cancelled) return;
                const map: Record<string, Status> = {};
                (data.data || []).forEach((e: AvailabilityEntry) => {
                    map[e.date.split("T")[0]] = e.status;
                });
                setAvailability(map);
            } catch {
                if (!cancelled) setAvailability({});
            } finally {
                if (!cancelled) setLoadingCal(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [workerId, year, month, daysInMonth, apiFetch]);

    // Set a status (click the active one again to clear it).
    async function setStatus(date: string, status: Status) {
        if (!workerId || saving) return;
        const current = availability[date];
        const clearing = current === status;
        setSaving(date);
        // Optimistic update
        setAvailability((prev) => {
            const next = { ...prev };
            if (clearing) delete next[date];
            else next[date] = status;
            return next;
        });
        try {
            const res = clearing
                ? await apiFetch(`/api/workers/${workerId}/availability/${date}`, { method: "DELETE" })
                : await apiFetch(`/api/workers/${workerId}/availability`, {
                      method: "POST",
                      body: JSON.stringify({ date, status }),
                  });
            if (!res.ok && !(clearing && res.status === 404)) throw new Error("save failed");
        } catch {
            // Roll back on failure
            setAvailability((prev) => {
                const next = { ...prev };
                if (clearing) next[date] = current as Status;
                else if (current) next[date] = current;
                else delete next[date];
                return next;
            });
        } finally {
            setSaving(null);
        }
    }

    const days: (number | null)[] = useMemo(
        () => [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)],
        [firstWeekday, daysInMonth]
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-medium text-[#0A1628]">Availability</h1>
                    <p className="mt-1 text-[#5B6E8C]">Mark when a worker is available, unavailable, or on leave.</p>
                </div>
                {loadingWorkers ? (
                    <Skeleton className="h-10 w-64 rounded-lg" />
                ) : (
                    <select
                        value={workerId}
                        onChange={(e) => setWorkerId(e.target.value)}
                        className="rounded-lg border border-[#DDE3EE] bg-white px-4 py-2.5 text-sm text-[#0A1628] focus:border-[#003087] focus:outline-none focus:ring-1 focus:ring-[#003087]"
                    >
                        <option value="">Select a worker…</option>
                        {workers.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.firstName} {w.lastName}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {!workerId ? (
                <div className="rounded-xl border border-[#DDE3EE] bg-white p-12 text-center">
                    <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-[#F5F7FA]">
                        <CalendarDays size={24} className="text-[#5B6E8C]" />
                    </div>
                    <p className="text-[#5B6E8C]">Select a worker to view and edit their availability calendar.</p>
                </div>
            ) : (
                <div className="rounded-xl border border-[#DDE3EE] bg-white p-6">
                    {/* Month nav */}
                    <div className="mb-6 flex items-center justify-between">
                        <button
                            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                            aria-label="Previous month"
                            className="rounded-lg p-2 text-[#5B6E8C] transition-colors hover:bg-[#F5F7FA] hover:text-[#0A1628]"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="text-lg font-medium text-[#0A1628]">
                            {currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                        </h2>
                        <button
                            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                            aria-label="Next month"
                            className="rounded-lg p-2 text-[#5B6E8C] transition-colors hover:bg-[#F5F7FA] hover:text-[#0A1628]"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Weekday headers */}
                    <div className="mb-2 grid grid-cols-7 gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                            <div key={d} className="py-1 text-center text-[11px] font-medium uppercase tracking-[0.5px] text-[#5B6E8C]">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    {loadingCal ? (
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 35 }).map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {days.map((day, i) => {
                                if (!day) return <div key={`empty-${i}`} />;
                                const date = ymd(year, month, day);
                                const status = availability[date];
                                return (
                                    <div key={date} className="flex min-h-24 flex-col rounded-lg border border-[#DDE3EE] p-2">
                                        <span className="mb-1.5 text-sm font-medium text-[#0A1628]">{day}</span>
                                        <div className="flex flex-1 flex-col gap-1">
                                            {(Object.keys(STATUS_META) as Status[]).map((s) => {
                                                const meta = STATUS_META[s];
                                                const isActive = status === s;
                                                return (
                                                    <button
                                                        key={s}
                                                        onClick={() => setStatus(date, s)}
                                                        disabled={saving === date}
                                                        className={`rounded px-1.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                                                            isActive ? meta.active : meta.idle
                                                        }`}
                                                    >
                                                        {meta.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="mt-6 flex flex-wrap gap-6 border-t border-[#DDE3EE] pt-4 text-sm text-[#5B6E8C]">
                        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#16A34A]" /> Available for shifts</span>
                        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#DC2626]" /> Not available</span>
                        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#D97706]" /> On leave / holiday</span>
                        <span className="text-[#5B6E8C]/70">Tip: click an active status again to clear it.</span>
                    </div>
                </div>
            )}
        </div>
    );
}
