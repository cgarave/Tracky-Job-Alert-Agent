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
import {
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Lock,
  ArrowRight,
  Globe,
  Briefcase,
  Laptop,
} from "lucide-react";
import { toast } from "sonner";
import { verifySession, cancelSessionLogin } from "@/lib/api";

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
  const [isVerifying, setIsVerifying] = useState(false);

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

  const handleVerifySession = async () => {
    setIsVerifying(true);
    try {
      const res = await verifySession(platformKey);
      if (res.connected) {
        toast.success(`${meta.name} session authenticated & verified!`);
        onRefreshSessions();
      } else {
        toast.error(`No active authenticated session detected for ${meta.name}. Please ensure you are logged in.`);
      }
    } catch {
      toast.error("Failed to verify session status.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenLoginTab = () => {
    window.open(meta.loginUrl, "_blank", "noopener,noreferrer");
    toast.info(`Opened ${meta.name} login in new tab.`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900/95 border-slate-800 text-slate-100 p-6 shadow-2xl backdrop-blur-2xl">
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
                  Authenticate your session to enable automated application submissions.
                </DialogDescription>
              </div>
            </div>

            {session.connected ? (
              <Badge variant="success" className="gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
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

        <div className="flex flex-col gap-4 py-3">
          {/* Step 1 Card: Open Login Tab */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-semibold flex items-center justify-center border border-indigo-500/30">
                  1
                </div>
                <span className="text-xs font-semibold text-white">Log in on Official Website</span>
              </div>
              <span className="text-[11px] text-slate-500">Your Default Browser</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open the official {meta.name} portal in a new tab. Log in using your credentials, Apple Passkeys, or Google SSO.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenLoginTab}
              className="w-full text-xs h-8 gap-2 bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open {meta.name} in New Tab</span>
            </Button>
          </div>

          {/* Step 2 Card: Verify & Save Session */}
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
              Once you have logged in, click below to verify and save the authenticated session for background auto-applying.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleVerifySession}
              disabled={isVerifying}
              className="w-full text-xs h-8 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm"
            >
              {isVerifying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isVerifying ? "Verifying Session..." : "Verify & Save Session"}</span>
            </Button>
          </div>

          {/* Session Details */}
          {session.connected && (
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Session authenticated and ready for 1-click & auto apply.</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-slate-500" />
            <span>Cookies stored securely locally on your Mac.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-400 hover:text-white">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
