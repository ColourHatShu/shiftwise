"use client";

import { useState } from "react";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { useApi } from "@/lib/use-api";

interface UploadResult {
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ row?: number; error: string }>;
}

interface WorkerBulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function WorkerBulkUploadModal({ isOpen, onClose, onSuccess }: WorkerBulkUploadModalProps) {
    const { apiFetch } = useApi();
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvText, setCsvText] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);
        const reader = new FileReader();
        reader.onload = (event) => setCsvText((event.target?.result as string) || "");
        reader.readAsText(file);
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await apiFetch(`/api/workers/bulk/template`);
            if (!res.ok) throw new Error("Failed to download template");
            const text = await res.text();
            const url = window.URL.createObjectURL(new Blob([text], { type: "text/csv" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "worker-template.csv";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch {
            toast.error("Failed to download template");
        }
    };

    const handleUpload = async () => {
        if (!csvText.trim()) {
            toast.error("Select a CSV file or paste CSV data");
            return;
        }
        setLoading(true);
        try {
            const res = await apiFetch(`/api/workers/bulk/upload`, {
                method: "POST",
                body: JSON.stringify({ csvData: csvText }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to import workers");
            }
            const data = await res.json();
            setResult(data.results);
            if (data.results.succeeded > 0) {
                toast.success(`Imported ${data.results.succeeded} worker${data.results.succeeded === 1 ? "" : "s"}`);
                onSuccess();
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to import workers");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setCsvFile(null);
        setCsvText("");
        setResult(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" padded={false}>
            <div className="flex items-center justify-between border-b border-[#DDE3EE] px-6 py-4">
                <h2 className="text-lg font-medium text-[#0A1628]">Bulk import workers</h2>
            </div>

            <div className="space-y-4 p-6">
                {result ? (
                    <div className="space-y-4">
                        <div className={`rounded-lg p-4 ${result.failed === 0 ? "bg-[#DCFCE7]" : "bg-[#FEF3C7]"}`}>
                            <div className="flex items-center gap-2">
                                {result.failed === 0 ? (
                                    <CheckCircle size={18} className="text-[#166534]" />
                                ) : (
                                    <AlertCircle size={18} className="text-[#92400E]" />
                                )}
                                <p className="font-medium text-[#0A1628]">
                                    {result.succeeded} succeeded, {result.failed} failed of {result.total}
                                </p>
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div className="rounded-lg bg-[#FEE2E2] p-4">
                                <p className="mb-2 font-medium text-[#991B1B]">Errors</p>
                                <ul className="max-h-40 space-y-1 overflow-y-auto">
                                    {result.errors.slice(0, 12).map((err, i) => (
                                        <li key={i} className="text-sm text-[#991B1B]">
                                            {err.row ? `Row ${err.row}: ` : ""}{err.error}
                                        </li>
                                    ))}
                                    {result.errors.length > 12 && (
                                        <li className="text-sm text-[#991B1B]">…and {result.errors.length - 12} more</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 border-t border-[#DDE3EE] pt-4">
                            <button onClick={reset} className="rounded-lg px-4 py-2 text-sm font-medium text-[#5B6E8C] hover:bg-[#F5F7FA] transition-colors">
                                Import another
                            </button>
                            <button onClick={onClose} className="rounded-lg bg-[#003087] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003087]/90">
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-[#DDE3EE] bg-[#F5F7FA] p-4 text-sm text-[#5B6E8C]">
                            Upload a CSV with columns: <span className="font-medium text-[#0A1628]">firstName, lastName, email</span> (required), and optional <span className="font-medium text-[#0A1628]">phone, jobTitle, startDate, niNumber</span>.
                        </div>

                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 rounded-lg border border-[#DDE3EE] px-4 py-2 text-sm font-medium text-[#003087] transition-colors hover:bg-[#F5F7FA]"
                        >
                            <Download size={16} /> Download template
                        </button>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-[#0A1628]">Choose CSV file</label>
                            <div className="rounded-lg border-2 border-dashed border-[#DDE3EE] p-6 text-center transition-colors hover:border-[#003087]/40">
                                <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="workerCsvInput" />
                                <label htmlFor="workerCsvInput" className="cursor-pointer">
                                    <Upload size={28} className="mx-auto mb-2 text-[#5B6E8C]" />
                                    <p className="text-sm font-medium text-[#0A1628]">{csvFile ? csvFile.name : "Click to upload a .csv"}</p>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-[#0A1628]">Or paste CSV</label>
                            <textarea
                                value={csvText}
                                onChange={(e) => setCsvText(e.target.value)}
                                rows={6}
                                placeholder={"firstName,lastName,email,phone,jobTitle,startDate,niNumber\nJane,Doe,jane@example.com,07700900001,Nurse,2026-01-15,"}
                                className="w-full rounded-lg border border-[#DDE3EE] bg-[#F5F7FA] px-3 py-2 font-mono text-sm text-[#0A1628] focus:border-[#003087] focus:outline-none focus:ring-1 focus:ring-[#003087]"
                            />
                        </div>

                        <div className="flex justify-end gap-3 border-t border-[#DDE3EE] pt-4">
                            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#5B6E8C] hover:bg-[#F5F7FA] transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={loading || !csvText.trim()}
                                className="rounded-lg bg-[#003087] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003087]/90 disabled:opacity-60"
                            >
                                {loading ? "Importing…" : "Import workers"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
