"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Trash2, CalendarPlus, LayoutTemplate } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";

interface ShiftTemplate {
    id: string;
    name: string;
    facilityName: string;
    role: string;
    startTime: string;
    endTime: string;
    requiredCount: number;
    notes?: string | null;
}

const EMPTY_FORM = { name: "", facilityName: "", role: "", startTime: "", endTime: "", requiredCount: 1, notes: "" };

export default function ShiftTemplatesPage() {
    const { apiFetch } = useApi();
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ShiftTemplate | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [createDate, setCreateDate] = useState<Record<string, string>>({});
    const [creatingShift, setCreatingShift] = useState<string | null>(null);

    const fetchTemplates = async () => {
        try {
            const res = await apiFetch(`/api/shift-templates`);
            if (!res.ok) throw new Error("Failed to load templates");
            const { data } = await res.json();
            setTemplates(data || []);
        } catch {
            toast.error("Failed to load shift templates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await apiFetch(`/api/shift-templates`, {
                method: "POST",
                body: JSON.stringify({ ...form, requiredCount: Number(form.requiredCount) }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create template");
            }
            toast.success("Template created");
            setForm({ ...EMPTY_FORM });
            setShowForm(false);
            fetchTemplates();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create template");
        } finally {
            setSaving(false);
        }
    };

    const deleteTemplate = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await apiFetch(`/api/shift-templates/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete template");
            toast.success("Template deleted");
            setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        } catch {
            toast.error("Failed to delete template");
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const createShiftFromTemplate = async (t: ShiftTemplate) => {
        const date = createDate[t.id];
        if (!date) {
            toast.error("Pick a date first");
            return;
        }
        setCreatingShift(t.id);
        try {
            const res = await apiFetch(`/api/shifts`, {
                method: "POST",
                body: JSON.stringify({
                    facilityName: t.facilityName,
                    shiftDate: date,
                    startTime: t.startTime,
                    endTime: t.endTime,
                    role: t.role,
                    requiredCount: t.requiredCount,
                    notes: t.notes || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create shift");
            }
            toast.success(`Shift created at ${t.facilityName}`);
            setCreateDate((prev) => ({ ...prev, [t.id]: "" }));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create shift");
        } finally {
            setCreatingShift(null);
        }
    };

    const inputCls =
        "w-full bg-[#F5F7FA] border border-[#DDE3EE] text-[#0A1628] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Link href="/dashboard/shifts" className="inline-flex items-center gap-1.5 text-sm text-[#5B6E8C] hover:text-[#0A1628] transition-colors">
                        <ArrowLeft size={15} /> Back to Shifts
                    </Link>
                    <h1 className="mt-2 text-2xl font-medium text-[#0A1628]">Shift Templates</h1>
                    <p className="mt-1 text-[#5B6E8C]">Save common shifts as templates, then create a dated shift in one click.</p>
                </div>
                <button
                    onClick={() => setShowForm((s) => !s)}
                    className="flex items-center gap-2 rounded-lg bg-[#003087] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#003087]/90"
                >
                    <Plus size={18} /> New Template
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <form onSubmit={createTemplate} className="rounded-xl border border-[#DDE3EE] bg-white p-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Template name *</label>
                            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekday Nurse — St Mary's" className={inputCls} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Facility *</label>
                            <input required value={form.facilityName} onChange={(e) => setForm({ ...form, facilityName: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Role *</label>
                            <input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Nurse" className={inputCls} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Start time *</label>
                            <input required type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">End time *</label>
                            <input required type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Workers needed *</label>
                            <input required type="number" min={1} value={form.requiredCount} onChange={(e) => setForm({ ...form, requiredCount: Number(e.target.value) })} className={inputCls} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Notes</label>
                            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                        <button type="button" onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }} className="rounded-lg px-4 py-2 text-sm font-medium text-[#5B6E8C] hover:bg-[#F5F7FA] transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="rounded-lg bg-[#003087] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003087]/90 disabled:opacity-60">
                            {saving ? "Saving…" : "Save template"}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
                </div>
            ) : templates.length === 0 ? (
                <EmptyState
                    icon={LayoutTemplate}
                    title="No templates yet"
                    message="Create a template to speed up posting recurring shifts."
                    className="rounded-xl border border-[#DDE3EE] bg-white"
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((t) => (
                        <div key={t.id} className="flex flex-col rounded-xl border border-[#DDE3EE] bg-white p-5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="truncate font-medium text-[#0A1628]">{t.name}</h3>
                                    <p className="mt-0.5 truncate text-sm text-[#5B6E8C]">{t.facilityName}</p>
                                </div>
                                <button onClick={() => setDeleteTarget(t)} aria-label="Delete template" className="shrink-0 rounded-lg p-1.5 text-[#5B6E8C] transition-colors hover:bg-[#FEE2E2] hover:text-[#991B1B]">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5B6E8C]">
                                <span>{t.role}</span>
                                <span>{t.startTime}–{t.endTime}</span>
                                <span>{t.requiredCount} needed</span>
                            </div>

                            {/* Create shift from template */}
                            <div className="mt-auto flex items-center gap-2 pt-4">
                                <input
                                    type="date"
                                    value={createDate[t.id] || ""}
                                    onChange={(e) => setCreateDate((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                    aria-label={`Date for ${t.name}`}
                                    className="flex-1 rounded-lg border border-[#DDE3EE] bg-[#F5F7FA] px-2.5 py-1.5 text-sm text-[#0A1628] focus:border-[#003087] focus:outline-none"
                                />
                                <button
                                    onClick={() => createShiftFromTemplate(t)}
                                    disabled={creatingShift === t.id}
                                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#E6EDF8] px-3 py-1.5 text-sm font-medium text-[#003087] transition-colors hover:bg-[#E6EDF8]/70 disabled:opacity-60"
                                >
                                    <CalendarPlus size={15} /> {creatingShift === t.id ? "…" : "Create"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                busy={deleting}
                title="Delete template"
                message={`Delete the "${deleteTarget?.name}" template? Shifts already created from it are not affected.`}
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={deleteTemplate}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
