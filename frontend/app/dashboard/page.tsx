import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";

export default async function DashboardPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "Unknown";
    const firstName = user?.firstName ?? "";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
            {/* Top Nav */}
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-sm">
                            SW
                        </div>
                        <span className="text-lg font-bold tracking-tight">ShiftWise</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-sm hidden sm:block">{email}</span>
                        <SignOutButton redirectUrl="/sign-in">
                            <button className="bg-slate-700 hover:bg-slate-600 transition-colors text-sm font-medium px-4 py-2 rounded-lg text-white">
                                Sign out
                            </button>
                        </SignOutButton>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-16">
                {/* Welcome Banner */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 mb-8">
                    <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                        Dashboard
                    </p>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
                        Welcome to ShiftWise{firstName ? `, ${firstName}` : ""}! 👋
                    </h1>
                    <p className="text-slate-400 text-base">
                        Signed in as <span className="text-white font-medium">{email}</span>
                    </p>
                </div>

                {/* Placeholder Stats */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {stats.map((s) => (
                        <div
                            key={s.label}
                            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5"
                        >
                            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{s.label}</p>
                            <p className="text-3xl font-bold text-white">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Info Banner */}
                <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-5 text-sm text-blue-200">
                    🚧 <strong>Your compliance dashboard is being built.</strong> Worker management, document uploads, and expiry alerts are coming soon.
                </div>
            </main>
        </div>
    );
}

const stats = [
    { label: "Total Workers", value: "0" },
    { label: "Documents Pending", value: "0" },
    { label: "Expiring Soon", value: "0" },
    { label: "Compliant Workers", value: "0" },
];
