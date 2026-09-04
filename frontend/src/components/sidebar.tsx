"use client";

import React from "react";
import Image from "next/image";
import { 
  Search, 
  Settings, 
  Zap, 
  Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  totalJobs: number;
  isPaused: boolean;
  onScanNow: () => void;
  isScanning: boolean;
  location?: string;
  interval?: number;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  totalJobs,
  isPaused,
  onScanNow,
  isScanning,
  location,
  interval,
}: SidebarProps) {
  const navItems = [
    { id: "jobs", label: "Jobs Feed", icon: Search, badge: totalJobs },
    { id: "settings", label: "Alert Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col p-5 h-screen sticky top-0 z-30 shadow-xs">
      {/* Brand Header */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100 mb-5">
        <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-slate-50">
          <Image
            src="/logo.png"
            alt="Tracky Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div>
          <h2 className="font-bold text-base text-slate-900 tracking-tight leading-tight">Tracky</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn(
              "w-2 h-2 rounded-full",
              isPaused ? "bg-amber-500" : "bg-emerald-500"
            )} />
            <span className={cn("text-[11px] font-medium", isPaused ? "text-amber-700" : "text-emerald-700")}>
              {isPaused ? "Paused" : "Active & Monitoring"}
            </span>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer group",
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Scan Now Action */}
      <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 mt-auto">
        <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-slate-800">Scanner Engine</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5 font-medium">
            <span>{location || "Philippines"}</span>
            <span>Every {interval || 60}m</span>
          </div>
        </div>

        <Button
          onClick={onScanNow}
          disabled={isScanning}
          className="w-full gap-2 font-medium text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
        >
          <Zap className={cn("w-3.5 h-3.5 fill-current", isScanning && "animate-spin")} />
          <span>{isScanning ? "Scanning..." : "Run Scan Now"}</span>
        </Button>
      </div>
    </aside>
  );
}
