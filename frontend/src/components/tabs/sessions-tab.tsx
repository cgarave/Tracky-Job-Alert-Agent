"use client";

import React, { useState } from "react";
import { PlatformSession, BrowserInfo } from "@/types";
import {
  Globe,
  Briefcase,
  Laptop,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Compass,
  ShieldCheck,
  CircleDot,
  Flame,
  Sparkles,
  ChevronDown,
  Check,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SessionsTabProps {
  sessions: Record<string, PlatformSession>;
  browsers?: BrowserInfo[];
  preferredBrowser?: string;
  onSelectBrowser?: (browserId: string) => Promise<void>;
  onLaunchLogin: (platform: string, browserId?: string) => Promise<void>;
  onRefresh: () => void;
  isLoading: boolean;
}

export function SessionsTab({
  sessions,
  browsers = [],
  preferredBrowser = "brave",
  onSelectBrowser,
  onLaunchLogin,
  onRefresh,
  isLoading,
}: SessionsTabProps) {
  const [loggingInPlatform, setLoggingInPlatform] = useState<string | null>(null);
  const [openDropdownPlatform, setOpenDropdownPlatform] = useState<string | null>(null);

  const handleLogin = async (platformKey: string, customBrowserId?: string) => {
    setLoggingInPlatform(platformKey);
    setOpenDropdownPlatform(null);
    try {
      await onLaunchLogin(platformKey, customBrowserId || preferredBrowser);
    } finally {
      setLoggingInPlatform(null);
    }
  };

  const getBrowserIcon = (id: string) => {
    switch (id.toLowerCase()) {
      case "safari":
        return <Compass className="w-4 h-4 text-blue-400" />;
      case "brave":
        return <ShieldCheck className="w-4 h-4 text-orange-400" />;
      case "chrome":
        return <CircleDot className="w-4 h-4 text-emerald-400" />;
      case "firefox":
        return <Flame className="w-4 h-4 text-amber-400" />;
      case "edge":
      case "arc":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      default:
        return <Layers className="w-4 h-4 text-indigo-400" />;
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
      key: "linkedin",
      name: "LinkedIn.com",
      icon: Globe,
      color: "text-sky-400 bg-sky-500/15 border-sky-500/30",
      desc: "Authenticates for LinkedIn Easy Apply and candidate submissions.",
    },
    {
      key: "onlinejobs",
      name: "OnlineJobs.ph",
      icon: Laptop,
      color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
      desc: "Authenticates for OnlineJobs.ph direct jobseeker messaging and employer pitches.",
    },
  ];

  const currentBrowserObj = browsers.find((b) => b.id === preferredBrowser) || {
    id: preferredBrowser,
    name: preferredBrowser.charAt(0).toUpperCase() + preferredBrowser.slice(1),
    installed: true,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Platform Account Sessions</span>
          </h2>
          <p className="text-xs text-slate-400">
            Log in once with your preferred browser (Safari, Brave, Chrome, etc.) to persist cookies. Tracky reuses these sessions so you never get challenged by 2FA during automated runs.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-2 self-start md:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </Button>
      </div>

      {/* Browser Selection Banner */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-md">
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Default Login Browser:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {browsers.map((b) => {
                const isSelected = b.id === preferredBrowser;
                return (
                  <button
                    key={b.id}
                    onClick={() => onSelectBrowser && onSelectBrowser(b.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-500/60 text-white shadow-sm ring-1 ring-indigo-500/40"
                        : b.installed
                        ? "bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                        : "bg-slate-900/40 border-slate-800/50 text-slate-500 cursor-not-allowed opacity-50"
                    }`}
                    title={b.description || b.name}
                    disabled={!b.installed}
                  >
                    {getBrowserIcon(b.id)}
                    <span>{b.name}</span>
                    {b.installed && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" title="Installed on your machine" />
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Active Engine:</span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider bg-slate-800/80 text-slate-300 border-slate-700">
              {currentBrowserObj.name}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {platforms.map((p) => {
          const sess = sessions[p.key] || { connected: false, updated_at: "" };
          const Icon = p.icon;
          const isLoggingIn = loggingInPlatform === p.key;
          const isDropdownOpen = openDropdownPlatform === p.key;

          return (
            <Card key={p.key} className="flex flex-col justify-between relative bg-slate-900/40 border-slate-800 hover:border-slate-700/80 transition-all">
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
                      <span>
                        Session saved: <strong className="text-slate-300 font-mono">{sess.updated_at}</strong>
                      </span>
                    ) : (
                      <span>Never logged in</span>
                    )}
                  </div>

                  {/* Split Button: Primary Click launches Preferred Browser, Arrow opens options */}
                  <div className="relative flex items-center w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLogin(p.key)}
                      disabled={isLoggingIn}
                      className="flex-1 gap-2 text-xs rounded-r-none border-r-0"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>
                        {isLoggingIn ? "Browser Opened..." : `Log In (${currentBrowserObj.name.split(" ")[0]})`}
                      </span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenDropdownPlatform(isDropdownOpen ? null : p.key)}
                      disabled={isLoggingIn}
                      className="px-2 text-xs rounded-l-none border-l border-slate-700/80 hover:bg-slate-800"
                      title="Choose browser for this platform"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </Button>

                    {/* Popover Dropdown for Alternative Browsers */}
                    {isDropdownOpen && (
                      <div className="absolute right-0 bottom-full mb-2 w-56 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Log in using:
                        </div>
                        {browsers.map((b) => (
                          <button
                            key={b.id}
                            disabled={!b.installed || isLoggingIn}
                            onClick={() => handleLogin(p.key, b.id)}
                            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              !b.installed
                                ? "opacity-40 cursor-not-allowed text-slate-500"
                                : "text-slate-200 hover:bg-indigo-600/30 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {getBrowserIcon(b.id)}
                              <span>{b.name}</span>
                            </div>
                            {b.id === preferredBrowser && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                Default
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
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
