"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, User, Search, Eye } from "lucide-react";

export default function WorkersPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [workers, setWorkers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        const fetchWorkers = async () => {
            if (!isLoaded || !isSignedIn) return;
            try {
                const token = await getToken();
                const response = await fetch(`${API_URL}/api/workers`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error("Failed to fetch workers");
                const data = await response.json();
                setWorkers(data.data || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchWorkers();
    }, [isLoaded, isSignedIn, getToken, API_URL]);

    // ── Client-side search filter ──────────────────────────────────────────────
    const filteredWorkers = workers.filter((w) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
            `${w.firstName} ${w.lastName}`.toLowerCase().includes(q) ||
            (w.jobTitle ?? "").toLowerCase().includes(q) ||
            w.email.toLowerCase().includes(q)
        );
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium border border-green-500/20">Compliant</span>;
            case "INACTIVE":
                return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-medium border border-amber-500/20">Expiring Soon</span>;
            default:
                return <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-medium border border-red-500/20">Non-Compliant</span>;
        }
    };

    if (!isLoaded || isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Workers</h1>
                    <p className="text-slate-400 mt-1">Manage your agency's healthcare staff</p>
                </div>
                <Link
                    href="/dashboard/workers/new"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Plus size={18} />
                    Add Worker
                </Link>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, role or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-72"
                        />
                    </div>
                    <div className="text-sm text-slate-400 font-medium">
                        {searchQuery
                            ? `${filteredWorkers.length} of ${workers.length} workers`
                            : `Total: ${workers.length}`}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Worker Name</th>
                                <th className="px-6 py-4 font-medium">Role</th>
                                <th className="px-6 py-4 font-medium">Contact</th>
                                <th className="px-6 py-4 font-medium">Start Date</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-sm">
                            {filteredWorkers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="bg-slate-800 p-3 rounded-full">
                                                <User size={24} className="text-slate-500" />
                                            </div>
                                            {searchQuery ? (
                                                <p>No workers match <span className="text-white font-medium">"{searchQuery}"</span></p>
                                            ) : (
                                                <>
                                                    <p>No workers added yet.</p>
                                                    <Link href="/dashboard/workers/new" className="text-blue-400 hover:text-blue-300 transition-colors">
                                                        Add your first worker
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredWorkers.map((worker: any) => (
                                    <tr key={worker.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold border border-blue-500/20">
                                                    {worker.firstName.charAt(0)}{worker.lastName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white">{worker.firstName} {worker.lastName}</p>
                                                    <p className="text-xs text-slate-500">{worker.id.slice(-6).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">{worker.jobTitle || "Unassigned"}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-300">{worker.email}</p>
                                            <p className="text-slate-500 text-xs mt-0.5">{worker.phone || "No phone"}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {worker.startDate ? format(new Date(worker.startDate), "MMM dd, yyyy") : "N/A"}
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(worker.status)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/dashboard/workers/${worker.id}`}
                                                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium text-xs bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 border border-blue-500/20"
                                            >
                                                <Eye size={14} />
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
