import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracky — Job Alert & Auto-Apply Agent",
  description: "Automated Philippine job hunting, authentic PDF resume auto-fill, and 1-click applications.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">{children}</body>
    </html>
  );
}
