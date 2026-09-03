"use client";

import React from "react";
import { formatTimeAgo } from "@/lib/utils";

interface StatsRibbonProps {
  heading: string;
  subtitle: string;
  totalJobs: number;
  todayNewJobs?: number;
  keywordsCount?: number;
  lastScanTime?: string;
}

export function StatsRibbon({
  heading,
  subtitle,
  totalJobs,
  todayNewJobs = 0,
  keywordsCount = 0,
  lastScanTime,
}: StatsRibbonProps) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-1">
          {heading}
        </h1>
        <p className="text-xs text-slate-400 max-w-xl leading-relaxed">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex flex-col min-w-[105px] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tracked</span>
          <span className="text-xl font-bold text-slate-100 mt-0.5 font-mono">{totalJobs}</span>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex flex-col min-w-[105px] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discovered Today</span>
          <span className="text-xl font-bold text-blue-400 mt-0.5 font-mono">{todayNewJobs}</span>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex flex-col min-w-[105px] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keywords</span>
          <span className="text-xl font-bold text-emerald-400 mt-0.5 font-mono">{keywordsCount}</span>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex flex-col min-w-[105px] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Scan</span>
          <span className="text-xs font-mono font-medium text-slate-300 mt-1.5">{formatTimeAgo(lastScanTime)}</span>
        </div>
      </div>
    </header>
  );
}
