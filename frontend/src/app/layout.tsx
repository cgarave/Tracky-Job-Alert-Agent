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
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#0b0f17] text-slate-100">{children}</body>
    </html>
  );
}
