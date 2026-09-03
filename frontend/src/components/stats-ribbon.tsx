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
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-1">
          {heading}
        </h1>
        <p className="text-xs text-slate-500 max-w-xl leading-relaxed">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col min-w-[105px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tracked</span>
          <span className="text-xl font-bold text-slate-900 mt-0.5 font-mono">{totalJobs}</span>
        </div>

        <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col min-w-[105px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discovered Today</span>
          <span className="text-xl font-bold text-blue-600 mt-0.5 font-mono">{todayNewJobs}</span>
        </div>

        <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col min-w-[105px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keywords</span>
          <span className="text-xl font-bold text-emerald-600 mt-0.5 font-mono">{keywordsCount}</span>
        </div>

        <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col min-w-[105px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Scan</span>
          <span className="text-xs font-mono font-medium text-slate-700 mt-1.5">{formatTimeAgo(lastScanTime)}</span>
        </div>
      </div>
    </header>
  );
}
