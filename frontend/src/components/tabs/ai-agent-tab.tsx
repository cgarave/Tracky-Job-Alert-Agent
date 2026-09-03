"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  Play,
  Pause,
  Square,
  Sparkles,
  Sliders,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  HelpCircle,
  FileText,
  MousePointer,
  Radio,
  Eye
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AISessionStatus, CandidateProfile } from "@/types";
import * as api from "@/lib/api";

interface AiAgentTabProps {
  profile: CandidateProfile | null;
  onProfileUpdate: (updated: CandidateProfile) => void;
}

export function AiAgentTab({ profile, onProfileUpdate }: AiAgentTabProps) {
  const [sessionStatus, setSessionStatus] = useState<AISessionStatus>({
    active: false,
    paused: false,
    mode: "batch",
    current_job: null,
    session_id: "",
    started_at: "",
    daily_max: 10,
    applied_today: 0,
    log: []
  });

  const [maxApps, setMaxApps] = useState<number>(profile?.ai_settings?.max_applications_per_day || 10);
  const [minMatch, setMinMatch] = useState<number>(profile?.ai_settings?.min_match_score || 70);
  const [appMode, setAppMode] = useState<string>(profile?.ai_settings?.application_mode || "review_before_submit");
  const [autoResume, setAutoResume] = useState<boolean>(profile?.ai_settings?.resume_auto_upload ?? true);
  const [ghostCursor, setGhostCursor] = useState<boolean>(profile?.ai_settings?.enable_ghost_cursor ?? true);
  const [showStream, setShowStream] = useState<boolean>(profile?.ai_settings?.show_reasoning_stream ?? true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  useEffect(() => {
    if (profile?.ai_settings) {
      setMaxApps(profile.ai_settings.max_applications_per_day || 10);
      setMinMatch(profile.ai_settings.min_match_score || 70);
      setAppMode(profile.ai_settings.application_mode || "review_before_submit");
      setAutoResume(profile.ai_settings.resume_auto_upload ?? true);
      setGhostCursor(profile.ai_settings.enable_ghost_cursor ?? true);
      setShowStream(profile.ai_settings.show_reasoning_stream ?? true);
    }
  }, [profile]);

  const pollSession = async () => {
    try {
      const data = await api.fetchAISessionStatus();
      if (data) setSessionStatus(data);
    } catch (e) {
      console.error("Error polling AI session:", e);
    }
  };

  useEffect(() => {
    pollSession();
    const interval = setInterval(pollSession, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleStartSession = async () => {
    setIsTriggering(true);
    try {
      const res = await api.startAISession("batch");
      setSessionStatus(res.session);
      toast.success("AI Batch Session started! Opening first matching job...");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to start session: ${msg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const handlePauseSession = async () => {
    try {
      const res = await api.pauseAISession();
      setSessionStatus(res.session);
      toast.info("AI Session paused.");
    } catch (e) {
      toast.error("Failed to pause session.");
    }
  };

  const handleResumeSession = async () => {
    try {
      const res = await api.resumeAISession();
      setSessionStatus(res.session);
      toast.success("AI Session resumed.");
    } catch (e) {
      toast.error("Failed to resume session.");
    }
  };

  const handleStopSession = async () => {
    try {
      const res = await api.stopAISession();
      setSessionStatus(res.session);
      toast.warning("AI Session stopped.");
    } catch (e) {
      toast.error("Failed to stop session.");
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const updatedAiSettings = {
        ...profile?.ai_settings,
        max_applications_per_day: Number(maxApps),
        min_match_score: Number(minMatch),
        application_mode: appMode as 'review_before_submit' | 'full_auto',
        resume_auto_upload: autoResume,
        enable_ghost_cursor: ghostCursor,
        show_reasoning_stream: showStream,
      };

      const res = await api.saveAISessionSettings(updatedAiSettings);
      if (profile) {
        onProfileUpdate({
          ...profile,
          ai_settings: res.ai_settings
        });
      }
      toast.success("AI Agent session settings saved!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to save settings: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner: Session Live Status & Quick Action Controls */}
      <Card className="border-slate-200/90 shadow-sm bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 border-b border-slate-200/80 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    AI Auto-Apply Agent Co-Pilot
                    <Badge variant="outline" className="font-mono text-xs bg-white text-blue-700 border-blue-200 shadow-2xs">
                      Gemini Vision
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Multimodal vision browser perception, natural typing cadence, and autonomous ATS navigation.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Status Indicators */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs">
                <span className={`w-2.5 h-2.5 rounded-full ${sessionStatus.active ? (sessionStatus.paused ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-ping') : 'bg-slate-300'}`} />
                <span className="text-xs font-semibold text-slate-800">
                  {sessionStatus.active ? (sessionStatus.paused ? 'Session Paused' : 'Session Running') : 'Agent Idle'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Counter Ribbon & Actions */}
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                Applied Today
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">{sessionStatus.applied_today}</span>
                <span className="text-xs font-mono text-slate-500">/ {maxApps} daily cap</span>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Min Match Score
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">{minMatch}%</span>
                <span className="text-xs text-slate-500">threshold</span>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                Approval Safety Mode
              </span>
              <div className="mt-2">
                <Badge variant="secondary" className="font-semibold text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                  {appMode === "full_auto" ? "⚡ Full Auto" : "👁 Review Before Submit"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action Button Controls */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            {!sessionStatus.active ? (
              <Button
                onClick={handleStartSession}
                disabled={isTriggering}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 mr-2 fill-current" />
                Start AI Batch Session
              </Button>
            ) : (
              <>
                {sessionStatus.paused ? (
                  <Button
                    onClick={handleResumeSession}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Resume Session
                  </Button>
                ) : (
                  <Button
                    onClick={handlePauseSession}
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs px-4"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Pause Session
                  </Button>
                )}
                <Button
                  onClick={handleStopSession}
                  variant="outline"
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs px-4"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                  Stop Session
                </Button>
              </>
            )}

            <span className="text-xs text-slate-500 ml-auto flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              Tip: You can also click ⚡ Auto-Apply on any specific job card.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Limits & Thresholds */}
        <Card className="border-slate-200/90 shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Session Limits & Thresholds
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Control daily application limits and AI matching strictness.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-700">Max Applications Per Day</label>
                <span className="font-mono font-bold text-blue-600">{maxApps} jobs</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={maxApps}
                onChange={(e) => setMaxApps(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-[11px] text-slate-500">
                Safety cap to prevent over-applying across job boards.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-700">Minimum Match Score Threshold</label>
                <span className="font-mono font-bold text-blue-600">{minMatch}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minMatch}
                onChange={(e) => setMinMatch(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-[11px] text-slate-500">
                AI scores each job description against your profile before applying.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="font-semibold text-slate-700 text-xs block">Application Submission Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAppMode("review_before_submit")}
                  className={`p-3 rounded-xl border text-left transition-all ${appMode === 'review_before_submit' ? 'border-blue-500 bg-blue-50/50 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Review Mode
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Fills all steps, pauses for approval before submit.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAppMode("full_auto")}
                  className={`p-3 rounded-xl border text-left transition-all ${appMode === 'full_auto' ? 'border-blue-500 bg-blue-50/50 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Full Auto
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Submits automatically without pausing.
                  </p>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vision & Visual Preferences */}
        <Card className="border-slate-200/90 shadow-sm bg-white">
          <CardHeader className="pb-4 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-blue-600" />
              Vision & Perception Settings
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Customize resume handling, visual ghost cursor, and live HUD streaming.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="space-y-0.5 pr-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Auto-Upload Stored Resume
                </label>
                <p className="text-[11px] text-slate-500">
                  Automatically attaches resume PDF when job aligns with profile.
                </p>
              </div>
              <Switch checked={autoResume} onCheckedChange={setAutoResume} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="space-y-0.5 pr-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <MousePointer className="w-3.5 h-3.5 text-indigo-600" />
                  Smooth Ghost Cursor
                </label>
                <p className="text-[11px] text-slate-500">
                  Animates a visible AI pointer along human trajectories.
                </p>
              </div>
              <Switch checked={ghostCursor} onCheckedChange={setGhostCursor} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="space-y-0.5 pr-4">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-600" />
                  Stream AI Thought Process
                </label>
                <p className="text-[11px] text-slate-500">
                  Shows live Gemini reasoning stream inside the floating browser HUD.
                </p>
              </div>
              <Switch checked={showStream} onCheckedChange={setShowStream} />
            </div>

            <div className="pt-3">
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 shadow-xs"
              >
                {isSaving ? "Saving Settings..." : "Save AI Agent Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Application History Log */}
      <Card className="border-slate-200/90 shadow-sm bg-white">
        <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Today&apos;s Application Session Log
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Real-time activity recorded during this session.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono text-xs bg-slate-100 text-slate-700">
            {sessionStatus.log.length} records
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {sessionStatus.log.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Bot className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No application activities logged yet today.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Start a session or click Auto-Apply on a job listing to begin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-500 font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Job Title</th>
                    <th className="py-2.5 px-4">Company</th>
                    <th className="py-2.5 px-4">Site / Platform</th>
                    <th className="py-2.5 px-4 text-center">Match</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionStatus.log.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{item.title}</td>
                      <td className="py-2.5 px-4 text-slate-600">{item.company}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px] py-0 px-2 font-mono bg-slate-50 text-slate-600 border-slate-200">
                          {item.source}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-blue-600">
                        {item.match_score}%
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 ${item.status === 'applied' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {item.status === 'applied' ? '✓ Applied' : item.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right text-[11px] font-mono text-slate-400">
                        {item.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
