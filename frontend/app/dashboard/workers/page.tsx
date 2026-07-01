"use client";

import { useEffect, useMemo, useState } from "react";
import React from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, User, Search, Eye, Edit, ArrowUpRight, ChevronLeft, ChevronRight, Upload, TrendingUp } from "lucide-react";
import EditWorkerModal from './components/EditWorkerModal';
import WorkerBulkUploadModal from './components/WorkerBulkUploadModal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useApi } from '@/lib/use-api';

interface Worker {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    jobTitle?: string;
    startDate?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    complianceScore?: number;
    documentsUploaded?: number;
    documentsTotal?: number;
}

type RagColorKey = "green" | "amber" | "red";

// Pure + module-scoped so the memoized worker rows have stable dependencies.
const RAG_COLORS: Record<RagColorKey, { dot: string; bar: string; text: string }> = {
    green: { dot: "bg-[#16A34A]", bar: "bg-[#16A34A]", text: "text-[#166534]" },
    amber: { dot: "bg-[#D97706]", bar: "bg-[#D97706]", text: "text-[#92400E]" },
    red: { dot: "bg-[#DC2626]", bar: "bg-[#DC2626]", text: "text-[#991B1B]" },
};

const getRAGStatus = (score: number): { color: RagColorKey; label: string } => {
    if (score >= 90) return { color: "green", label: "Compliant" };
    if (score >= 70) return { color: "amber", label: "Review" };
    return { color: "red", label: "Action" };
};

