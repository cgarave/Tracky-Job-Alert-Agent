"use client";

import React, { useState } from "react";
import { Job } from "@/types";
import { Search, ExternalLink, Rocket, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JobsTabProps {
  jobs: Job[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenApplyModal: (job: Job) => void;
  search: string;
  setSearch: (s: string) => void;
  platformFilter: string;
  setPlatformFilter: (p: string) => void;
}

export function JobsTab({
  jobs,
  isLoading,
  onRefresh,
  onOpenApplyModal,
  search,
  setSearch,
  platformFilter,
  setPlatformFilter,
}: JobsTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search job title, company, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="h-10 px-3.5 rounded-lg border border-white/10 bg-slate-950/60 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Platforms</option>
            <option value="Indeed.ph">Indeed.ph</option>
            <option value="JobStreet.ph">JobStreet.ph</option>
            <option value="OnlineJobs.ph">OnlineJobs.ph</option>
          </select>

          <Button variant="secondary" onClick={onRefresh} disabled={isLoading} className="gap-2 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Jobs Listing */}
      {isLoading && jobs.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-white/5">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          <p>Loading tracked job listings...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-14 text-center bg-slate-900/40 rounded-2xl border border-white/5">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-xl">
            🔍
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No matching jobs found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Try adjusting your search query or click "Run Scan Now" to fetch fresh listings.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => {
            const isIndeed = job.source.toLowerCase().includes("indeed");
            const isJobStreet = job.source.toLowerCase().includes("jobstreet");
            const badgeVariant = isIndeed ? "indeed" : isJobStreet ? "jobstreet" : "onlinejobs";

            const hasApplied = job.application_status === "submitted";
            const isFailed = job.application_status === "failed";

            return (
              <div
                key={job.job_id}
                className="group p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-white/20 hover:bg-slate-900/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-black/20"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant={badgeVariant}>{job.source}</Badge>
                    {hasApplied && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Applied ({job.application_mode || "manual"})</span>
                      </Badge>
                    )}
                    {isFailed && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Failed</span>
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    <span className="font-semibold text-slate-200">🏢 {job.company}</span>
                    {job.location && <span>📍 {job.location}</span>}
                    {job.salary && <span className="text-emerald-400 font-medium">💰 {job.salary}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="gap-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      <span>View</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>
                  </Button>

                  <Button
                    size="sm"
                    variant={hasApplied ? "secondary" : "default"}
                    onClick={() => onOpenApplyModal(job)}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>{hasApplied ? "Re-Apply" : "Review & Apply"}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
