export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
                <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                    Coming Soon
                </p>
                <h1 className="text-3xl font-extrabold text-white mb-2">Settings</h1>
                <p className="text-slate-400">
                    Agency settings — manage your agency profile, users, notification preferences, and integrations.
                </p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                </div>
                <p className="text-white font-semibold text-lg">Agency Settings</p>
                <p className="text-slate-400 text-sm max-w-sm">
                    This section is under construction. Agency profile, user management, and notification preferences will be available here.
                </p>
            </div>
        </div>
    );
}