export default function WorkersPage() {
    const { isLoaded, isSignedIn } = useAuth();
    const { apiFetch } = useApi();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalWorkers, setTotalWorkers] = useState(0);
    const [showBulkImport, setShowBulkImport] = useState(false);

    // Debounce for search input
    const [searchInputValue, setSearchInputValue] = useState("");
    const searchTimeoutRef = React.useRef<NodeJS.Timeout>();

    const fetchWorkers = async (pageNum: number = 1, search: string = "", status: string = "") => {
        if (!isLoaded || !isSignedIn) return;
        try {
            setIsLoading(true);

            // Build query params
            const params = new URLSearchParams();
            params.append("page", pageNum.toString());
            params.append("limit", "20");
            if (search) params.append("search", search);
            if (status) params.append("status", status);

            const response = await apiFetch(`/api/workers?${params}`);
            if (!response.ok) throw new Error("Failed to fetch workers");
            const data = await response.json();
            // Hydrate compliance fields from the backend if present; otherwise leave them
            // undefined so the UI renders an "—" placeholder rather than a fake score.
            // (The previous Math.random() fixtures showed fictional RAG status to coordinators.)
            const workersFromApi = (data.data || []).map((w: Worker & { complianceScore?: number; documentsUploaded?: number; documentsTotal?: number }) => ({
                ...w,
                complianceScore: typeof w.complianceScore === 'number' ? w.complianceScore : undefined,
                documentsUploaded: typeof w.documentsUploaded === 'number' ? w.documentsUploaded : undefined,
                documentsTotal: typeof w.documentsTotal === 'number' ? w.documentsTotal : undefined,
            }));
            setWorkers(workersFromApi);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalWorkers(data.pagination?.total || 0);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchWorkers(1, searchQuery, selectedStatus);
    }, [isLoaded, isSignedIn, apiFetch]);

    // Fetch when page changes
    useEffect(() => {
        fetchWorkers(page, searchQuery, selectedStatus);
    }, [page]);

    // Debounced search
    const handleSearchChange = (value: string) => {
        setSearchInputValue(value);
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setSearchQuery(value);
            setPage(1);
            fetchWorkers(1, value, selectedStatus);
        }, 300);
    };

    // Status filter change
    const handleStatusChange = (status: string) => {
        setSelectedStatus(status);
        setPage(1);
        fetchWorkers(1, searchQuery, status);
    };

    // Memoize the rendered rows so typing in the (local-state) search box doesn't
    // rebuild the whole table on every keystroke — rows only depend on `workers`.
    const workerRows = useMemo(
        () =>
            workers.map((worker) => {
                const rag = getRAGStatus(worker.complianceScore || 0);
                const colors = RAG_COLORS[rag.color];
                return (
                    <tr key={worker.id} className="group hover:bg-[#F5F7FA] transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-[#E6EDF8] text-[#003087] flex items-center justify-center font-medium text-sm">
                                    {worker.firstName.charAt(0)}{worker.lastName.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium text-[#0A1628]">{worker.firstName} {worker.lastName}</p>
                                    <p className="text-xs text-[#5B6E8C]">{worker.email}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <p className="text-sm text-[#0A1628]">{worker.jobTitle || "Unassigned"}</p>
                            <p className="text-xs text-[#5B6E8C]">
                                {worker.startDate ? format(new Date(worker.startDate), "MMM yyyy") : "N/A"}
                            </p>
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={worker.status} /></td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 max-w-[120px]">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-[#5B6E8C]">
                                            {typeof worker.complianceScore === 'number' ? `${worker.complianceScore}%` : '—'}
                                        </span>
                                        <span className={`font-medium ${colors.text}`}>{rag.label}</span>
                                    </div>
                                    <div className="w-full bg-[#F5F7FA] rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${colors.bar}`} style={{ width: `${worker.complianceScore ?? 0}%` }} />
                                    </div>
                                </div>
                                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                            </div>
                            <p className="text-xs text-[#5B6E8C] mt-1">
                                {typeof worker.documentsUploaded === 'number' && typeof worker.documentsTotal === 'number'
                                    ? `${worker.documentsUploaded} of ${worker.documentsTotal} documents`
                                    : 'Documents not yet calculated'}
                            </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setEditingWorker(worker)}
                                    className="inline-flex items-center gap-1.5 text-[#5B6E8C] hover:text-[#003087] font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-all"
                                >
                                    <Edit size={14} />
                                    Edit
                                </button>
                                <Link
                                    href={`/dashboard/workers/${worker.id}`}
                                    className="inline-flex items-center gap-1.5 text-[#003087] hover:text-[#003087]/80 font-medium text-sm px-3 py-1.5 rounded-lg bg-[#E6EDF8] hover:bg-[#E6EDF8]/80 transition-all"
                                >
                                    <Eye size={14} />
                                    View
                                </Link>
                            </div>
                        </td>
                    </tr>
                );
            }),
        [workers]
    );

    if (!isLoaded || isLoading) {
        return (
            <div className="space-y-6" role="status" aria-label="Loading workers">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-40" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-11 w-32 rounded-lg" />
                </div>
                {/* Stats Summary */}
                <div className="grid sm:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-[#DDE3EE] p-4 space-y-3">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-7 w-12" />
                        </div>
                    ))}
                </div>
                {/* Filters */}
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-11 w-full max-w-md rounded-lg" />
                        <Skeleton className="h-11 w-40 rounded-lg" />
                    </div>
                </div>
                {/* Table */}
                <div className="bg-white rounded-xl border border-[#DDE3EE] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#DDE3EE] bg-[#F5F7FA]">
                        <Skeleton className="h-3 w-full max-w-2xl" />
                    </div>
                    <div className="divide-y divide-[#DDE3EE]">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="px-6 py-4 flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-2 w-28 rounded-full" />
                                <Skeleton className="h-8 w-24 rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>
                <span className="sr-only">Loading workers…</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-medium text-[#0A1628]">Workers</h1>
                    <p className="text-[#5B6E8C] mt-1">Manage your agency's healthcare staff</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/workers/scorecards"
                        className="flex items-center gap-2 border border-[#DDE3EE] text-[#003087] hover:bg-[#F5F7FA] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <TrendingUp size={18} />
                        Reliability
                    </Link>
                    <button
                        onClick={() => setShowBulkImport(true)}
                        className="flex items-center gap-2 border border-[#DDE3EE] text-[#003087] hover:bg-[#F5F7FA] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Upload size={18} />
                        Bulk import
                    </button>
                    <Link
                        href="/dashboard/workers/new"
                        className="flex items-center gap-2 bg-[#003087] hover:bg-[#003087]/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={18} />
                        Add Worker
                    </Link>
                </div>
            </div>

            {error && (
                <div className="bg-[#FEE2E2] border border-[#DC2626]/20 text-[#991B1B] px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Stats Summary */}
            <div className="grid sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium">Total Workers</p>
                    <p className="text-2xl font-medium text-[#0A1628] mt-1">{totalWorkers}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium">Compliant</p>
                    <p className="text-2xl font-medium text-[#166534] mt-1">
                        {workers.filter(w => (w.complianceScore || 0) >= 90).length}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium">Needs Review</p>
                    <p className="text-2xl font-medium text-[#92400E] mt-1">
                        {workers.filter(w => {
                            const score = w.complianceScore || 0;
                            return score >= 70 && score < 90;
                        }).length}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                    <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium">Action Required</p>
                    <p className="text-2xl font-medium text-[#991B1B] mt-1">
                        {workers.filter(w => (w.complianceScore || 0) < 70).length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-[#DDE3EE] p-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6E8C]" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, role or email..."
                            value={searchInputValue}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full bg-[#F5F7FA] border border-[#DDE3EE] text-[#0A1628] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all"
                        />
                    </div>
                    <select
                        value={selectedStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="bg-[#F5F7FA] border border-[#DDE3EE] text-[#0A1628] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all"
                    >
                        <option value="">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="SUSPENDED">Suspended</option>
                    </select>
                </div>
            </div>

            {/* Workers Table */}
            <div className="bg-white rounded-xl border border-[#DDE3EE] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#F5F7FA] border-b border-[#DDE3EE]">
                                <th className="px-6 py-4 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px]">Worker</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px]">Role</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px]">Status</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px]">Compliance</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#5B6E8C] uppercase tracking-[0.5px] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DDE3EE]">
                            {workers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-0">
                                        {searchInputValue || selectedStatus ? (
                                            <EmptyState
                                                icon={User}
                                                title="No workers match your filters"
                                                message="Try adjusting your search or status filter."
                                            />
                                        ) : (
                                            <EmptyState
                                                icon={User}
                                                title="No workers added yet"
                                                message="Add your healthcare staff to start tracking their compliance."
                                                action={
                                                    <Link href="/dashboard/workers/new" className="text-[#003087] hover:text-[#003087]/80 font-medium text-sm transition-colors">
                                                        Add your first worker
                                                    </Link>
                                                }
                                            />
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                workerRows
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingWorker && (
                <EditWorkerModal
                    worker={editingWorker}
                    onClose={() => setEditingWorker(null)}
                    onSuccess={() => { setEditingWorker(null); fetchWorkers(page); }}
                />
            )}

            <WorkerBulkUploadModal
                isOpen={showBulkImport}
                onClose={() => setShowBulkImport(false)}
                onSuccess={() => fetchWorkers(1, searchQuery, selectedStatus)}
            />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#DDE3EE]">
                    <div className="text-sm text-[#5B6E8C]">
                        Showing <span className="font-medium text-[#0A1628]">{workers.length}</span> of <span className="font-medium text-[#0A1628]">{totalWorkers}</span> workers
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#5B6E8C] bg-white hover:bg-[#F5F7FA] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-[#DDE3EE]"
                        >
                            <ChevronLeft size={16} />
                            Previous
                        </button>
                        <span className="text-sm text-[#5B6E8C] px-3">
                            Page <span className="font-medium text-[#0A1628]">{page}</span> of <span className="font-medium text-[#0A1628]">{totalPages}</span>
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#5B6E8C] bg-white hover:bg-[#F5F7FA] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-[#DDE3EE]"
                        >
                            Next
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
