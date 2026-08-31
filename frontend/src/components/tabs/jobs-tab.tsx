"use client";

import React, { useState } from "react";
import { Job } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Search,
  Building2,
  MapPin,
  Banknote,
  LayoutGrid,
  List,
  Clock,
  Globe,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

interface JobsTabProps {
  jobs: Job[];
}

export function JobsTab({ jobs }: JobsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const sources = ["all", ...Array.from(new Set(jobs.map((j) => j.source)))];

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = selectedSource === "all" || job.source === selectedSource;
    return matchesSearch && matchesSource;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 backdrop-blur-xl">
        <div className="flex flex-1 items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 focus-within:border-indigo-500/60 transition-colors">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by title, role, or company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Source Filter Tabs */}
          <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            {sources.map((src) => (
              <button
                key={src}
                onClick={() => setSelectedSource(src)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  selectedSource === src
                    ? "bg-indigo-600 text-white font-medium shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {src === "all" ? `All (${jobs.length})` : src}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "table"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Compact Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Count & Quick Status */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Showing <strong className="text-white font-mono">{filteredJobs.length}</strong> tracked listings
        </span>
      </div>

      {/* Empty State */}
      {filteredJobs.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800/80 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <CardTitle className="text-sm font-semibold text-white mb-1">
            No matching job listings found
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Try adjusting your search keywords, clearing source filters, or triggering a scan.
          </CardDescription>
        </Card>
      ) : viewMode === "table" ? (
        /* High-Density Enterprise Table View */
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                  <th className="py-3 px-4">Title & Company</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Salary</th>
                  <th className="py-3 px-4">Discovered</th>
                  <th className="py-3 pr-4 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredJobs.map((job) => (
                  <tr key={job.job_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <span className="font-semibold text-white block truncate">
                        {job.title}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{job.company}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] bg-slate-950 border-slate-800 text-slate-300">
                        {job.source}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{job.location || "Philippines"}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                        <Banknote className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>{job.salary || "Negotiable"}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatTimeAgo(job.seen_at)}</span>
                      </div>
                    </td>

                    <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-7 px-3 text-xs bg-slate-950 border-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 gap-1.5 transition-colors"
                      >
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          <span>View Job</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Visual Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <Card
              key={job.job_id}
              className="flex flex-col justify-between bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80 transition-all backdrop-blur-xl shadow-lg"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-[10px] bg-slate-950 border-slate-800 text-slate-300">
                    {job.source}
                  </Badge>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {formatTimeAgo(job.seen_at)}
                  </span>
                </div>

                <CardTitle className="text-sm font-bold text-white line-clamp-2 leading-snug">
                  {job.title}
                </CardTitle>

                <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{job.company}</span>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate max-w-[140px]">{job.location || "Philippines"}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                      <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{job.salary || "Negotiable"}</span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/40">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="w-full text-xs h-8 bg-slate-950 border-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 gap-1.5 transition-colors shadow-sm"
                    >
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        <span>Open Listing</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
