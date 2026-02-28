"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Phone, ChevronRight, CheckCircle2 } from "lucide-react";

const AGENCY_TYPES = [
    "Nursing Agency",
    "Care Agency",
    "Allied Health Agency",
    "Mixed Healthcare Agency",
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function OnboardingPage() {
    const { getToken } = useAuth();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        name: "",
        address: "",
        city: "",
        postcode: "",
        phone: "",
        agencyType: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/agencies/onboard`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save details");
            }

            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 mb-4">
                        <span className="text-white font-bold text-xl">SW</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                        Welcome to ShiftWise
                    </h1>
                    <p className="text-slate-400 mt-2 text-base max-w-md mx-auto">
                        Let's set up your agency in just a minute. Fill in the details below to get started.
                    </p>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {["Agency Details", "You're done!"].map((step, i) => (
                        <div key={step} className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${i === 0 ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-500"}`}>
                                {i === 0 ? <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">1</span> : <CheckCircle2 size={14} />}
                                {step}
                            </div>
                            {i === 0 && <ChevronRight size={14} className="text-slate-600" />}
                        </div>
                    ))}
                </div>

                {/* Form Card */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Agency Name */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <Building2 size={15} className="text-blue-400" />
                                Agency Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                name="name"
                                type="text"
                                required
                                value={form.name}
                                onChange={handleChange}
                                placeholder="e.g. Bright Care Staffing Ltd"
                                className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm"
                            />
                        </div>

                        {/* Agency Type */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <Building2 size={15} className="text-blue-400" />
                                Agency Type <span className="text-red-400">*</span>
                            </label>
                            <select
                                name="agencyType"
                                required
                                value={form.agencyType}
                                onChange={handleChange}
                                className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none text-sm"
                            >
                                <option value="" disabled className="text-slate-500">Select agency type...</option>
                                {AGENCY_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* Address */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <MapPin size={15} className="text-blue-400" />
                                Address <span className="text-red-400">*</span>
                            </label>
                            <input
                                name="address"
                                type="text"
                                required
                                value={form.address}
                                onChange={handleChange}
                                placeholder="e.g. 12 High Street"
                                className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm"
                            />
                        </div>

                        {/* City + Postcode */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">
                                    City <span className="text-red-400">*</span>
                                </label>
                                <input
                                    name="city"
                                    type="text"
                                    required
                                    value={form.city}
                                    onChange={handleChange}
                                    placeholder="e.g. London"
                                    className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">
                                    Postcode <span className="text-red-400">*</span>
                                </label>
                                <input
                                    name="postcode"
                                    type="text"
                                    required
                                    value={form.postcode}
                                    onChange={handleChange}
                                    placeholder="e.g. SW1A 1AA"
                                    className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <Phone size={15} className="text-blue-400" />
                                Contact Phone Number <span className="text-red-400">*</span>
                            </label>
                            <input
                                name="phone"
                                type="tel"
                                required
                                value={form.phone}
                                onChange={handleChange}
                                placeholder="e.g. +44 20 7946 0958"
                                className="w-full bg-slate-900/60 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-wait text-white py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 mt-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Complete Setup
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-500 text-xs mt-6">
                    You can update these details later from Settings.
                </p>
            </div>
        </div>
    );
}
