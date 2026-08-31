"use client";

import React, { useState } from "react";
import { PlatformSession } from "@/types";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Globe,
  Briefcase,
  Laptop,
  Play,
  ClipboardPaste,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import { launchLogin, verifySession, importCookies } from "@/lib/api";

interface ConnectPlatformModalProps {
  platformKey: string | null;
  isOpen: boolean;
  onClose: () => void;
  sessions: Record<string, PlatformSession>;
  onRefreshSessions: () => void;
}

export function ConnectPlatformModal({
  platformKey,
  isOpen,
  onClose,
  sessions,
  onRefreshSessions,
}: ConnectPlatformModalProps) {
  const [activeMode, setActiveMode] = useState<"interactive" | "import">("interactive");
  const [isLaunching, setIsLaunching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [cookieInput, setCookieInput] = useState("");

  if (!platformKey) return null;

  const session = sessions[platformKey] || {
    connected: false,
    updated_at: "",
    cookie_count: 0,
    login_url: "",
    name: platformKey.toUpperCase(),
  };

  const getPlatformMeta = (key: string) => {
    switch (key.toLowerCase()) {
      case "indeed":
        return {
          name: "Indeed.ph",
          loginUrl: "https://secure.indeed.com/account/login",
          icon: Globe,
          color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        };
      case "jobstreet":
        return {
          name: "JobStreet.ph",
          loginUrl: "https://www.jobstreet.com.ph/login",
          icon: Briefcase,
          color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
        };
      case "linkedin":
        return {
          name: "LinkedIn.com",
          loginUrl: "https://www.linkedin.com/login",
          icon: Globe,
          color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
        };
      case "onlinejobs":
        return {
          name: "OnlineJobs.ph",
          loginUrl: "https://www.onlinejobs.ph/jobseekers/login",
          icon: Laptop,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        };
      default:
        return {
          name: key.toUpperCase(),
          loginUrl: session.login_url || "#",
          icon: Globe,
          color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        };
    }
  };

  const meta = getPlatformMeta(platformKey);
  const Icon = meta.icon;

  const handleLaunchInteractive = async () => {
    setIsLaunching(true);
    try {
      await launchLogin(platformKey);
      toast.info(`Interactive window launched for ${meta.name}. Please complete login.`);
      onRefreshSessions();
    } catch {
      toast.error(`Failed to launch browser window for ${meta.name}.`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleVerifySession = async () => {
    setIsVerifying(true);
    try {
      const res = await verifySession(platformKey);
      if (res.connected) {
        toast.success(`${meta.name} session verified & saved!`);
      } else {
        toast.warning(res.message || `No active authenticated session detected for ${meta.name}.`);
      }
      onRefreshSessions();
    } catch {
      toast.error("Failed to verify session status.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleImportCookies = async () => {
    if (!cookieInput.trim()) {
      toast.error("Please paste cookie JSON or string first.");
      return;
    }
    setIsImporting(true);
    try {
      const res = await importCookies(platformKey, cookieInput);
      if (res.status === "success" && res.connected) {
        toast.success(res.message || "Cookies imported and verified successfully!");
        setCookieInput("");
        onRefreshSessions();
      } else {
        toast.error(res.message || "Failed to import cookies.");
      }
    } catch {
      toast.error("Error importing cookies.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-slate-900/95 border-slate-800 text-slate-100 p-6 shadow-2xl backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${meta.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white tracking-tight">
                  Connect {meta.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Authenticate your session to enable 1-click apply and autonomous submissions.
                </DialogDescription>
              </div>
            </div>

            {session.connected ? (
              <Badge variant="success" className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px] bg-slate-950 text-slate-400 border-slate-800">
                <AlertCircle className="w-3 h-3 text-slate-500" />
                <span>Not Connected</span>
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Mode Selector Tabs */}
        <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800 mt-2">
          <button
            type="button"
            onClick={() => setActiveMode("interactive")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeMode === "interactive"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Interactive Login Window</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("import")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeMode === "import"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste Cookies / JSON</span>
          </button>
        </div>

        {activeMode === "interactive" ? (
          <div className="flex flex-col gap-4 py-3">
            {/* Step 1: Launch Interactive Login */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-semibold flex items-center justify-center border border-indigo-500/30">
                    1
                  </div>
                  <span className="text-xs font-semibold text-white">Open Interactive Login Window</span>
                </div>
                <span className="text-[11px] text-indigo-400 font-medium">Automatic Capture</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Opens a focused browser window pointing to {meta.name}. Log in with your credentials or SSO. Tracky automatically captures your session state.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleLaunchInteractive}
                  disabled={isLaunching}
                  className="flex-1 text-xs h-8 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm"
                >
                  <Play className={`w-3.5 h-3.5 ${isLaunching ? "animate-spin" : ""}`} />
                  <span>{isLaunching ? "Launching Window..." : "Launch Login Window"}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(meta.loginUrl, "_blank", "noopener,noreferrer")}
                  className="text-xs h-8 gap-1.5 bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300"
                  title="Open official login page in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Open Tab ↗</span>
                </Button>
              </div>
            </div>

            {/* Step 2: Verify & Snapshot Session */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-semibold flex items-center justify-center border border-indigo-500/30">
                    2
                  </div>
                  <span className="text-xs font-semibold text-white">Verify & Save Session</span>
                </div>
                {session.cookie_count ? (
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {session.cookie_count} cookies saved
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click below to verify the session and lock in the refreshed timestamp.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleVerifySession}
                disabled={isVerifying}
                className="w-full text-xs h-8 gap-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200"
              >
                {isVerifying ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isVerifying ? "Verifying..." : "Verify & Save Session"}</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Mode 2: Direct Paste / Import */
          <div className="flex flex-col gap-3 py-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cookie-input" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>Paste Session JSON / Cookies String</span>
              </label>
              <Textarea
                id="cookie-input"
                rows={6}
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                placeholder='Paste cookie array [{"name": "li_at", "value": "..."}] or raw string name=value; ...'
                className="bg-slate-950 border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 leading-relaxed"
              />
              <span className="text-[11px] text-slate-500">
                You can export cookies using any browser extension (e.g. Cookie-Editor) and paste them here.
              </span>
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={handleImportCookies}
              disabled={isImporting}
              className="w-full text-xs h-8 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm"
            >
              {isImporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{isImporting ? "Importing..." : "Import & Save Cookies"}</span>
            </Button>
          </div>
        )}

        {/* Live Session Metadata & Feedback */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Last Synced:{" "}
            <strong className="text-slate-200 font-mono">
              {session.updated_at || "Never synced"}
            </strong>
          </div>
          {session.connected ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
            </span>
          ) : (
            <span className="text-rose-400 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Login Needed
            </span>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-slate-500" />
            <span>Encrypted local storage on your Mac.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-400 hover:text-white">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
