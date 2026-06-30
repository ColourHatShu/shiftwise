"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DocumentType } from "@/types/api";

const EMPTY = { name: "", description: "", isRequired: true, hasExpiry: true, expiryWarningDays: 30 };

export default function DocumentTypesManager() {
    const { apiFetch } = useApi();
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchTypes = async () => {
        try {
            const res = await apiFetch(`/api/document-types`);
            if (!res.ok) throw new Error();
            const { data } = await res.json();
            setTypes(data || []);
        } catch {
            toast.error("Failed to load document types");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTypes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...EMPTY });
        setShowForm(true);
    };

    const openEdit = (t: DocumentType) => {
        setEditingId(t.id);
        setForm({
            name: t.name,
            description: t.description || "",
            isRequired: t.isRequired ?? true,
            hasExpiry: t.hasExpiry ?? true,
            expiryWarningDays: t.expiryWarningDays ?? 30,
        });
        setShowForm(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await apiFetch(editingId ? `/api/document-types/${editingId}` : `/api/document-types`, {
                method: editingId ? "PATCH" : "POST",
                body: JSON.stringify({ ...form, expiryWarningDays: Number(form.expiryWarningDays) }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save document type");
            }
            toast.success(editingId ? "Document type updated" : "Document type created");
            setShowForm(false);
            setEditingId(null);
            setForm({ ...EMPTY });
            fetchTypes();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save document type");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await apiFetch(`/api/document-types/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to delete document type");
            }
            toast.success("Document type deleted");
            setTypes((prev) => prev.filter((t) => t.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            // Surfaces the backend's "in use" 409 message as a friendly toast.
            toast.error(err instanceof Error ? err.message : "Failed to delete document type");
            setDeleteTarget(null);
        } finally {
            setDeleting(false);
        }
    };

    const inputCls =
        "w-full bg-[#F5F7FA] border border-[#DDE3EE] text-[#0A1628] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all";

    return (
        <div className="bg-white border border-[#DDE3EE] rounded-xl p-6 md:p-8">
            <div className="flex items-center justify-between border-b border-[#DDE3EE] pb-3">
                <div className="flex items-center gap-2 text-[#003087] font-medium">
                    <FileText size={18} />
                    <h3>Required Documents</h3>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 rounded-lg bg-[#003087] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#003087]/90"
                >
                    <Plus size={16} /> Add type
                </button>
            </div>
            <p className="text-sm text-[#5B6E8C] mt-3">The compliance documents your workers must provide. These drive the RAG status and expiry alerts.</p>

            {/* Create / edit form */}
            {showForm && (
                <form onSubmit={submit} className="mt-5 rounded-lg border border-[#DDE3EE] bg-[#F5F7FA] p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Name *</label>
                            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DBS Check" className={inputCls} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Description</label>
                            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#0A1628]">Expiry warning (days)</label>
                            <input type="number" min={0} value={form.expiryWarningDays} onChange={(e) => setForm({ ...form, expiryWarningDays: Number(e.target.value) })} className={inputCls} />
                        </div>
                        <div className="flex items-end gap-6 pb-1">
                            <label className="flex items-center gap-2 text-sm text-[#0A1628]">
                                <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} /> Required
                            </label>
                            <label className="flex items-center gap-2 text-sm text-[#0A1628]">
                                <input type="checkbox" checked={form.hasExpiry} onChange={(e) => setForm({ ...form, hasExpiry: e.target.checked })} /> Has expiry
                            </label>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-lg px-4 py-2 text-sm font-medium text-[#5B6E8C] hover:bg-white transition-colors">Cancel</button>
                        <button type="submit" disabled={saving} className="rounded-lg bg-[#003087] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003087]/90 disabled:opacity-60">
                            {saving ? "Saving…" : editingId ? "Save changes" : "Create"}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="mt-5 space-y-2">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
                ) : types.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[#5B6E8C]">No document types yet. Add the documents your agency requires.</p>
                ) : (
                    types.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#DDE3EE] px-4 py-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="truncate font-medium text-[#0A1628]">{t.name}</p>
                                    {t.isRequired ? (
                                        <span className="rounded-full bg-[#E6EDF8] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#003087]">Required</span>
                                    ) : (
                                        <span className="rounded-full bg-[#EBEEF5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5B6E8C]">Optional</span>
                                    )}
                                </div>
                                <p className="mt-0.5 truncate text-xs text-[#5B6E8C]">
                                    {t.hasExpiry ? `Expires · warn ${t.expiryWarningDays ?? 30}d before` : "No expiry"}
                                    {t.description ? ` · ${t.description}` : ""}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <button onClick={() => openEdit(t)} aria-label={`Edit ${t.name}`} className="rounded-lg p-1.5 text-[#5B6E8C] transition-colors hover:bg-[#F5F7FA] hover:text-[#003087]">
                                    <Pencil size={15} />
                                </button>
                                <button onClick={() => setDeleteTarget(t)} aria-label={`Delete ${t.name}`} className="rounded-lg p-1.5 text-[#5B6E8C] transition-colors hover:bg-[#FEE2E2] hover:text-[#991B1B]">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmDialog
                open={!!deleteTarget}
                busy={deleting}
                title="Delete document type"
                message={`Delete the "${deleteTarget?.name}" document type? (Blocked if any uploaded documents still use it.)`}
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={remove}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
