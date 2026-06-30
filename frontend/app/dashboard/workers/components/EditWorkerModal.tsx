"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/use-api";
import { X, Save } from "lucide-react";
import { Modal } from "@/components/ui/modal";

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
    const { isLoaded, isSignedIn } = useAuth();
    const { apiFetch } = useApi();

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
            const response = await apiFetch(`/api/workers/${worker.id}`, {
                method: "PATCH",
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
        <Modal isOpen={true} onClose={onClose} size="lg" padded={false}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#DDE3EE] sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-medium text-[#0A1628]">Edit Worker Details</h2>
                        <p className="text-sm text-[#5B6E8C] mt-1">Reviewing profile for {worker.firstName} {worker.lastName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="p-2 text-[#5B6E8C] hover:text-[#0A1628] hover:bg-[#F5F7FA] rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-[#FEE2E2] border border-[#DC2626]/20 rounded-xl text-[#991B1B] text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#0A1628]">Full Name <span className="text-[#DC2626]">*</span></label>
                            <input
                                required
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#0A1628]">Email Address <span className="text-[#DC2626]">*</span></label>
                            <input
                                type="email"
                                required
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#0A1628]">Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#0A1628]">Job Role <span className="text-[#DC2626]">*</span></label>
                            <select
                                required
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all appearance-none"
                            >
                                <option value="" disabled>Select a role...</option>
                                {ROLES.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#0A1628]">Start Date <span className="text-[#DC2626]">*</span></label>
                            <input
                                type="date"
                                required
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-[#0A1628]">Notes & Comments</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows={4}
                                className="w-full bg-white border border-[#DDE3EE] text-[#0A1628] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#003087] focus:ring-1 focus:ring-[#003087] transition-all resize-none"
                                placeholder="Any additional information..."
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[#DDE3EE] flex justify-end gap-3 sticky bottom-0 bg-white z-10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-medium text-[#5B6E8C] hover:text-[#0A1628] hover:bg-[#F5F7FA] transition-colors border border-[#DDE3EE]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#003087] hover:bg-[#003087]/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
        </Modal>
    );
}
