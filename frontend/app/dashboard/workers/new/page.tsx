"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

const ROLES = [
    "Registered Nurse",
    "Healthcare Assistant",
    "Doctor",
    "Midwife",
    "Physiotherapist",
    "Support Worker"
];

export default function AddWorkerPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if (!isLoaded || !isSignedIn) return;

        setIsSubmitting(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const fullName = formData.get("fullName") as string;
        const splitName = fullName.trim().split(" ");
        const firstName = splitName[0];
        const lastName = splitName.slice(1).join(" ") || " ";

        const data = {
            firstName,
            lastName,
            email: formData.get("email"),
            phone: formData.get("phone"),
            jobRole: formData.get("role"),
            startDate: formData.get("startDate"),
            notes: formData.get("notes") || ""
        };

        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/api/workers`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to add worker");
            }

            router.push("/dashboard/workers");
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/workers"
                    className="text-[#5B6E8C] hover:text-[#0A1628] transition-colors bg-white hover:bg-[#F5F7FA] p-2 rounded-lg border border-[#DDE3EE]"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-medium text-[#0A1628]">Add New Worker</h1>
                    <p className="text-[#5B6E8C] mt-1">Register a new healthcare professional to your agency</p>
                </div>
            </div>

            {error && (
                <div className="bg-[#FEE2E2] border border-[#DC2626]/20 text-[#991B1B] px-4 py-3 rounded-xl mb-6">
                    {error}
                </div>
            )}

            <div className="bg-white border border-[#DDE3EE] rounded-xl p-6 md:p-8 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6 flex flex-col">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="fullName" className="text-sm font-medium text-[#0A1628]">
                                Full Name <span className="text-[#DC2626]">*</span>
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                required
                                placeholder="Jane Doe"
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all placeholder:text-[#9CA3AF]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-[#0A1628]">
                                Email Address <span className="text-[#DC2626]">*</span>
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                required
                                placeholder="jane.doe@example.com"
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all placeholder:text-[#9CA3AF]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="phone" className="text-sm font-medium text-[#0A1628]">
                                Phone Number <span className="text-[#DC2626]">*</span>
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                required
                                placeholder="+44 7700 900000"
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all placeholder:text-[#9CA3AF]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="role" className="text-sm font-medium text-[#0A1628]">
                                Role <span className="text-[#DC2626]">*</span>
                            </label>
                            <select
                                id="role"
                                name="role"
                                required
                                defaultValue=""
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all appearance-none"
                            >
                                <option value="" disabled className="text-[#9CA3AF]">Select a role...</option>
                                {ROLES.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="startDate" className="text-sm font-medium text-[#0A1628]">
                                Start Date <span className="text-[#DC2626]">*</span>
                            </label>
                            <input
                                type="date"
                                id="startDate"
                                name="startDate"
                                required
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <label htmlFor="notes" className="text-sm font-medium text-[#0A1628]">
                            Notes (Optional)
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            rows={4}
                            placeholder="Any additional information about this worker..."
                            className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-3 focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all resize-none placeholder:text-[#9CA3AF]"
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-[#003087] hover:bg-[#003087]/90 disabled:bg-[#003087]/50 disabled:cursor-wait text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Worker
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
