"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";

interface AuditLogEntry {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    userId?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    ipAddress?: string;
    user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    };
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export default function AuditLogPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<PaginationData | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
    const [showDetailPopover, setShowDetailPopover] = useState(false);

    // Filters
    const [filterAction, setFilterAction] = useState("");
    const [filterEntity, setFilterEntity] = useState("");
    const [filterUserId, setFilterUserId] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const fetchAuditLog = async (pageNum: number = 1) => {
        if (!isLoaded || !isSignedIn) return;
        try {
            setIsLoading(true);
            const token = await getToken();

            // Build query params
            const params = new URLSearchParams();
            params.append("page", pageNum.toString());
            params.append("limit", "50");
            if (filterAction) params.append("action", filterAction);
            if (filterEntity) params.append("entity", filterEntity);
            if (filterUserId) params.append("userId", filterUserId);
            if (filterDateFrom) params.append("dateFrom", filterDateFrom);
            if (filterDateTo) params.append("dateTo", filterDateTo);

            const response = await fetch(`${API_URL}/api/audit-log?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                if (response.status === 403) {
                    setError("You do not have permission to view the audit log");
                } else {
                    setError("Failed to fetch audit log");
                }
                return;
            }

            const data = await response.json();
            setEntries(data.data || []);
            setPagination(data.pagination);
        } catch (err: any) {
            setError(err.message || "An error occurred");
            console.error("Error fetching audit log:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAuditLog(page);
    }, [isLoaded, isSignedIn, getToken, API_URL, page]);

    const handleFilterChange = () => {
        setPage(1); // Reset to first page when filters change
    };

    const handleApplyFilters = () => {
        handleFilterChange();
        fetchAuditLog(1);
    };

    const handleClearFilters = () => {
        setFilterAction("");
        setFilterEntity("");
        setFilterUserId("");
        setFilterDateFrom("");
        setFilterDateTo("");
        setPage(1);
        fetchAuditLog(1);
    };

    const getActionBadgeColor = (action: string): string => {
        if (action.includes("verify")) return "bg-blue-50 text-blue-700";
        if (action.includes("create")) return "bg-green-50 text-green-700";
        if (action.includes("update")) return "bg-amber-50 text-amber-700";
        if (action.includes("delete")) return "bg-red-50 text-red-700";
        if (action.includes("alert")) return "bg-purple-50 text-purple-700";
        return "bg-gray-50 text-gray-700";
    };

    const renderMetadata = (metadata: Record<string, any> | undefined) => {
        if (!metadata || Object.keys(metadata).length === 0) {
            return <p className="text-gray-500 text-sm">No additional metadata</p>;
        }

        return (
            <div className="space-y-2">
                {Object.entries(metadata).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                        <span className="font-semibold text-gray-700 min-w-32">{key}:</span>
                        <span className="text-gray-600 break-words">
                            {typeof value === "object"
                                ? JSON.stringify(value, null, 2)
                                : String(value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Log</h1>
                <p className="text-gray-600">
                    Track all actions taken within your agency for compliance and security purposes.
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Action Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Action
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., verify, create"
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Entity Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Entity
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., ComplianceDocument"
                            value={filterEntity}
                            onChange={(e) => setFilterEntity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* User ID Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            User ID
                        </label>
                        <input
                            type="text"
                            placeholder="User ID"
                            value={filterUserId}
                            onChange={(e) => setFilterUserId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Date From Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date From
                        </label>
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Date To Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date To
                        </label>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    >
                        Clear Filters
                    </button>
                    <button
                        onClick={handleApplyFilters}
                        className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>

            {/* Audit Log Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="text-center">
                            <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-600">Loading audit log...</p>
                        </div>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center p-12">
                        <p className="text-gray-500">No audit log entries found</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Action
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Entity
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Actor
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Timestamp
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Details
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer">
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(
                                                        entry.action
                                                    )}`}
                                                >
                                                    {entry.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {entry.entity}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {entry.user
                                                    ? `${entry.user.firstName} ${entry.user.lastName}`
                                                    : entry.userId || "System"}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {format(new Date(entry.createdAt), "MMM dd, yyyy HH:mm:ss")}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <button
                                                    onClick={() => {
                                                        setSelectedEntry(entry);
                                                        setShowDetailPopover(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                                <div className="text-sm text-gray-600">
                                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                                    {pagination.total} entries
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        disabled={pagination.page === 1}
                                        onClick={() => setPage(pagination.page - 1)}
                                        className="flex items-center gap-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-700">
                                            Page {pagination.page} of {pagination.totalPages}
                                        </span>
                                    </div>
                                    <button
                                        disabled={pagination.page === pagination.totalPages}
                                        onClick={() => setPage(pagination.page + 1)}
                                        className="flex items-center gap-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Detail Popover */}
            {showDetailPopover && selectedEntry && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Audit Entry Details</h3>
                            <button
                                onClick={() => setShowDetailPopover(false)}
                                className="text-gray-500 hover:text-gray-700"
                                aria-label="Close dialog"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Basic Information</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-700 min-w-24">Action:</span>
                                        <span className="text-gray-600">{selectedEntry.action}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-700 min-w-24">Entity:</span>
                                        <span className="text-gray-600">{selectedEntry.entity}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-700 min-w-24">Entity ID:</span>
                                        <span className="text-gray-600 font-mono text-xs">{selectedEntry.entityId}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-semibold text-gray-700 min-w-24">Timestamp:</span>
                                        <span className="text-gray-600">
                                            {format(new Date(selectedEntry.createdAt), "PPpp")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {selectedEntry.user && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Actor</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex gap-2">
                                            <span className="font-semibold text-gray-700 min-w-24">Name:</span>
                                            <span className="text-gray-600">
                                                {selectedEntry.user.firstName} {selectedEntry.user.lastName}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="font-semibold text-gray-700 min-w-24">Email:</span>
                                            <span className="text-gray-600">{selectedEntry.user.email}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedEntry.ipAddress && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Network Info</h4>
                                    <div className="text-sm">
                                        <div className="flex gap-2">
                                            <span className="font-semibold text-gray-700 min-w-24">IP Address:</span>
                                            <span className="text-gray-600 font-mono">{selectedEntry.ipAddress}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Metadata</h4>
                                <div className="bg-gray-50 rounded p-3 text-sm font-mono overflow-x-auto max-h-48 overflow-y-auto">
                                    {renderMetadata(selectedEntry.metadata)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
