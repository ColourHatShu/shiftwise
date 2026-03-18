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
                    background: '#ffffff',
                    color: '#1A1A2E',
                    border: '1px solid #E5E7EB',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F2647]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-medium text-[#1A1A2E]">Agency Settings</h1>
                <p className="text-[#6B7280] mt-1">Manage your agency details and core preferences</p>
            </div>

            {error && (
                <div className="bg-[#FCEBEB] border border-[#E24B4A]/20 text-[#A32D2D] px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* General Section */}
                    <div className="space-y-6">
                        <div className="border-b border-[#E5E7EB] pb-3 flex items-center gap-2 text-[#0F2647] font-medium">
                            <Building2 size={18} />
                            <h3>General Information</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#1A1A2E]">Agency Name <span className="text-[#E24B4A]">*</span></label>
                                <input
                                    required
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#1A1A2E]">Agency Type <span className="text-[#E24B4A]">*</span></label>
                                <select
                                    required
                                    name="agencyType"
                                    value={formData.agencyType}
                                    onChange={handleChange}
                                    className="w-full bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all appearance-none"
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
                        <div className="border-b border-[#E5E7EB] pb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[#0F2647] font-medium">
                                <MapPin size={18} />
                                <h3>Location & Contact</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-[#1A1A2E]">Street Address</label>
                                <input
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#1A1A2E]">City</label>
                                <input
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="w-full bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                                />
                            </div>

                            <div className="space-y-2 flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <label className="text-sm font-medium text-[#1A1A2E]">Postcode</label>
                                    <input
                                        name="postcode"
                                        value={formData.postcode}
                                        onChange={handleChange}
                                        className="w-full bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                                    />
                                </div>
                                <div className="flex-[2] space-y-2">
                                    <label className="text-sm font-medium text-[#1A1A2E] flex items-center gap-1.5">
                                        <Phone size={14} className="text-[#6B7280]" /> Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full bg-[#F8F9FB] border border-[#E5E7EB] text-[#1A1A2E] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2647] focus:ring-1 focus:ring-[#0F2647] transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[#E5E7EB] flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-[#0F2647] hover:bg-[#0F2647]/90 text-white px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
