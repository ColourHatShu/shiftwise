import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-900 text-slate-100 min-h-screen selection:bg-blue-500/30`}
        >
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
              },
              success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
              error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
            }}
          />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
