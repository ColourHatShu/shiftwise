"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Mail, Phone, Calendar, Briefcase, FileText } from "lucide-react";

export default function WorkerProfilePage() {
    const params = useParams() as any;
    const workerId = params?.id;
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [worker, setWorker] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        const fetchWorker = async () => {
            if (!isLoaded || !isSignedIn || !workerId) return;

            try {
                const token = await getToken();
                const response = await fetch(`${API_URL}/api/workers/${workerId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(response.status === 404 ? "Worker not found" : "Failed to fetch worker details");
                }

                const data = await response.json();
                setWorker(data.data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWorker();
    }, [workerId, isLoaded, isSignedIn, getToken, API_URL]);

    if (!isLoaded || isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error || !worker) {
        return (
            <div className="space-y-6">
                <Link href="/dashboard/workers" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={16} /> Back to Workers
                </Link>
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                    <p className="text-xl font-semibold">Could not load worker profile</p>
                    <p className="text-sm opacity-80">{error || "The worker you're looking for might have been deleted or you don't have access."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Link href="/dashboard/workers" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors text-sm font-medium">
                <ArrowLeft size={16} /> Back to Workers
            </Link>

            {/* Header Card */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-blue-500/30 shrink-0">
                    {worker.firstName.charAt(0)}{worker.lastName.charAt(0)}
                </div>

                <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white tracking-tight">{worker.firstName} {worker.lastName}</h1>
                        <span className="px-2.5 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-semibold uppercase tracking-wider border border-green-500/20">
                            {worker.status}
                        </span>
                    </div>
                    <p className="text-lg text-blue-400 font-medium">{worker.jobTitle}</p>
                    <p className="text-sm text-slate-400 pt-2 flex items-center gap-1.5">
                        <span className="font-mono bg-slate-900/50 px-2 py-0.5 rounded text-slate-300 border border-slate-700">ID: {worker.id}</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Contact Info */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-lg md:col-span-2 space-y-6">
                    <h2 className="text-lg font-semibold text-white border-b border-slate-700/50 pb-3">Contact & Employment Details</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                        <InfoItem icon={Mail as any} label="Email Address" value={worker.email} />
                        <InfoItem icon={Phone as any} label="Phone Number" value={worker.phone || "Not provided"} />
                        <InfoItem icon={Briefcase as any} label="Role / Job Title" value={worker.jobTitle} />
                        <InfoItem
                            icon={Calendar as any}
                            label="Start Date"
                            value={worker.startDate ? format(new Date(worker.startDate), 'MMMM dd, yyyy') : "Not recorded"}
                        />
                    </div>

                    {worker.notes && (
                        <div className="pt-4 border-t border-slate-700/50">
                            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2 mb-2">
                                <FileText size={16} />
                                Additional Notes
                            </h3>
                            <p className="text-slate-300 text-sm bg-slate-900/50 p-4 rounded-xl border border-slate-800 leading-relaxed">
                                {worker.notes}
                            </p>
                        </div>
                    )}
                </div>

                {/* Compliance Summary (Placeholder for next feature) */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-lg space-y-4">
                    <h2 className="text-lg font-semibold text-white border-b border-slate-700/50 pb-3">Compliance Status</h2>

                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <FileText className="text-blue-400" size={28} />
                        </div>
                        <div>
                            <p className="text-white font-medium">Documents & Alerts</p>
                            <p className="text-sm text-slate-400 mt-1">Worker compliance tracking will be available here soon.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-slate-500">
                <Icon size={18} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-slate-200 mt-0.5 font-medium">{value}</p>
            </div>
        </div>
    );
}
