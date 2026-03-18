"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Save } from "lucide-react";

// Synchronized subset from new/page.tsx
const ROLES = [
    "Registered Nurse",
    "Healthcare Assistant",
    "Doctor",
    "Midwife",
    "Physiotherapist",
    "Support Worker"
];

export default function EditWorkerModal({ worker, onClose, onSuccess }: any) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    // Deconstruct worker's existing DB shape into our frontend form shape
    const [formData, setFormData] = useState({
        fullName: `${worker.firstName} ${worker.lastName}`,
        email: worker.email,
        phone: worker.phone || "",
        role: worker.jobTitle || "",
        startDate: worker.startDate ? new Date(worker.startDate).toISOString().split('T')[0] : "",
        notes: worker.notes || ""
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !isSignedIn) return;

        setIsSubmitting(true);
        setError("");

        // Split fullName back out
        const splitName = formData.fullName.trim().split(" ");
        const firstName = splitName[0];
        const lastName = splitName.slice(1).join(" ") || " ";

        const payload = {
            firstName,
            lastName,
            email: formData.email,
            phone: formData.phone,
            jobRole: formData.role,
            startDate: formData.startDate,
            notes: formData.notes
        };

        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/api/workers/${worker.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to edit worker");
            }

            onSuccess(); // Close modal and re-trigger upstream DB fetch

        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                className="bg-white border border-[#E5E7EB] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB] sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-medium text-[#1A1A2E]">Edit Worker Details</h2>
                        <p className="text-sm text-[#6B7280] mt-1">Reviewing profile for {worker.firstName} {worker.lastName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F8F9FB] rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-[#FCEBEB] border border-[#E24B4A]/20 rounded-xl text-[#A32D2D] text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1A1A2E]">Full Name <span className="text-[#E24B4A]">*</span></label>
                            <input
                                required
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#E5E7EB] text-[#1A1A2E] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1A1A2E]">Email Address <span className="text-[#E24B4A]">*</span></label>
                            <input
                                type="email"
                                required
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#E5E7EB] text-[#1A1A2E] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1A1A2E]">Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#E5E7EB] text-[#1A1A2E] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1A1A2E]">Job Role <span className="text-[#E24B4A]">*</span></label>
                            <select
                                required
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#E5E7EB] text-[#1A1A2E] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all appearance-none"
                            >
                                <option value="" disabled>Select a role...</option>
                                {ROLES.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1A1A2E]">Start Date <span className="text-[#E24B4A]">*</span></label>
                            <input
                                type="date"
                                required
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#E5E7EB] text-[#1A1A2E] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-[#1A1A2E]">Notes & Comments</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows={4}
                                className="w-full bg-white border border-[#E5E7EB] text-[#1A1A2E] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all resize-none"
                                placeholder="Any additional information..."
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[#E5E7EB] flex justify-end gap-3 sticky bottom-0 bg-white z-10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-medium text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F8F9FB] transition-colors border border-[#E5E7EB]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F2647] hover:bg-[#0F2647]/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
