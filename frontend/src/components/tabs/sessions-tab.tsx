"use client";

import React, { useState } from "react";
import { PlatformSession } from "@/types";
import { Globe, Briefcase, Laptop, KeyRound, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SessionsTabProps {
  sessions: Record<string, PlatformSession>;
  onLaunchLogin: (platform: string) => Promise<void>;
  onRefresh: () => void;
  isLoading: boolean;
}

export function SessionsTab({
  sessions,
  onLaunchLogin,
  onRefresh,
  isLoading,
}: SessionsTabProps) {
  const [loggingInPlatform, setLoggingInPlatform] = useState<string | null>(null);

  const handleLogin = async (platformKey: string) => {
    setLoggingInPlatform(platformKey);
    try {
      await onLaunchLogin(platformKey);
    } finally {
      setLoggingInPlatform(null);
    }
  };

  const platforms = [
    {
      key: "indeed",
      name: "Indeed.ph",
      icon: Globe,
      color: "text-blue-400 bg-blue-500/15 border-blue-500/30",
      desc: "Authenticates for Indeed Easy Apply multi-step application submissions.",
    },
    {
      key: "jobstreet",
      name: "JobStreet.ph",
      icon: Briefcase,
      color: "text-pink-400 bg-pink-500/15 border-pink-500/30",
      desc: "Authenticates for JobStreet Quick Apply single-click applications.",
    },
    {
      key: "onlinejobs",
      name: "OnlineJobs.ph",
      icon: Laptop,
      color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
      desc: "Authenticates for OnlineJobs.ph direct jobseeker messaging and employer pitches.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Platform Account Sessions</h2>
          <p className="text-xs text-slate-400">
            Log in once with the browser helper to save cookies. Tracky reuses these sessions so you never get challenged by 2FA during automated runs.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {platforms.map((p) => {
          const sess = sessions[p.key] || { connected: false, updated_at: "" };
          const Icon = p.icon;
          const isLoggingIn = loggingInPlatform === p.key;

          return (
            <Card key={p.key} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${p.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {sess.connected ? (
                    <Badge variant="success" className="gap-1 text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Connected</span>
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-[11px]">
                      <AlertCircle className="w-3 h-3" />
                      <span>Not Connected</span>
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <CardDescription className="text-xs">{p.desc}</CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="pt-3 border-t border-white/5 flex flex-col gap-3">
                  <div className="text-[11px] text-slate-400">
                    {sess.updated_at ? (
                      <span>Session saved: <strong className="text-slate-300 font-mono">{sess.updated_at}</strong></span>
                    ) : (
                      <span>Never logged in</span>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLogin(p.key)}
                    disabled={isLoggingIn}
                    className="w-full gap-2 text-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{isLoggingIn ? "Browser Opened..." : "🔑 Log In with Browser"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
