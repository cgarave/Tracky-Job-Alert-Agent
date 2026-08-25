"use client";

import React from "react";
import { ApplicationRecord } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

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
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">📊 Application History & Confirmation Proofs</CardTitle>
            <CardDescription className="text-xs">
              Audit log of all submitted applications, timestamps, and confirmation screenshots.
            </CardDescription>
          </div>

          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {applications.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm">No applications recorded yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Apply to jobs manually from the Scraped Jobs tab or turn on Auto-Apply.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Job Title & Company</th>
                  <th className="pb-3 px-4">Platform</th>
                  <th className="pb-3 px-4">Mode</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Date Applied</th>
                  <th className="pb-3 pl-4 text-right">Proof / Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {applications.map((app) => {
                  const isSubmitted = app.status === "submitted";
                  const isExt = app.status === "external_link";

                  return (
                    <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 pr-4">
                        <span className="font-semibold text-white block truncate max-w-xs">
                          {app.title || "Unknown Role"}
                        </span>
                        <span className="text-xs text-slate-400 block truncate max-w-xs">
                          🏢 {app.company || "Unknown Company"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {app.source || "Portal"}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400 capitalize">
                        {app.mode || "manual"}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isSubmitted ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Submitted</span>
                          </Badge>
                        ) : isExt ? (
                          <Badge variant="warning">External Portal</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Failed</span>
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {app.applied_at || "—"}
                      </td>

                      <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                        {app.screenshot_path ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onViewScreenshot(app.screenshot_path)}
                            className="gap-1.5 text-xs font-semibold"
                          >
                            <Camera className="w-3.5 h-3.5 text-indigo-400" />
                            <span>View Proof</span>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                            <a href={app.url} target="_blank" rel="noopener noreferrer">
                              <span>Open Link</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                            </a>
                          </Button>
                        )}
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
