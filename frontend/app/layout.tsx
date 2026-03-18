import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import "./globals.css";

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
      <html lang="en">
        <body
          className={`${dmSans.variable} font-sans antialiased bg-[#F8F9FB] text-[#1A1A2E] min-h-screen`}
        >
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#ffffff",
                color: "#1A1A2E",
                border: "1px solid #E5E7EB",
                fontFamily: "var(--font-dm-sans), sans-serif",
              },
              success: { iconTheme: { primary: "#1D9E75", secondary: "#fff" } },
              error: { iconTheme: { primary: "#E24B4A", secondary: "#fff" } },
            }}
          />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
