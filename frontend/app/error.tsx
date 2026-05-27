'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('App Router error boundary captured:', error);
    // Sentry will pick this up automatically via the global handler set in
    // sentry.client.config.* / sentry-initializer.tsx.
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          An unexpected error occurred. The team has been notified.
          {error.digest ? (
            <span className="block mt-2 text-xs text-gray-400">Reference: {error.digest}</span>
          ) : null}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-[#003087] text-white rounded-md hover:bg-[#002066] focus:outline-none focus:ring-2 focus:ring-[#003087] focus:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
