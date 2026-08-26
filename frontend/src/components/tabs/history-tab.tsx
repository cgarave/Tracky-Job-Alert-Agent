"use client";

import React, { useState } from "react";
import { ApplicationRecord } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle, Globe2, HelpCircle } from "lucide-react";

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
    <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-white">
              📊 Application History & Confirmation Proofs
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Audit log of all submitted applications, automated submissions, external career portal links, and screenshots.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filter === "all" ? "bg-indigo-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                All ({applications.length})
              </button>
              <button
                onClick={() => setFilter("submitted")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filter === "submitted" ? "bg-emerald-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Submitted ({applications.filter((a) => a.status === "submitted").length})
              </button>
              <button
                onClick={() => setFilter("external")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filter === "external" ? "bg-amber-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                External ({applications.filter((a) => a.status === "external_link").length})
              </button>
              <button
                onClick={() => setFilter("failed")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filter === "failed" ? "bg-rose-600 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Failed ({applications.filter((a) => a.status === "failed").length})
              </button>
            </div>

            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredApps.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm font-medium">No application records matching &apos;{filter}&apos; filter.</p>
            <p className="text-xs text-slate-500 mt-1">
              Apply to jobs from the Scraped Jobs tab or turn on Auto-Apply.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Job Title & Company</th>
                  <th className="pb-3 px-4">Platform</th>
                  <th className="pb-3 px-4">Mode</th>
                  <th className="pb-3 px-4">Status & Details</th>
                  <th className="pb-3 px-4">Date Applied</th>
                  <th className="pb-3 pl-4 text-right">Proof / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredApps.map((app) => {
                  const isSubmitted = app.status === "submitted";
                  const isExt = app.status === "external_link";
                  const isFailed = app.status === "failed";

                  return (
                    <tr key={app.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 pr-4 max-w-sm">
                        <span className="font-semibold text-white block truncate">
                          {app.title || "Job Listing"}
                        </span>
                        <span className="text-xs text-slate-400 block truncate">
                          🏢 {app.company || "Company"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs bg-slate-900 border-slate-800">
                          {app.source || "Portal"}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400 capitalize">
                        {app.mode || "manual"}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div>
                            {isSubmitted ? (
                              <Badge variant="success" className="gap-1 text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Submitted</span>
                              </Badge>
                            ) : isExt ? (
                              <Badge variant="outline" className="gap-1 text-[11px] bg-amber-500/10 text-amber-300 border-amber-500/30">
                                <Globe2 className="w-3 h-3" />
                                <span>External Portal</span>
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-[11px]">
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

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {app.applied_at || "—"}
                      </td>

                      <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {app.screenshot_path && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onViewScreenshot(app.screenshot_path)}
                              className="gap-1.5 text-xs font-semibold h-7 px-2"
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
                            className="gap-1.5 text-xs h-7 px-2.5 bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
                          >
                            <a href={app.url} target="_blank" rel="noopener noreferrer">
                              <span>{isExt ? "Open Portal" : "View Listing"}</span>
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
