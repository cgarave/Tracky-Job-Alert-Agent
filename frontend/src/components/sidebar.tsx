"use client";

import React from "react";
import Image from "next/image";
import { 
  Search, 
  User, 
  FileText, 
  Bot, 
  KeyRound, 
  BarChart3, 
  Settings, 
  Zap, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  totalJobs: number;
  totalApplied: number;
  isPaused: boolean;
  resumeName?: string;
  onScanNow: () => void;
  isScanning: boolean;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  totalJobs,
  totalApplied,
  isPaused,
  resumeName,
  onScanNow,
  isScanning,
}: SidebarProps) {
  const navItems = [
    { id: "jobs", label: "Scraped Jobs", icon: Search, badge: totalJobs },
    { id: "profile", label: "Profile & Resume", icon: User },
    { id: "screening", label: "Screening Q&A", icon: FileText },
    { id: "autoapply", label: "Auto-Apply Rules", icon: Bot },
    { id: "sessions", label: "Accounts & Login", icon: KeyRound },
    { id: "history", label: "Applications", icon: BarChart3, badge: totalApplied, badgeVariant: "success" as const },
    { id: "settings", label: "Search Settings", icon: Settings },
  ];

  return (
    <aside className="w-72 border-r border-white/10 bg-slate-950/80 backdrop-blur-2xl flex flex-col p-5 h-screen sticky top-0 z-30">
      {/* Brand Header */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-white/10 mb-5">
        <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 border border-white/10">
          <Image
            src="/logo.png"
            alt="Tracky Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div>
          <h2 className="font-bold text-lg text-white tracking-tight leading-tight">Tracky</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isPaused ? "bg-amber-400" : "bg-emerald-400 shadow-[0_0_8px_#34d399]"
            )} />
            <span className={cn("text-xs font-semibold", isPaused ? "text-amber-400" : "text-emerald-400")}>
              {isPaused ? "Paused" : "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left group",
                isActive
                  ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200")} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <Badge variant={item.badgeVariant || "secondary"} className="text-[10px] px-2 py-0.5 h-5 font-mono">
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer info & Scan Now Action */}
      <div className="pt-4 border-t border-white/10 flex flex-col gap-3 mt-auto">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900/90 border border-white/5 text-xs text-slate-400">
          <span className="text-base">📄</span>
          <span className="truncate flex-1 font-medium text-slate-300">
            {resumeName || "No Resume Uploaded"}
          </span>
          {resumeName ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
        </div>

        <Button
          onClick={onScanNow}
          disabled={isScanning}
          className="w-full gap-2 font-semibold shadow-lg shadow-indigo-500/25"
        >
          <Zap className={cn("w-4 h-4 fill-current", isScanning && "animate-spin")} />
          <span>{isScanning ? "Scanning..." : "Run Scan Now"}</span>
        </Button>
      </div>
    </aside>
  );
}
