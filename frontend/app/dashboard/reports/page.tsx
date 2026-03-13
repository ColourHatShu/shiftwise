/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { FileText, Clock, AlertTriangle, Download, Eye, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ReportsPage() {
    const { getToken } = useAuth();

    const [previewType, setPreviewType] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
    const [expiringDaysFilter, setExpiringDaysFilter] = useState(30);

    const CACHE: any = {};

    const fetchReportData = async (type: string, param?: number) => {
        setIsLoading(true);
        setPreviewData(null);
        setPreviewType(type);

        const cacheKey = `${type}-${param || ''}`;
        if (CACHE[cacheKey]) {
            setPreviewData(CACHE[cacheKey]);
            setIsLoading(false);
            return;
        }

        try {
            const token = await getToken();
            let endpoint = "";
            if (type === "COMPLIANCE") endpoint = "/api/reports/compliance";
            else if (type === "EXPIRING") endpoint = `/api/reports/expiring?days=${param || 30}`;
            else if (type === "NON_COMPLIANT") endpoint = "/api/reports/non-compliant";

            const res = await fetch(`${API_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to fetch report data");

            const data = await res.json();
            setPreviewData(data.data);
            CACHE[cacheKey] = data.data;

        } catch (error: any) {
            toast.error(error.message);
            setPreviewType(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPdf = async (type: string, param?: number) => {
        setIsGeneratingPdf(type);
        try {
            const token = await getToken();

            let endpoint = "";
            if (type === "COMPLIANCE") endpoint = "/api/reports/compliance";
            else if (type === "EXPIRING") endpoint = `/api/reports/expiring?days=${param || 30}`;
            else if (type === "NON_COMPLIANT") endpoint = "/api/reports/non-compliant";

            const dataRes = await fetch(`${API_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!dataRes.ok) throw new Error("Failed to gather report data for PDF");
            const { data } = await dataRes.json();

            const pdfRes = await fetch(`${API_URL}/api/reports/generate-pdf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/pdf",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    reportType: type,
                    reportData: data
                })
            });

            if (!pdfRes.ok) throw new Error("Failed to generate PDF");

            const blob = await pdfRes.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ShiftWise_${type}_Report.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("PDF Downloaded successfully!");

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsGeneratingPdf(null);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Generate Reports</h1>
                <p className="text-slate-400 mt-1">Export professional PDF intelligence mapping staff compliance limits and urgencies.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">

                {/* 1. Full Compliance Report */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col hover:border-blue-500/30 transition-colors group">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileText size={24} />
                    </div>
                    <h2 className="text-lg font-bold text-white">Full Compliance</h2>
                    <p className="text-sm text-slate-400 mt-2 mb-6 flex-1">
                        A master manifest logging every active worker against their overall file compliance metrics and document uploads.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchReportData('COMPLIANCE')}
                            className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Eye size={16} /> Preview
                        </button>
                        <button
                            onClick={() => handleDownloadPdf('COMPLIANCE')}
                            disabled={isGeneratingPdf === 'COMPLIANCE'}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isGeneratingPdf === 'COMPLIANCE' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            PDF
                        </button>
                    </div>
                </div>

                {/* 2. Expiring Documents */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col hover:border-amber-500/30 transition-colors group">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock size={24} />
                    </div>
                    <div className="flex justify-between items-start">
                        <h2 className="text-lg font-bold text-white">Expiring Files</h2>
                        <select
                            value={expiringDaysFilter}
                            onChange={(e) => setExpiringDaysFilter(Number(e.target.value))}
                            className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-2 py-1 text-slate-300 outline-none focus:border-amber-500/50"
                        >
                            <option value={30}>Next 30 Days</option>
                            <option value={60}>Next 60 Days</option>
                            <option value={90}>Next 90 Days</option>
                        </select>
                    </div>

                    <p className="text-sm text-slate-400 mt-2 mb-6 flex-1">
                        Filters strict timelines surfacing any documents crossing expiry thresholds grouped by critical urgencies.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchReportData('EXPIRING', expiringDaysFilter)}
                            className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Eye size={16} /> Preview
                        </button>
                        <button
                            onClick={() => handleDownloadPdf('EXPIRING', expiringDaysFilter)}
                            disabled={isGeneratingPdf === 'EXPIRING'}
                            className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isGeneratingPdf === 'EXPIRING' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            PDF
                        </button>
                    </div>
                </div>

                {/* 3. Non-Compliant Workers */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col hover:border-red-500/30 transition-colors group">
                    <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <AlertTriangle size={24} />
                    </div>
                    <h2 className="text-lg font-bold text-white">Non-Compliant</h2>
                    <p className="text-sm text-slate-400 mt-2 mb-6 flex-1">
                        Isolates workers completely locked from shifts due to either hard rejections, expired slots, or physically missing files.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchReportData('NON_COMPLIANT')}
                            className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Eye size={16} /> Preview
                        </button>
                        <button
                            onClick={() => handleDownloadPdf('NON_COMPLIANT')}
                            disabled={isGeneratingPdf === 'NON_COMPLIANT'}
                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isGeneratingPdf === 'NON_COMPLIANT' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            PDF
                        </button>
                    </div>
                </div>

            </div>

            {/* PREVIEW OVERLAY INTERFACE */}
            {previewType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">

                        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {previewType === 'COMPLIANCE' ? 'Full Compliance Report' :
                                        previewType === 'EXPIRING' ? `Expiring Documents (${expiringDaysFilter} Days)` :
                                            'Non-Compliant Workers'}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">Previewing live database layout before PDF distillation</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleDownloadPdf(previewType, expiringDaysFilter)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Download size={16} /> Generate PDF
                                </button>
                                <button onClick={() => setPreviewType(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-950">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                                    <Loader2 size={32} className="animate-spin text-blue-500" />
                                    <p>Compiling database streams...</p>
                                </div>
                            ) : previewData ? (

                                /* PREVIEW SINK ROUTING */
                                previewType === 'COMPLIANCE' ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Overall Compliance</p>
                                                <p className={`text-4xl font-bold ${previewData.metrics.compliancePercentage >= 90 ? 'text-green-500' : 'text-amber-500'}`}>
                                                    {previewData.metrics.compliancePercentage}%
                                                </p>
                                            </div>
                                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Active Staff</p>
                                                <p className="text-4xl font-bold text-white">{previewData.metrics.totalWorkers}</p>
                                            </div>
                                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Fully Compliant</p>
                                                <p className="text-4xl font-bold text-white">{previewData.metrics.compliantWorkers}</p>
                                            </div>
                                        </div>

                                        <div className="border border-slate-800 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-sm text-slate-300">
                                                <thead className="bg-slate-800 text-xs uppercase text-slate-400 font-semibold h-12">
                                                    <tr>
                                                        <th className="px-6 py-3">Worker Name</th>
                                                        <th className="px-6 py-3">Status</th>
                                                        <th className="px-6 py-3 text-right">Metrics</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {previewData.workers.map((w: any) => (
                                                        <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <p className="font-semibold text-white">{w.name}</p>
                                                                <p className="text-xs text-slate-500">{w.role}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${w.isCompliant ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                                    {w.isCompliant ? 'Compliant' : 'Non-Compliant'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right tabular-nums text-slate-400">
                                                                {w.documents.length} standard slots active
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : previewType === 'EXPIRING' ? (
                                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-sm text-slate-300">
                                            <thead className="bg-slate-800 text-xs uppercase text-slate-400 font-semibold h-12">
                                                <tr>
                                                    <th className="px-6 py-3">Urgency</th>
                                                    <th className="px-6 py-3">Worker / Role</th>
                                                    <th className="px-6 py-3">Document</th>
                                                    <th className="px-6 py-3">Expires In</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {previewData.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No expiring documents found in this range.</td></tr>
                                                ) : previewData.map((d: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${d.urgency === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/20' : d.urgency === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                                {d.urgency}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="font-semibold text-white">{d.workerName}</p>
                                                        </td>
                                                        <td className="px-6 py-4">{d.documentName}</td>
                                                        <td className="px-6 py-4 tabular-nums">
                                                            <strong className="text-white">{d.daysRemaining} days</strong>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-sm text-slate-300">
                                            <thead className="bg-slate-800 text-xs uppercase text-slate-400 font-semibold h-12">
                                                <tr>
                                                    <th className="px-6 py-3">Worker Name</th>
                                                    <th className="px-6 py-3">Missing Files</th>
                                                    <th className="px-6 py-3">Rejected / Expired Files</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {previewData.length === 0 ? (
                                                    <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Perfect—every single worker is currently compliant.</td></tr>
                                                ) : previewData.map((w: any) => (
                                                    <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="font-semibold text-white">{w.name}</p>
                                                            <p className="text-xs text-slate-500">{w.role}</p>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                                                            {w.issues.missingCount > 0 ? `${w.issues.missingCount} pending slots` : 'None'}
                                                        </td>
                                                        <td className="px-6 py-4 flex flex-col gap-1 text-xs">
                                                            {w.issues.expired.length > 0 && <span className="text-red-400 border border-red-500/20 bg-red-500/10 px-2 py-0.5 rounded w-fit">Expired: {w.issues.expired.join(', ')}</span>}
                                                            {w.issues.rejected.length > 0 && <span className="text-orange-400 border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 rounded w-fit">Rejected: {w.issues.rejected.join(', ')}</span>}
                                                            {w.issues.expired.length === 0 && w.issues.rejected.length === 0 && <span className="text-slate-500">None</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )

                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
