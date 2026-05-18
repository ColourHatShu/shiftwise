import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import SentryInitializer from "./providers/sentry-initializer";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "ShiftWise – Compliance Management for Healthcare Staffing",
  description:
    "ShiftWise helps UK healthcare staffing agencies manage worker compliance, track document expiry, and stay audit-ready.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <SentryInitializer>
        <html lang="en">
          <body
            className={`${dmSans.variable} font-sans antialiased bg-[#F5F7FA] text-[#0A1628] min-h-screen`}
          >
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "#ffffff",
                  color: "#0A1628",
                  border: "1px solid #DDE3EE",
                  fontFamily: "var(--font-dm-sans), sans-serif",
                },
                success: { iconTheme: { primary: "#16A34A", secondary: "#fff" } },
                error: { iconTheme: { primary: "#DC2626", secondary: "#fff" } },
              }}
            />
            {children}
          </body>
        </html>
      </SentryInitializer>
    </ClerkProvider>
  );
}
