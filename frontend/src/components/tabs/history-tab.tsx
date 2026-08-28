"use client";

import React, { useState } from "react";
import { ApplicationRecord } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Globe2,
  BarChart3,
  Building2,
} from "lucide-react";

interface HistoryTabProps {
  applications: ApplicationRecord[];
  onRefresh: () => void;
  onViewScreenshot: (filename: string) => void;
  isLoading: boolean;
}

export function HistoryTab({
  applications,
  onRefresh,
  onViewScreenshot,
  isLoading,
}: HistoryTabProps) {
  const [filter, setFilter] = useState<string>("all");

  const filteredApps = applications.filter((app) => {
    if (filter === "all") return true;
    if (filter === "submitted") return app.status === "submitted";
    if (filter === "external") return app.status === "external_link";
    if (filter === "failed") return app.status === "failed";
    return true;
  });

  return (
    <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <CardTitle className="text-base font-bold text-white tracking-tight">
                Application History & Confirmation Proofs
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Audit log of all submitted applications, automated submissions, external career portal links, and screenshots.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  filter === "all" ? "bg-indigo-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                All ({applications.length})
              </button>
              <button
                onClick={() => setFilter("submitted")}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  filter === "submitted" ? "bg-emerald-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Submitted ({applications.filter((a) => a.status === "submitted").length})
              </button>
              <button
                onClick={() => setFilter("external")}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  filter === "external" ? "bg-amber-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                External ({applications.filter((a) => a.status === "external_link").length})
              </button>
              <button
                onClick={() => setFilter("failed")}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  filter === "failed" ? "bg-rose-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Failed ({applications.filter((a) => a.status === "failed").length})
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="gap-2 bg-slate-950 border-slate-800 text-slate-200 hover:bg-slate-850"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {filteredApps.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm font-medium text-slate-300">No application records matching &apos;{filter}&apos; filter.</p>
            <p className="text-xs text-slate-500 mt-1">
              Apply to jobs from the Scraped Jobs tab or turn on Auto-Apply.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                  <th className="py-3 px-4">Job Title & Company</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Status & Details</th>
                  <th className="py-3 px-4">Date Applied</th>
                  <th className="py-3 pr-4 pl-2 text-right">Proof / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredApps.map((app) => {
                  const isSubmitted = app.status === "submitted";
                  const isExt = app.status === "external_link";

                  return (
                    <tr key={app.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 max-w-sm">
                        <span className="font-semibold text-white block truncate">
                          {app.title || "Job Listing"}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{app.company || "Company"}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] bg-slate-950 border-slate-800 text-slate-300">
                          {app.source || "Portal"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-400 capitalize font-mono">
                        {app.mode || "manual"}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div>
                            {isSubmitted ? (
                              <Badge variant="success" className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Submitted</span>
                              </Badge>
                            ) : isExt ? (
                              <Badge variant="outline" className="gap-1 text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30 font-medium">
                                <Globe2 className="w-3 h-3" />
                                <span>External Portal</span>
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-[10px] font-medium">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Action Needed</span>
                              </Badge>
                            )}
                          </div>

                          {/* Error / Notice Details */}
                          {app.error_message ? (
                            <span className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                              {app.error_message}
                            </span>
                          ) : isExt ? (
                            <span className="text-[11px] text-amber-400/80">
                              Requires application on company ATS site
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {app.applied_at || "—"}
                      </td>

                      <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {app.screenshot_path && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onViewScreenshot(app.screenshot_path)}
                              className="gap-1 text-xs font-medium h-7 px-2 bg-slate-950 border border-slate-800 text-slate-200 hover:bg-slate-850"
                              title="View confirmation screenshot"
                            >
                              <Camera className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Proof</span>
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="gap-1.5 text-xs h-7 px-2.5 bg-slate-950 border-slate-800 hover:bg-slate-850 text-slate-200"
                          >
                            <a href={app.url} target="_blank" rel="noopener noreferrer">
                              <span>{isExt ? "Open Portal" : "View"}</span>
                              <ExternalLink className="w-3 h-3 text-indigo-400" />
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
