"use client";

import React, { useState, useEffect } from "react";
import { PlatformSession, BrowserInfo } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Briefcase,
  Laptop,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Compass,
  CircleDot,
  Flame,
  Sparkles,
  Layers,
  Loader2,
  Check,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface ConnectPlatformModalProps {
  platformKey: string | null;
  isOpen: boolean;
  onClose: () => void;
  session?: PlatformSession;
  browsers: BrowserInfo[];
  preferredBrowser: string;
  onLaunchLogin: (platform: string, browserId?: string) => Promise<void>;
  onVerifySession: (platform: string) => Promise<boolean>;
  onCancelHelper: (platform: string) => Promise<void>;
  onRefreshSessions: () => void;
}

export function ConnectPlatformModal({
  platformKey,
  isOpen,
  onClose,
  session,
  browsers,
  preferredBrowser,
  onLaunchLogin,
  onVerifySession,
  onCancelHelper,
  onRefreshSessions,
}: ConnectPlatformModalProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedBrowser, setSelectedBrowser] = useState(preferredBrowser);
  const [helperActive, setHelperActive] = useState(false);

  useEffect(() => {
    setSelectedBrowser(preferredBrowser);
  }, [preferredBrowser]);

  useEffect(() => {
    if (session?.is_helper_open) {
      setHelperActive(true);
    }
  }, [session?.is_helper_open]);

  // Periodic session poll when modal is open to auto-detect login completion
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      onRefreshSessions();
    }, 1500);

    return () => clearInterval(interval);
  }, [isOpen, onRefreshSessions]);

  if (!platformKey) return null;

  const platformMeta: Record<
    string,
    { name: string; url: string; homeUrl: string; icon: any; color: string; desc: string }
  > = {
    indeed: {
      name: "Indeed.ph",
      url: "https://secure.indeed.com/account/login",
      homeUrl: "https://ph.indeed.com",
      icon: Globe,
      color: "text-blue-400 bg-blue-500/15 border-blue-500/30",
      desc: "Authenticates for Indeed Easy Apply multi-step application submissions.",
    },
    jobstreet: {
      name: "JobStreet.ph",
      url: "https://www.jobstreet.com.ph/login",
      homeUrl: "https://www.jobstreet.com.ph",
      icon: Briefcase,
      color: "text-pink-400 bg-pink-500/15 border-pink-500/30",
      desc: "Authenticates for JobStreet Quick Apply single-click applications.",
    },
    linkedin: {
      name: "LinkedIn.com",
      url: "https://www.linkedin.com/login",
      homeUrl: "https://www.linkedin.com/jobs",
      icon: Globe,
      color: "text-sky-400 bg-sky-500/15 border-sky-500/30",
      desc: "Authenticates for LinkedIn Easy Apply candidate submissions.",
    },
    onlinejobs: {
      name: "OnlineJobs.ph",
      url: "https://www.onlinejobs.ph/jobseekers/login",
      homeUrl: "https://www.onlinejobs.ph",
      icon: Laptop,
      color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
      desc: "Authenticates for OnlineJobs.ph direct employer messages.",
    },
  };

  const meta = platformMeta[platformKey] || {
    name: platformKey.toUpperCase(),
    url: "",
    homeUrl: "",
    icon: Globe,
    color: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30",
    desc: "Platform session authentication.",
  };

  const Icon = meta.icon;
  const isConnected = !!session?.connected;

  const getBrowserIcon = (id: string) => {
    switch (id.toLowerCase()) {
      case "safari":
        return <Compass className="w-3.5 h-3.5 text-blue-400" />;
      case "brave":
        return <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />;
      case "chrome":
        return <CircleDot className="w-3.5 h-3.5 text-emerald-400" />;
      case "firefox":
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case "edge":
      case "arc":
        return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const handleOpenInNewTab = () => {
    if (meta.url) {
      window.open(meta.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleLaunchHelper = async () => {
    setIsLaunching(true);
    setHelperActive(true);
    try {
      await onLaunchLogin(platformKey, selectedBrowser);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleVerifyNow = async () => {
    setIsVerifying(true);
    try {
      const ok = await onVerifySession(platformKey);
      if (ok) {
        setHelperActive(false);
        onRefreshSessions();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancelHelper = async () => {
    await onCancelHelper(platformKey);
    setHelperActive(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 p-6 shadow-2xl">
        <DialogHeader className="gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${meta.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <span>{meta.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Account Connection & Session Sync
                </DialogDescription>
              </div>
            </div>

            {isConnected ? (
              <Badge variant="success" className="gap-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected</span>
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1 text-xs">
                <span>Not Connected</span>
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Live Status Banner */}
        {isConnected ? (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col gap-2 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-emerald-300 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Session Authenticated & Verified!</span>
            </div>
            <p className="text-xs text-slate-300">
              Tracky is authorized to submit 1-click applications on your behalf without requiring 2FA.
            </p>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-emerald-500/20 font-mono">
              <span>Cookies saved: <strong className="text-emerald-400">{session?.cookie_count || "Active"}</strong></span>
              <span>Updated: {session?.updated_at || "Just now"}</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1.5">
            <div className="text-xs font-semibold text-slate-200">How Connection Works:</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open the login page in your browser or launch the 1-click helper window. Once you sign in, Tracky saves your authenticated session tokens for automated applications.
            </p>
          </div>
        )}

        {/* Options */}
        <div className="flex flex-col gap-4 py-2">
          {/* Method 1: Open in Current Browser Tab */}
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white">Method 1: Open in Current Browser</span>
                <p className="text-[11px] text-slate-400">Open official login page in a new tab with your saved passwords.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              className="gap-2 text-xs bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 justify-center"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open {meta.name} Login in New Tab ↗</span>
            </Button>
          </div>

          {/* Method 2: 1-Click Cookie Sync Helper */}
          <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white">Method 2: 1-Click Cookie Sync Helper</span>
                <p className="text-[11px] text-slate-400">Launches a login window and automatically snapshots cookies.</p>
              </div>
            </div>

            {/* Browser Picker */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-medium mr-1">Browser:</span>
              {browsers.map((b) => {
                const isSel = b.id === selectedBrowser;
                return (
                  <button
                    key={b.id}
                    disabled={!b.installed || isLaunching}
                    onClick={() => setSelectedBrowser(b.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all border ${
                      isSel
                        ? "bg-indigo-600/30 border-indigo-500/60 text-white font-medium shadow-sm"
                        : b.installed
                        ? "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                        : "bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed opacity-40"
                    }`}
                  >
                    {getBrowserIcon(b.id)}
                    <span>{b.name.split(" ")[0]}</span>
                    {isSel && <Check className="w-3 h-3 text-indigo-400" />}
                  </button>
                );
              })}
            </div>

            {/* Helper Action Buttons */}
            {!helperActive ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleLaunchHelper}
                disabled={isLaunching}
                className="gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white justify-center shadow-lg shadow-indigo-500/20"
              >
                {isLaunching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>Launch Helper Window ({selectedBrowser.toUpperCase()})</span>
              </Button>
            ) : (
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30">
                <div className="flex items-center justify-between text-xs text-indigo-300">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span>Helper window is open. Sign in to your account.</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleVerifyNow}
                    disabled={isVerifying}
                    className="flex-1 gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>✅ I&apos;ve Logged In — Verify & Save</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelHelper}
                    className="text-xs border-slate-700 text-slate-400 hover:text-white"
                  >
                    Close Window
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-slate-800/80">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshSessions}
            className="text-xs gap-1.5 text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Check Status</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            {isConnected ? "Done" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
