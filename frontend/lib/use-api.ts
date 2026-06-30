"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * useApi — a thin authenticated fetch wrapper that removes the repeated
 * `getToken() + fetch + Authorization header` boilerplate scattered across
 * the dashboard pages.
 *
 * `apiFetch` returns the raw Response (same as `fetch`), so existing callers
 * keep their own `res.ok` / `res.json()` handling — adoption is a drop-in:
 *
 *   const { apiFetch } = useApi();
 *   const res = await apiFetch("/api/dashboard/stats");
 *   if (res.ok) setStats(await res.json());
 *
 * - Prepends NEXT_PUBLIC_API_URL when given a path (absolute URLs pass through).
 * - Attaches the Clerk bearer token automatically.
 * - Sets `Content-Type: application/json` for non-FormData bodies (unless the
 *   caller already set it), so JSON POSTs don't need to repeat the header.
 */
export function useApi() {
    const { getToken } = useAuth();

    const apiFetch = useCallback(
        async (path: string, options: RequestInit = {}): Promise<Response> => {
            const token = await getToken();
            const headers = new Headers(options.headers || {});
            if (token) headers.set("Authorization", `Bearer ${token}`);
            if (
                options.body &&
                !(options.body instanceof FormData) &&
                !headers.has("Content-Type")
            ) {
                headers.set("Content-Type", "application/json");
            }
            const url = path.startsWith("http") ? path : `${API_URL}${path}`;
            return fetch(url, { ...options, headers });
        },
        [getToken]
    );

    return { apiFetch, apiUrl: API_URL };
}

export default useApi;
