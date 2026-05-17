import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    integrations: [
      new Sentry.Integrations.Undici(),
    ],
  });
  console.log("✅ Sentry initialized for frontend (server)");
} else {
  console.log("ℹ️ NEXT_PUBLIC_SENTRY_DSN not set; Sentry disabled (no-op)");
}
