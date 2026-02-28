export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
                <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                    Coming Soon
                </p>
                <h1 className="text-3xl font-extrabold text-white mb-2">Reports</h1>
                <p className="text-slate-400">
                    Analytics and compliance reports — get insights into your agency's workforce and compliance status.
                </p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                </div>
                <p className="text-white font-semibold text-lg">Reports & Analytics</p>
                <p className="text-slate-400 text-sm max-w-sm">
                    This section is under construction. Compliance reports, expiry summaries, and workforce analytics will be available here.
                </p>
            </div>
        </div>
    );
}
