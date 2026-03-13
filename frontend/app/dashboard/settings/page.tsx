"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Save, Building2, MapPin, Phone } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const AGENCY_TYPES = [
    "Recruitment Agency",
    "Nursing Home",
    "Hospital Staffing",
    "Home Care Provider",
    "Other"
];

export default function SettingsPage() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        agencyType: "",
        phone: "",
        address: "",
        city: "",
        postcode: ""
    });

    useEffect(() => {
        const fetchSettings = async () => {
            if (!isLoaded || !isSignedIn) return;
            try {
                const token = await getToken();
                const res = await fetch(`${API_URL}/api/agencies/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) throw new Error("Failed to load settings");

                const json = await res.json();
                const agency = json.data;

                setFormData({
                    name: agency.name || "",
                    agencyType: agency.agencyType || "",
                    phone: agency.phone || "",
                    address: agency.address || "",
                    city: agency.city || "",
                    postcode: agency.postcode || ""
                });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [isLoaded, isSignedIn, getToken]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError("");

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/agencies/update`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to update settings");
            }

            toast.success("Settings saved successfully", {
                style: {
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #334155'
                }
            });
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsSaving(false);
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
        <div className="max-w-4xl space-y-6">
            <div className="flex justify-between items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Agency Settings</h1>
                    <p className="text-slate-400 mt-1">Manage your agency details and core preferences</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* General Section */}
                    <div className="space-y-6">
                        <div className="border-b border-slate-700/50 pb-3 flex items-center gap-2 text-blue-400 font-medium tracking-wide">
                            <Building2 size={18} />
                            <h3>General Information</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Agency Name <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Agency Type <span className="text-red-400">*</span></label>
                                <select
                                    required
                                    name="agencyType"
                                    value={formData.agencyType}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
                                >
                                    <option value="" disabled>Select type...</option>
                                    {AGENCY_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Contact & Location Section */}
                    <div className="space-y-6">
                        <div className="border-b border-slate-700/50 pb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-400 font-medium tracking-wide">
                                <MapPin size={18} />
                                <h3>Location & Contact</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-300">Street Address</label>
                                <input
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">City</label>
                                <input
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="space-y-2 flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Postcode</label>
                                    <input
                                        name="postcode"
                                        value={formData.postcode}
                                        onChange={handleChange}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div className="flex-[2] space-y-2">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                                        <Phone size={14} className="text-slate-400" /> Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-700/50 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={18} />
                            {isSaving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
