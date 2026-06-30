"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function ForceSignOutPage() {
    const { signOut } = useClerk();
    const router = useRouter();

    useEffect(() => {
        signOut(() => router.push("/sign-in"));
    }, [signOut, router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
            <p className="text-white text-lg">Signing you out...</p>
        </div>
    );
}
