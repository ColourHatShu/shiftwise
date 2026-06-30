"use client";

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Initialize Sentry on client side once at module load.
// @sentry/nextjs v8+ uses functional `Sentry.replayIntegration()` and
// `Sentry.captureConsoleIntegration()` instead of the old class constructors
// (Sentry.Replay / Sentry.CaptureConsole) which were removed in v8.
if (typeof window !== "undefined" && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      Sentry.captureConsoleIntegration({
        levels: ["error", "warn"],
      }),
    ],
  });
  // eslint-disable-next-line no-console
  console.log("✅ Sentry initialized for frontend");
} else if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("ℹ️ NEXT_PUBLIC_SENTRY_DSN not set; Sentry disabled (no-op)");
}

export default function SentryInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
