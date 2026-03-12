import type { Metadata } from "next";
import "./globals.css";
import AnalyticsProvider from "@/components/AnalyticsProvider";

export const metadata: Metadata = {
  title: "VitalScan by Vecton — Core Web Vitals Analyzer",
  description:
    "AI-powered Core Web Vitals analysis with actionable recommendations. Built by Vecton.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AnalyticsProvider />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
