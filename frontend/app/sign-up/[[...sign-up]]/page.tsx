import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6">
            <div className="mb-8 flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center font-bold text-white mb-3">
                    SW
                </div>
                <h1 className="text-white text-2xl font-bold tracking-tight">ShiftWise</h1>
                <p className="text-slate-400 text-sm mt-1">Create your agency account</p>
            </div>
            <SignUp />
        </main>
    );
}
