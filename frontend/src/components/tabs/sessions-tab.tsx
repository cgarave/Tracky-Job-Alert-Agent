"use client";

import React, { useState } from "react";
import { PlatformSession } from "@/types";
import {
  Globe,
  Briefcase,
  Laptop,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SessionsTabProps {
  sessions: Record<string, PlatformSession>;
  onLaunchLogin: (platform: string) => Promise<void>;
  onOpenConnectModal: (platformKey: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function SessionsTab({
  sessions,
  onLaunchLogin,
  onOpenConnectModal,
  onRefresh,
  isLoading,
}: SessionsTabProps) {
  const [loggingInPlatform, setLoggingInPlatform] = useState<string | null>(null);

  const handleQuickLogin = async (platformKey: string) => {
    setLoggingInPlatform(platformKey);
    try {
      await onLaunchLogin(platformKey);
      onOpenConnectModal(platformKey);
    } finally {
      setLoggingInPlatform(null);
    }
  };

  const platforms = [
    {
      key: "indeed",
      name: "Indeed.ph",
      loginUrl: "https://secure.indeed.com/account/login",
      icon: Globe,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      desc: "Authenticates for Indeed Easy Apply multi-step application submissions.",
    },
    {
      key: "jobstreet",
      name: "JobStreet.ph",
      loginUrl: "https://www.jobstreet.com.ph/login",
      icon: Briefcase,
      color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
      desc: "Authenticates for JobStreet Quick Apply single-click applications.",
    },
    {
      key: "linkedin",
      name: "LinkedIn.com",
      loginUrl: "https://www.linkedin.com/login",
      icon: Globe,
      color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      desc: "Authenticates for LinkedIn Easy Apply and candidate submissions.",
    },
    {
      key: "onlinejobs",
      name: "OnlineJobs.ph",
      loginUrl: "https://www.onlinejobs.ph/jobseekers/login",
      icon: Laptop,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      desc: "Authenticates for OnlineJobs.ph direct jobseeker messaging and employer pitches.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Platform Account Sessions
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Connect your job board accounts by logging in via <strong>New Tab</strong> or using the session cookie helper. Tracky reuses these authenticated sessions so you never get challenged during automated runs.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="gap-2 self-start md:self-auto bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </Button>
      </div>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {platforms.map((p) => {
          const sess = sessions[p.key] || { connected: false, updated_at: "" };
          const Icon = p.icon;
          const isLoggingIn = loggingInPlatform === p.key;

          return (
            <Card
              key={p.key}
              className="flex flex-col justify-between relative bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80 transition-all backdrop-blur-xl shadow-lg"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${p.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {sess.connected ? (
                    <Badge variant="success" className="gap-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Connected</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px] font-medium bg-slate-950 text-slate-400 border-slate-800">
                      <AlertCircle className="w-3 h-3 text-slate-500" />
                      <span>Not Connected</span>
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-sm font-semibold text-white">{p.name}</CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed mt-1">{p.desc}</CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="pt-3 border-t border-slate-800/60 flex flex-col gap-3">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    {sess.updated_at ? (
                      <span className="text-slate-400">
                        Saved: <strong className="text-slate-300 font-mono">{sess.updated_at}</strong>
                      </span>
                    ) : (
                      <span className="text-slate-500">No session saved</span>
                    )}
                    {sess.cookie_count ? (
                      <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {sess.cookie_count} cookies
                      </span>
                    ) : null}
                  </div>

                  {/* Connection Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(p.loginUrl, "_blank", "noopener,noreferrer")}
                      className="w-full text-xs h-8 gap-1.5 text-slate-200 bg-slate-950 border-slate-800 hover:bg-slate-850 hover:border-slate-700 transition-colors"
                      title="Open official login page in new browser tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Open in New Tab</span>
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onOpenConnectModal(p.key)}
                      disabled={isLoggingIn}
                      className="w-full gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{sess.connected ? "Manage & Re-sync" : "Verify & Save Session"}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
