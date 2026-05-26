"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    Search,
    Download,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    Filter,
    ChevronDown,
    Clock
} from "lucide-react";
import WorkerDetailModal from "./WorkerDetailModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Worker {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle?: string;
    status: string;
    complianceScore: number;
    complianceStatus: 'red' | 'yellow' | 'green';
    completedDocs: number;
    totalRequiredDocs: number;
    lastUpdated: string;
    hasExpiringDocs: boolean;
}

interface Alert {
    type: string;
    message: string;
    severity: 'critical' | 'high' | 'medium';
    workerId: string;
    workerName: string;
}

interface AlertsSummary {
    expiringCount: number;
    expiredCount: number;
    nonCompliantCount: number;
    alerts: Alert[];
}

export default function ComplianceDashboard() {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [alerts, setAlerts] = useState<AlertsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<'red' | 'yellow' | 'green' | null>(null);
    const [sortBy, setSortBy] = useState<'name' | 'score' | 'updated'>('name');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalWorkers, setTotalWorkers] = useState(0);

    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [cacheAge, setCacheAge] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Fetch workers and alerts
    const fetchData = useCallback(async () => {
        if (!isLoaded || !isSignedIn) return;

        setLoading(true);
        try {
            const token = await getToken();
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch workers
            const workersRes = await fetch(
                `${API_URL}/api/agency/compliance/workers?page=${page}&status=${statusFilter || ''}&search=${search}&sortBy=${sortBy}`,
                { headers }
            );

            if (workersRes.ok) {
                const data = await workersRes.json();
                setWorkers(data.workers);
                setTotalPages(Math.ceil(data.total / 20));
                setTotalWorkers(data.total);
                setCacheAge(data.cacheAge || 0);
                setLastUpdated(new Date());
            }

            // Fetch alerts
            const alertsRes = await fetch(`${API_URL}/api/agency/compliance/alerts`, { headers });
            if (alertsRes.ok) {
                const alertData = await alertsRes.json();
                setAlerts(alertData.data);
            }
        } catch (err) {
            console.error("Failed to fetch compliance data:", err);
        } finally {
            setLoading(false);
        }
    }, [isLoaded, isSignedIn, getToken, page, statusFilter, search, sortBy]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Export handlers
    const handleExport = async (format: 'csv' | 'pdf') => {
        setExporting(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/agency/compliance/export`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ format })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                toast.error('Export failed. Please try again.');
            }
        } catch (err) {
            console.error('Export error:', err);
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    // Score color styling
    const getScoreColor = (score: number) => {
        if (score >= 80) return '#16A34A'; // green
        if (score >= 50) return '#EA580C'; // amber
        return '#DC2626'; // red
    };

    const getScoreBg = (status: 'red' | 'yellow' | 'green') => {
        const colors = {
            green: 'bg-[#DCFCE7]',
            yellow: 'bg-[#FEF3C7]',
            red: 'bg-[#FEE2E2]'
        };
        return colors[status];
    };

    const getScoreText = (status: 'red' | 'yellow' | 'green') => {
        const colors = {
            green: 'text-[#166534]',
            yellow: 'text-[#92400E]',
            red: 'text-[#991B1B]'
        };
        return colors[status];
    };

    const getStatusLabel = (status: 'red' | 'yellow' | 'green') => {
        const labels = {
            red: 'Non-Compliant',
            yellow: 'At Risk',
            green: 'Compliant'
        };
        return labels[status];
    };

    const handleAlertClick = (status: 'red' | 'yellow' | 'green') => {
        setStatusFilter(status);
        setPage(1);
    };

    const clearFilters = () => {
        setSearch("");
        setStatusFilter(null);
        setSortBy('name');
        setPage(1);
    };

    const handleOpenWorkerModal = async (workerId: string) => {
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/workers/${workerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const workerData = await res.json();
                // Also fetch documents
                const docsRes = await fetch(`${API_URL}/api/documents/worker/${workerId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                let documents = [];
                if (docsRes.ok) {
                    const docsData = await docsRes.json();
                    documents = docsData.data || [];
                }
                setSelectedWorker({
                    ...workerData.data,
                    documents,
                    complianceScore: workers.find(w => w.id === workerId)?.complianceScore || 0,
                    complianceStatus: workers.find(w => w.id === workerId)?.complianceStatus || 'red',
                    completedDocs: workers.find(w => w.id === workerId)?.completedDocs || 0,
                    totalRequiredDocs: workers.find(w => w.id === workerId)?.totalRequiredDocs || 0
                });
                setModalOpen(true);
            }
        } catch (err) {
            console.error('Failed to fetch worker details:', err);
        }
    };

    const handleApproveDocument = async (documentId: string) => {
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/agency/compliance/document/${documentId}/approve`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Document approved');
                fetchData(); // Refresh data
                if (selectedWorker) {
                    handleOpenWorkerModal(selectedWorker.id); // Refresh modal
                }
            }
        } catch (err) {
            console.error('Failed to approve document:', err);
            toast.error('Failed to approve document');
        }
    };

    const handleRejectDocument = async (documentId: string, reason: string) => {
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/agency/compliance/document/${documentId}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                toast.success('Document rejected');
                fetchData(); // Refresh data
                if (selectedWorker) {
                    handleOpenWorkerModal(selectedWorker.id); // Refresh modal
                }
            }
        } catch (err) {
            console.error('Failed to reject document:', err);
            toast.error('Failed to reject document');
        }
    };

    const handleDeactivateWorker = async () => {
        if (!selectedWorker) return;
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/agency/compliance/worker/${selectedWorker.id}/deactivate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Worker deactivated');
                setModalOpen(false);
                setSelectedWorker(null);
                fetchData(); // Refresh data
            }
        } catch (err) {
            console.error('Failed to deactivate worker:', err);
            toast.error('Failed to deactivate worker');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-medium text-[#0A1628]">Compliance Dashboard</h1>
                <p className="text-[#5B6E8C] mt-1">View all workers with live compliance scores and manage approvals</p>
            </div>

            {/* Active Alerts Section */}
            {alerts && (alerts.expiringCount > 0 || alerts.expiredCount > 0 || alerts.nonCompliantCount > 0) && (
                <div className="bg-white rounded-xl border border-[#DDE3EE] p-6">
                    <h2 className="text-lg font-medium text-[#0A1628] mb-4">Active Alerts</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {alerts.expiredCount > 0 && (
                            <button
                                onClick={() => handleAlertClick('red')}
                                className="p-4 rounded-lg border border-[#FEE2E2] bg-[#FEE2E2]/50 hover:bg-[#FEE2E2] transition-colors text-left"
                            >
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-[#991B1B] flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-medium text-[#991B1B]">Documents Expired</p>
                                        <p className="text-lg font-medium text-[#991B1B]">{alerts.expiredCount}</p>
                                        <p className="text-xs text-[#991B1B] opacity-75">Immediate action required</p>
                                    </div>
                                </div>
                            </button>
                        )}
                        {alerts.expiringCount > 0 && (
                            <button
                                onClick={() => handleAlertClick('yellow')}
                                className="p-4 rounded-lg border border-[#FEF3C7] bg-[#FEF3C7]/50 hover:bg-[#FEF3C7] transition-colors text-left"
                            >
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-[#92400E] flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-medium text-[#92400E]">Expiring Soon</p>
                                        <p className="text-lg font-medium text-[#92400E]">{alerts.expiringCount}</p>
                                        <p className="text-xs text-[#92400E] opacity-75">Within 3 days</p>
                                    </div>
                                </div>
                            </button>
                        )}
                        {alerts.nonCompliantCount > 0 && (
                            <button
                                onClick={() => handleAlertClick('red')}
                                className="p-4 rounded-lg border border-[#FEE2E2] bg-[#FEE2E2]/50 hover:bg-[#FEE2E2] transition-colors text-left"
                            >
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-[#991B1B] flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-medium text-[#991B1B]">Non-Compliant</p>
                                        <p className="text-lg font-medium text-[#991B1B]">{alerts.nonCompliantCount}</p>
                                        <p className="text-xs text-[#991B1B] opacity-75">Missing documents</p>
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Filters & Export Section */}
            <div className="bg-white rounded-xl border border-[#DDE3EE] p-6 space-y-4">
                <div className="flex flex-col gap-4">
                    {/* Search Bar */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6E8C]" />
                        <input
                            type="text"
                            placeholder="Search by name, email..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-[#DDE3EE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087]/30 focus:border-[#003087]"
                        />
                    </div>

                    {/* Filter Row */}
                    <div className="flex flex-wrap gap-3 items-center">
                        {/* Status Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                className="flex items-center gap-2 px-4 py-2 border border-[#DDE3EE] rounded-lg hover:bg-[#F5F7FA] transition-colors text-sm font-medium text-[#0A1628]"
                            >
                                <Filter className="w-4 h-4" />
                                Status: {statusFilter ? getStatusLabel(statusFilter) : 'All'}
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showFilterMenu && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-[#DDE3EE] rounded-lg shadow-lg z-10 min-w-[200px]">
                                    <button
                                        onClick={() => {
                                            setStatusFilter(null);
                                            setShowFilterMenu(false);
                                            setPage(1);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#F5F7FA] text-sm"
                                    >
                                        All Workers
                                    </button>
                                    <button
                                        onClick={() => {
                                            setStatusFilter('red');
                                            setShowFilterMenu(false);
                                            setPage(1);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#F5F7FA] text-sm"
                                    >
                                        🔴 Non-Compliant (0-49%)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setStatusFilter('yellow');
                                            setShowFilterMenu(false);
                                            setPage(1);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#F5F7FA] text-sm"
                                    >
                                        🟡 At Risk (50-79%)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setStatusFilter('green');
                                            setShowFilterMenu(false);
                                            setPage(1);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#F5F7FA] text-sm"
                                    >
                                        🟢 Compliant (80%+)
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSortMenu(!showSortMenu)}
                                className="flex items-center gap-2 px-4 py-2 border border-[#DDE3EE] rounded-lg hover:bg-[#F5F7FA] transition-colors text-sm font-medium text-[#0A1628]"
                            >
                                Sort: {sortBy === 'name' ? 'Name' : sortBy === 'score' ? 'Score' : 'Updated'}
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showSortMenu && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-[#DDE3EE] rounded-lg shadow-lg z-10 min-w-[150px]">
                                    <button
                                        onClick={() => {
                                            setSortBy('name');
                                            setShowSortMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#F5F7FA] text-sm"
                                    >
                                        Name (A-Z)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSortBy('score');
                                            setShowSortMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#F5F7FA] text-sm"
                                    >
                                        Score (High-Low)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSortBy('updated');
                                            setShowSortMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-[#F5F7FA] text-sm"
                                    >
                                        Last Updated
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Clear Filters */}
                        {(search || statusFilter || sortBy !== 'name') && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-[#003087] hover:text-[#003087]/80 font-medium"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>

                    {/* Export Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-[#003087] text-white rounded-lg hover:bg-[#003087]/90 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                        <button
                            onClick={() => handleExport('pdf')}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-[#003087] text-white rounded-lg hover:bg-[#003087]/90 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            {exporting ? 'Exporting...' : 'Export PDF'}
                        </button>
                    </div>
                </div>

                {/* Cache Info */}
                {lastUpdated && (
                    <div className="flex items-center gap-2 text-xs text-[#5B6E8C]">
                        <Clock className="w-3 h-3" />
                        Data last updated {Math.round(cacheAge / 1000)} seconds ago
                    </div>
                )}
            </div>

            {/* Workers Table */}
            <div className="bg-white rounded-xl border border-[#DDE3EE] overflow-hidden">
                {loading ? (
                    <div className="p-6 text-center text-[#5B6E8C]">Loading workers...</div>
                ) : workers.length === 0 ? (
                    <div className="p-6 text-center text-[#5B6E8C]">No workers found</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[#DDE3EE] bg-[#F5F7FA]">
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[#5B6E8C] uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[#5B6E8C] uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[#5B6E8C] uppercase tracking-wider">Job Title</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-[#5B6E8C] uppercase tracking-wider">Compliance Score</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-[#5B6E8C] uppercase tracking-wider">Required Docs</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-[#5B6E8C] uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-[#5B6E8C] uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#DDE3EE]">
                                    {workers.map((worker) => (
                                        <tr key={worker.id} className="hover:bg-[#F5F7FA] transition-colors">
                                            <td className="px-6 py-4 text-sm text-[#0A1628] font-medium">
                                                {worker.firstName} {worker.lastName}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-[#5B6E8C]">{worker.email}</td>
                                            <td className="px-6 py-4 text-sm text-[#5B6E8C]">{worker.jobTitle || '-'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className={`inline-block px-3 py-1 rounded-full font-medium text-sm ${getScoreBg(worker.complianceStatus)} ${getScoreText(worker.complianceStatus)}`}>
                                                    {worker.complianceScore}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-[#5B6E8C]">
                                                {worker.completedDocs}/{worker.totalRequiredDocs}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {worker.hasExpiringDocs && (
                                                    <span className="inline-block px-2 py-1 bg-[#FEF3C7] text-[#92400E] rounded text-xs font-medium">
                                                        ⚠️ Expiring
                                                    </span>
                                                )}
                                                {!worker.hasExpiringDocs && (
                                                    <span className="text-[#5B6E8C] text-xs">OK</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleOpenWorkerModal(worker.id)}
                                                    className="text-[#003087] hover:text-[#003087]/80 font-medium text-sm"
                                                >
                                                    Review
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-[#DDE3EE] flex items-center justify-between">
                            <p className="text-sm text-[#5B6E8C]">
                                Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, totalWorkers)} of {totalWorkers} workers
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 border border-[#DDE3EE] rounded-lg hover:bg-[#F5F7FA] disabled:opacity-50 text-sm font-medium"
                                >
                                    Previous
                                </button>
                                <div className="flex items-center gap-2">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                                p === page
                                                    ? 'bg-[#003087] text-white'
                                                    : 'border border-[#DDE3EE] hover:bg-[#F5F7FA]'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 border border-[#DDE3EE] rounded-lg hover:bg-[#F5F7FA] disabled:opacity-50 text-sm font-medium"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Worker Detail Modal */}
            <WorkerDetailModal
                isOpen={modalOpen}
                worker={selectedWorker}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedWorker(null);
                }}
                onApprove={handleApproveDocument}
                onReject={handleRejectDocument}
                onDeactivate={handleDeactivateWorker}
            />
        </div>
    );
}
