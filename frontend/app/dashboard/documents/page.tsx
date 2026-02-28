export default function DocumentsPage() {
    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
                <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                    Coming Soon
                </p>
                <h1 className="text-3xl font-extrabold text-white mb-2">Documents</h1>
                <p className="text-slate-400">
                    Compliance document management — upload, review, and track expiry dates for worker documents.
                </p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <p className="text-white font-semibold text-lg">Document Management</p>
                <p className="text-slate-400 text-sm max-w-sm">
                    This section is under construction. You'll be able to manage DBS checks, Right to Work documents, and other compliance files here.
                </p>
            </div>
        </div>
    );
}
