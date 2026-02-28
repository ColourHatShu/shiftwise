import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "Unknown";
    const firstName = user?.firstName ?? "";

    return (
        <div className="space-y-8">
            {/* Welcome Banner */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
                <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                    Dashboard
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
                    Welcome back{firstName ? `, ${firstName}` : ""}! 👋
                </h1>
                <p className="text-slate-400 text-base">
                    Signed in as <span className="text-white font-medium">{email}</span>
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div
                        key={s.label}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm hover:border-slate-600/50 transition-colors"
                    >
                        <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{s.label}</p>
                        <p className="text-3xl font-bold text-white">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Info Banner */}
            <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-5 text-sm text-blue-200">
                🚧 <strong>Your compliance dashboard is being built.</strong> Document uploads and expiry alerts are coming soon.
            </div>
        </div>
    );
}

const stats = [
    { label: "Total Workers", value: "0" },
    { label: "Documents Pending", value: "0" },
    { label: "Expiring Soon", value: "0" },
    { label: "Compliant Workers", value: "0" },
];
