/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { FileText, Clock, AlertTriangle, Download, Eye, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Module-scope cache — previously declared inside the component which meant it
// was re-instantiated on every render and never actually cached anything.
const CACHE: Record<string, any> = {};

export default function ReportsPage() {
    const { getToken } = useAuth();

    const [previewType, setPreviewType] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
    const [expiringDaysFilter, setExpiringDaysFilter] = useState(30);

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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-medium text-[#0A1628]">Generate Reports</h1>
                <p className="text-[#5B6E8C] mt-1">Export professional PDF intelligence mapping staff compliance limits and urgencies.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">

                {/* 1. Full Compliance Report */}
                <div className="bg-white border border-[#DDE3EE] rounded-xl p-6 flex flex-col hover:border-[#003087]/30 transition-colors group">
                    <div className="h-12 w-12 rounded-lg bg-[#E6EDF8] text-[#003087] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileText size={24} />
                    </div>
                    <h2 className="text-lg font-medium text-[#0A1628]">Full Compliance</h2>
                    <p className="text-sm text-[#5B6E8C] mt-2 mb-6 flex-1">
                        A master manifest logging every active worker against their overall file compliance metrics and document uploads.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchReportData('COMPLIANCE')}
                            className="flex-1 px-4 py-2.5 bg-white hover:bg-[#F5F7FA] text-[#5B6E8C] rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-[#DDE3EE]"
                        >
                            <Eye size={16} /> Preview
                        </button>
                        <button
                            onClick={() => handleDownloadPdf('COMPLIANCE')}
                            disabled={isGeneratingPdf === 'COMPLIANCE'}
                            className="flex-1 px-4 py-2.5 bg-[#003087] hover:bg-[#003087]/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isGeneratingPdf === 'COMPLIANCE' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            PDF
                        </button>
                    </div>
                </div>

                {/* 2. Expiring Documents */}
                <div className="bg-white border border-[#DDE3EE] rounded-xl p-6 flex flex-col hover:border-[#D97706]/30 transition-colors group">
                    <div className="h-12 w-12 rounded-lg bg-[#FEF3C7] text-[#92400E] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock size={24} />
                    </div>
                    <div className="flex justify-between items-start">
                        <h2 className="text-lg font-medium text-[#0A1628]">Expiring Files</h2>
                        <select
                            value={expiringDaysFilter}
                            onChange={(e) => setExpiringDaysFilter(Number(e.target.value))}
                            className="bg-[#F5F7FA] border border-[#DDE3EE] rounded-lg text-xs px-2 py-1 text-[#5B6E8C] outline-none focus:border-[#D97706]"
                        >
                            <option value={30}>Next 30 Days</option>
                            <option value={60}>Next 60 Days</option>
                            <option value={90}>Next 90 Days</option>
                        </select>
                    </div>

                    <p className="text-sm text-[#5B6E8C] mt-2 mb-6 flex-1">
                        Filters strict timelines surfacing any documents crossing expiry thresholds grouped by critical urgencies.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchReportData('EXPIRING', expiringDaysFilter)}
                            className="flex-1 px-4 py-2.5 bg-white hover:bg-[#F5F7FA] text-[#5B6E8C] rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-[#DDE3EE]"
                        >
                            <Eye size={16} /> Preview
                        </button>
                        <button
                            onClick={() => handleDownloadPdf('EXPIRING', expiringDaysFilter)}
                            disabled={isGeneratingPdf === 'EXPIRING'}
                            className="flex-1 px-4 py-2.5 bg-[#D97706] hover:bg-[#D97706]/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isGeneratingPdf === 'EXPIRING' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            PDF
                        </button>
                    </div>
                </div>

                {/* 3. Non-Compliant Workers */}
                <div className="bg-white border border-[#DDE3EE] rounded-xl p-6 flex flex-col hover:border-[#DC2626]/30 transition-colors group">
                    <div className="h-12 w-12 rounded-lg bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <AlertTriangle size={24} />
                    </div>
                    <h2 className="text-lg font-medium text-[#0A1628]">Non-Compliant</h2>
                    <p className="text-sm text-[#5B6E8C] mt-2 mb-6 flex-1">
                        Isolates workers completely locked from shifts due to either hard rejections, expired slots, or physically missing files.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchReportData('NON_COMPLIANT')}
                            className="flex-1 px-4 py-2.5 bg-white hover:bg-[#F5F7FA] text-[#5B6E8C] rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-[#DDE3EE]"
                        >
                            <Eye size={16} /> Preview
                        </button>
                        <button
                            onClick={() => handleDownloadPdf('NON_COMPLIANT')}
                            disabled={isGeneratingPdf === 'NON_COMPLIANT'}
                            className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#DC2626]/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
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
                    <div className="bg-white border border-[#DDE3EE] shadow-2xl rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">

                        <div className="flex items-center justify-between p-6 border-b border-[#DDE3EE] bg-white">
                            <div>
                                <h2 className="text-xl font-medium text-[#0A1628]">
                                    {previewType === 'COMPLIANCE' ? 'Full Compliance Report' :
                                        previewType === 'EXPIRING' ? `Expiring Documents (${expiringDaysFilter} Days)` :
                                            'Non-Compliant Workers'}
                                </h2>
                                <p className="text-sm text-[#5B6E8C] mt-1">Previewing live database layout before PDF distillation</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleDownloadPdf(previewType, expiringDaysFilter)}
                                    className="px-4 py-2 bg-[#003087] hover:bg-[#003087]/90 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Download size={16} /> Generate PDF
                                </button>
                                <button onClick={() => setPreviewType(null)} aria-label="Close preview" className="p-2 text-[#5B6E8C] hover:text-[#0A1628] hover:bg-[#F5F7FA] rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#F5F7FA]">
                            {isLoading ? (
                                <div className="space-y-6" role="status" aria-label="Compiling report">
                                    {/* Metric cards */}
                                    <div className="grid grid-cols-3 gap-6">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="bg-white border border-[#DDE3EE] rounded-xl p-5 space-y-3">
                                                <Skeleton className="h-3 w-28" />
                                                <Skeleton className="h-9 w-20" />
                                            </div>
                                        ))}
                                    </div>
                                    {/* Rows */}
                                    <div className="bg-white border border-[#DDE3EE] rounded-xl p-5 space-y-3">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-4">
                                                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                                                <Skeleton className="h-4 flex-1" />
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                        ))}
                                    </div>
                                    <span className="sr-only">Compiling report…</span>
                                </div>
                            ) : previewData ? (

                                /* PREVIEW SINK ROUTING */
                                previewType === 'COMPLIANCE' ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="bg-white border border-[#DDE3EE] rounded-xl p-5">
                                                <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium mb-1">Overall Compliance</p>
                                                <p className={`text-4xl font-medium ${previewData.metrics.compliancePercentage >= 90 ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
                                                    {previewData.metrics.compliancePercentage}%
                                                </p>
                                            </div>
                                            <div className="bg-white border border-[#DDE3EE] rounded-xl p-5">
                                                <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium mb-1">Total Active Staff</p>
                                                <p className="text-4xl font-medium text-[#0A1628]">{previewData.metrics.totalWorkers}</p>
                                            </div>
                                            <div className="bg-white border border-[#DDE3EE] rounded-xl p-5">
                                                <p className="text-[11px] text-[#5B6E8C] uppercase tracking-[0.5px] font-medium mb-1">Fully Compliant</p>
                                                <p className="text-4xl font-medium text-[#0A1628]">{previewData.metrics.compliantWorkers}</p>
                                            </div>
                                        </div>

                                        <div className="border border-[#DDE3EE] rounded-xl overflow-hidden bg-white">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-[#F5F7FA] text-[11px] uppercase text-[#5B6E8C] font-medium h-12">
                                                    <tr>
                                                        <th className="px-6 py-3">Worker Name</th>
                                                        <th className="px-6 py-3">Status</th>
                                                        <th className="px-6 py-3 text-right">Metrics</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#DDE3EE]">
                                                    {previewData.workers.map((w: any) => (
                                                        <tr key={w.id} className="hover:bg-[#F5F7FA] transition-colors">
                                                            <td className="px-6 py-4">
                                                                <p className="font-medium text-[#0A1628]">{w.name}</p>
                                                                <p className="text-xs text-[#5B6E8C]">{w.role}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${w.isCompliant ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                                                                    {w.isCompliant ? 'Compliant' : 'Non-Compliant'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right tabular-nums text-[#5B6E8C]">
                                                                {w.documents.length} standard slots active
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : previewType === 'EXPIRING' ? (
                                    <div className="border border-[#DDE3EE] rounded-xl overflow-hidden bg-white">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-[#F5F7FA] text-[11px] uppercase text-[#5B6E8C] font-medium h-12">
                                                <tr>
                                                    <th className="px-6 py-3">Urgency</th>
                                                    <th className="px-6 py-3">Worker / Role</th>
                                                    <th className="px-6 py-3">Document</th>
                                                    <th className="px-6 py-3">Expires In</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#DDE3EE]">
                                                {previewData.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-[#5B6E8C]">No expiring documents found in this range.</td></tr>
                                                ) : previewData.map((d: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-[#F5F7FA] transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${d.urgency === 'CRITICAL' ? 'bg-[#FEE2E2] text-[#991B1B]' : d.urgency === 'HIGH' ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#DCFCE7] text-[#166534]'}`}>
                                                                {d.urgency}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="font-medium text-[#0A1628]">{d.workerName}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-[#5B6E8C]">{d.documentName}</td>
                                                        <td className="px-6 py-4 tabular-nums">
                                                            <strong className="text-[#0A1628]">{d.daysRemaining} days</strong>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="border border-[#DDE3EE] rounded-xl overflow-hidden bg-white">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-[#F5F7FA] text-[11px] uppercase text-[#5B6E8C] font-medium h-12">
                                                <tr>
                                                    <th className="px-6 py-3">Worker Name</th>
                                                    <th className="px-6 py-3">Missing Files</th>
                                                    <th className="px-6 py-3">Rejected / Expired Files</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#DDE3EE]">
                                                {previewData.length === 0 ? (
                                                    <tr><td colSpan={3} className="px-6 py-8 text-center text-[#5B6E8C]">Perfect—every single worker is currently compliant.</td></tr>
                                                ) : previewData.map((w: any) => (
                                                    <tr key={w.id} className="hover:bg-[#F5F7FA] transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="font-medium text-[#0A1628]">{w.name}</p>
                                                            <p className="text-xs text-[#5B6E8C]">{w.role}</p>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-xs text-[#5B6E8C]">
                                                            {w.issues.missingCount > 0 ? `${w.issues.missingCount} pending slots` : 'None'}
                                                        </td>
                                                        <td className="px-6 py-4 flex flex-col gap-1 text-xs">
                                                            {w.issues.expired.length > 0 && <span className="text-[#991B1B] bg-[#FEE2E2] px-2 py-0.5 rounded w-fit">Expired: {w.issues.expired.join(', ')}</span>}
                                                            {w.issues.rejected.length > 0 && <span className="text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded w-fit">Rejected: {w.issues.rejected.join(', ')}</span>}
                                                            {w.issues.expired.length === 0 && w.issues.rejected.length === 0 && <span className="text-[#5B6E8C]">None</span>}
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
