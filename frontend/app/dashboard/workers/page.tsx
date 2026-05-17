"use client";

import { useEffect, useState } from "react";
import React from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, User, Search, Eye, Edit, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import EditWorkerModal from './components/EditWorkerModal';

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

export default function WorkersPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalWorkers, setTotalWorkers] = useState(0);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Debounce for search input
    const [searchInputValue, setSearchInputValue] = useState("");
    const searchTimeoutRef = React.useRef<NodeJS.Timeout>();

    const fetchWorkers = async (pageNum: number = 1, search: string = "", status: string = "") => {
        if (!isLoaded || !isSignedIn) return;
        try {
            setIsLoading(true);
            const token = await getToken();

            // Build query params
            const params = new URLSearchParams();
            params.append("page", pageNum.toString());
            params.append("limit", "20");
            if (search) params.append("search", search);
            if (status) params.append("status", status);

            const response = await fetch(`${API_URL}/api/workers?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error("Failed to fetch workers");
            const data = await response.json();
            // Add mock compliance data for demonstration
            const workersWithCompliance = (data.data || []).map((w: Worker) => ({
                ...w,
                complianceScore: Math.floor(Math.random() * 40) + 60, // Random score 60-100
                documentsUploaded: Math.floor(Math.random() * 5) + 3,
                documentsTotal: 8
            }));
            setWorkers(workersWithCompliance);
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
    }, [isLoaded, isSignedIn, getToken, API_URL]);

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

    // RAG Status Badge
    const getRAGStatus = (score: number) => {
        if (score >= 90) return { color: 'green', label: 'Compliant' };
        if (score >= 70) return { color: 'amber', label: 'Review' };
        return { color: 'red', label: 'Action' };
    };

    // Status Badge for worker state
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAF3DE] text-[#3B6D11]">Active</span>;
            case "INACTIVE":
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">Inactive</span>;
            case "SUSPENDED":
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FAEEDA] text-[#854F0B]">Suspended</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FCEBEB] text-[#A32D2D]">Unknown</span>;
        }
    };

    if (!isLoaded || isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F2647]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-medium text-[#1A1A2E]">Workers</h1>
                    <p className="text-[#6B7280] mt-1">Manage your agency's healthcare staff</p>
                </div>
                <Link
                    href="/dashboard/workers/new"
                    className="flex items-center gap-2 bg-[#0F2647] hover:bg-[#0F2647]/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={18} />
                    Add Worker
                </Link>
            </div>

            {error && (
                <div className="bg-[#FCEBEB] border border-[#E24B4A]/20 text-[#A32D2D] px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Stats Summary */}
            <div className="grid sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-[0.5px] font-medium">Total Workers</p>
                    <p className="text-2xl font-medium text-[#1A1A2E] mt-1">{totalWorkers}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-[0.5px] font-medium">Compliant</p>
                    <p className="text-2xl font-medium text-[#3B6D11] mt-1">
                        {workers.filter(w => (w.complianceScore || 0) >= 90).length}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-[0.5px] font-medium">Needs Review</p>
                    <p className="text-2xl font-medium text-[#854F0B] mt-1">
                        {workers.filter(w => {
                            const score = w.complianceScore || 0;
                            return score >= 70 && score < 90;
                        }).length}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-[0.5px] font-medium">Action Required</p>
                    <p className="text-2xl font-medium text-[#A32D2D] mt-1">
                        {workers.filter(w => (w.complianceScore || 0) < 70).length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, role or email..."
                            value={searchInputValue}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                        />
                    </div>
                    <select
                        value={selectedStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                    >
                        <option value="">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="SUSPENDED">Suspended</option>
                    </select>
                </div>
            </div>

            {/* Workers Table */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#F8F9FB] border-b border-[#E5E7EB]">
                                <th className="px-6 py-4 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px]">Worker</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px]">Role</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px]">Status</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px]">Compliance</th>
                                <th className="px-6 py-4 text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.5px] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                            {workers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="bg-[#F8F9FB] p-3 rounded-lg">
                                                <User size={24} className="text-[#6B7280]" />
                                            </div>
                                            {searchInputValue || selectedStatus ? (
                                                <p className="text-[#6B7280]">No workers match your filters</p>
                                            ) : (
                                                <>
                                                    <p className="text-[#6B7280]">No workers added yet.</p>
                                                    <Link href="/dashboard/workers/new" className="text-[#0F2647] hover:text-[#0F2647]/80 font-medium text-sm transition-colors">
                                                        Add your first worker
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                workers.map((worker) => {
                                    const rag = getRAGStatus(worker.complianceScore || 0);
                                    const ragColors = {
                                        green: { dot: "bg-[#1D9E75]", bar: "bg-[#1D9E75]", text: "text-[#3B6D11]" },
                                        amber: { dot: "bg-[#EF9F27]", bar: "bg-[#EF9F27]", text: "text-[#854F0B]" },
                                        red: { dot: "bg-[#E24B4A]", bar: "bg-[#E24B4A]", text: "text-[#A32D2D]" },
                                    };
                                    const colors = ragColors[rag.color as keyof typeof ragColors];
                                    return (
                                        <tr
                                            key={worker.id}
                                            className="group hover:bg-[#F8F9FB] transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-[#EEF2FF] text-[#0F2647] flex items-center justify-center font-medium text-sm">
                                                        {worker.firstName.charAt(0)}{worker.lastName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-[#1A1A2E]">{worker.firstName} {worker.lastName}</p>
                                                        <p className="text-xs text-[#6B7280]">{worker.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-[#1A1A2E]">{worker.jobTitle || "Unassigned"}</p>
                                                <p className="text-xs text-[#6B7280]">
                                                    {worker.startDate ? format(new Date(worker.startDate), "MMM yyyy") : "N/A"}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">{getStatusBadge(worker.status)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {/* Compliance Progress Bar */}
                                                    <div className="flex-1 max-w-[120px]">
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="text-[#6B7280]">{worker.complianceScore}%</span>
                                                            <span className={`font-medium ${colors.text}`}>{rag.label}</span>
                                                        </div>
                                                        <div className="w-full bg-[#F8F9FB] rounded-full h-1.5">
                                                            <div 
                                                                className={`h-1.5 rounded-full ${colors.bar}`}
                                                                style={{ width: `${worker.complianceScore}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    {/* RAG Indicator */}
                                                    <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                                </div>
                                                <p className="text-xs text-[#6B7280] mt-1">
                                                    {worker.documentsUploaded} of {worker.documentsTotal} documents
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingWorker(worker)}
                                                        className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#0F2647] font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-[#F8F9FB] transition-all"
                                                    >
                                                        <Edit size={14} />
                                                        Edit
                                                    </button>
                                                    <Link
                                                        href={`/dashboard/workers/${worker.id}`}
                                                        className="inline-flex items-center gap-1.5 text-[#0F2647] hover:text-[#0F2647]/80 font-medium text-sm px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#EEF2FF]/80 transition-all"
                                                    >
                                                        <Eye size={14} />
                                                        View
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
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

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#E5E7EB]">
                    <div className="text-sm text-[#6B7280]">
                        Showing <span className="font-medium text-[#1A1A2E]">{workers.length}</span> of <span className="font-medium text-[#1A1A2E]">{totalWorkers}</span> workers
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#6B7280] bg-white hover:bg-[#F8F9FB] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-[#E5E7EB]"
                        >
                            <ChevronLeft size={16} />
                            Previous
                        </button>
                        <span className="text-sm text-[#6B7280] px-3">
                            Page <span className="font-medium text-[#1A1A2E]">{page}</span> of <span className="font-medium text-[#1A1A2E]">{totalPages}</span>
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#6B7280] bg-white hover:bg-[#F8F9FB] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-[#E5E7EB]"
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
