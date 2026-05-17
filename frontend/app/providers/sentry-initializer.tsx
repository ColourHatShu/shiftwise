"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Initialize Sentry on client side
if (typeof window !== "undefined" && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
      }),
      new Sentry.CaptureConsole({
        levels: ["error", "warn"],
      }),
    ],
  });
  console.log("✅ Sentry initialized for frontend");
} else if (typeof window !== "undefined") {
  console.log("ℹ️ NEXT_PUBLIC_SENTRY_DSN not set; Sentry disabled (no-op)");
}

export default function SentryInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
