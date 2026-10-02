import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PlotCost PK — Islamabad plots & build cost",
    template: "%s · PlotCost PK",
  },
  description:
    "Search Islamabad property plots and estimate the full cost to build a house: land, transfer costs, approvals, construction and fees.",
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-slate-950 text-slate-100 antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
