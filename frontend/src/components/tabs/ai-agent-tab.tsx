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
  Eye,
  ChevronDown,
  ChevronRight,
  ListTree,
  CornerDownRight,
  Palette,
  Key,
  EyeOff,
  XCircle,
  Loader2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AISessionStatus, CandidateProfile, ReasoningStep } from "@/types";
import * as api from "@/lib/api";

const CURSOR_STYLES = [
  { id: "figma_arrow", label: "Figma Arrow", desc: "Classic multiplayer pointer" },
  { id: "modern_wedge", label: "Precision Wedge", desc: "Sleek Raycast / Linear wedge" },
  { id: "glowing_orb", label: "Radar Orb", desc: "Minimal glowing radar orb" },
  { id: "co_pilot_hand", label: "Co-Pilot Hand", desc: "Friendly pointing indicator" }
] as const;

const PRESET_COLORS = [
  { name: "Amber", hex: "#F59E0B" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Rose", hex: "#EC4899" },
  { name: "Obsidian", hex: "#0F172A" }
];

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
    current_steps: [],
    session_id: "",
    started_at: "",
    daily_max: 10,
    applied_today: 0,
    log: []
  });

  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [maxApps, setMaxApps] = useState<number>(profile?.ai_settings?.max_applications_per_day || 10);
  const [minMatch, setMinMatch] = useState<number>(profile?.ai_settings?.min_match_score || 70);
  const [appMode, setAppMode] = useState<"review_before_submit" | "full_auto">(
    (profile?.ai_settings?.application_mode as "review_before_submit" | "full_auto") || "review_before_submit"
  );
  const [autoResume, setAutoResume] = useState<boolean>(profile?.ai_settings?.resume_auto_upload ?? true);
  const [ghostCursor, setGhostCursor] = useState<boolean>(profile?.ai_settings?.enable_ghost_cursor ?? false);
  const [cursorColor, setCursorColor] = useState<string>(profile?.ai_settings?.cursor_color || "#F59E0B");
  const [cursorStyle, setCursorStyle] = useState<"figma_arrow" | "modern_wedge" | "glowing_orb" | "co_pilot_hand">(
    profile?.ai_settings?.cursor_style || "figma_arrow"
  );
  const [showStream, setShowStream] = useState<boolean>(profile?.ai_settings?.show_reasoning_stream ?? true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  const [apiKey, setApiKey] = useState<string>(profile?.ai_settings?.gemini_api_key || "");
  const [geminiModel, setGeminiModel] = useState<string>(profile?.ai_settings?.gemini_model || "gemini-3.7-flash");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (profile?.ai_settings) {
      setApiKey(profile.ai_settings.gemini_api_key || "");
      setGeminiModel(profile.ai_settings.gemini_model || "gemini-3.7-flash");
      setMaxApps(profile.ai_settings.max_applications_per_day || 10);
      setMinMatch(profile.ai_settings.min_match_score || 70);
      setAppMode(profile.ai_settings.application_mode || "review_before_submit");
      setAutoResume(profile.ai_settings.resume_auto_upload ?? true);
      setGhostCursor(profile.ai_settings.enable_ghost_cursor ?? false);
      setCursorColor(profile.ai_settings.cursor_color || "#F59E0B");
      setCursorStyle(profile.ai_settings.cursor_style || "figma_arrow");
      setShowStream(profile.ai_settings.show_reasoning_stream ?? true);
    }
  }, [profile]);

  const handleTestKey = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: "Please enter an API key first." });
      return;
    }
    try {
      setTestingKey(true);
      setTestResult(null);
      const res = await api.testGeminiKey(apiKey, geminiModel);
      setTestResult(res);
      if (res.success) {
        toast.success("Gemini API connection successful!");
      } else {
        toast.error(`Key test failed: ${res.message}`);
      }
    } catch (err) {
      setTestResult({ success: false, message: "Connection test failed." });
      toast.error("Failed to reach Gemini validation service.");
    } finally {
      setTestingKey(false);
    }
  };

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
    const interval = setInterval(pollSession, 3000);
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
      toast.info("AI Batch Session paused.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to pause: ${msg}`);
    }
  };

  const handleResumeSession = async () => {
    try {
      const res = await api.resumeAISession();
      setSessionStatus(res.session);
      toast.success("AI Batch Session resumed.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to resume: ${msg}`);
    }
  };

  const handleStopSession = async () => {
    try {
      const res = await api.stopAISession();
      setSessionStatus(res.session);
      toast.info("AI Batch Session stopped.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to stop: ${msg}`);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const updatedAiSettings = {
        ...(profile?.ai_settings || {}),
        gemini_api_key: apiKey,
        gemini_model: geminiModel,
        max_applications_per_day: maxApps,
        min_match_score: minMatch,
        application_mode: appMode,
        resume_auto_upload: autoResume,
        enable_ghost_cursor: ghostCursor,
        cursor_color: cursorColor,
        cursor_style: cursorStyle,
        show_reasoning_stream: showStream
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

  const toggleRowExpanded = (idx: number) => {
    setExpandedRows((prev) => ({ ...prev, [idx]: !prev[idx] }));
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
                      Gemini 3.x
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hybrid DOM-First perception, structured reasoning steps, and human-like form navigation.
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
              Tip: You can backtrack reasoning steps in the extension HUD anytime.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Active Job Live Reasoning Stream Section (if active) */}
      {sessionStatus.active && (
        <Card className="border-amber-200/90 shadow-sm bg-amber-50/20 overflow-hidden">
          <CardHeader className="pb-3 border-b border-amber-100 bg-amber-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
                Active Job Reasoning Stream
              </CardTitle>
              <Badge variant="outline" className="bg-amber-100/70 text-amber-800 border-amber-300 font-mono text-xs">
                Live Perception
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-600">
              {sessionStatus.current_job ? `${sessionStatus.current_job.title} @ ${sessionStatus.current_job.company}` : "Active navigation session in progress..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {(!sessionStatus.current_steps || sessionStatus.current_steps.length === 0) ? (
              <div className="p-4 text-center text-slate-500 text-xs italic">
                Inspecting form structure and computing optimal actions...
              </div>
            ) : (
              <div className="space-y-2.5">
                {sessionStatus.current_steps.map((st, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white border border-amber-200/70 shadow-2xs flex items-start gap-3">
                    <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      Step {st.step}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-700">
                          {st.action}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-400">{st.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-medium">{st.reasoning}</p>
                      {st.fields && st.fields.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {st.fields.map((f, fi) => (
                            <span key={fi} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                              ✍️ {f.label || f.selector}: &quot;{f.value || 'selected'}&quot;
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Google Gemini AI Engine & API Key */}
      <Card className="bg-white border-slate-200/90 shadow-sm">
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Google Gemini AI Engine & API Key
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Active multimodal model for parsing ATS application pages, visual form understanding, and authentic answer generation.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
              <label>Gemini API Key</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:text-blue-700 font-mono inline-flex items-center gap-0.5"
              >
                Get free key from Google AI Studio <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestKey}
                disabled={testingKey || !apiKey}
                className="h-8 px-3 text-xs bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 gap-1.5"
              >
                {testingKey ? <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> : <Key className="w-3 h-3 text-blue-600" />}
                <span>Test Connection</span>
              </Button>

              {testResult && (
                <span
                  className={`text-xs font-semibold flex items-center gap-1 ${
                    testResult.success ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {testResult.success ? "Valid Key Connected" : testResult.message}
                </span>
              )}
            </div>
          </div>

          {/* Model Selection */}
          <div className="pt-3 border-t border-slate-100">
            <label className="text-xs text-slate-700 font-medium mb-2 block">Select Active AI Model</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  geminiModel === "gemini-3.7-flash"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="gemini_model_tab"
                  value="gemini-3.7-flash"
                  checked={geminiModel === "gemini-3.7-flash"}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    gemini-3.7-flash
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5 font-semibold">
                      Recommended
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Multimodal vision & agentic reasoning.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  geminiModel === "gemini-3.6-flash"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="gemini_model_tab"
                  value="gemini-3.6-flash"
                  checked={geminiModel === "gemini-3.6-flash"}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">gemini-3.6-flash</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    High-performance workhorse model.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  geminiModel === "gemini-3.5-flash-lite"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="gemini_model_tab"
                  value="gemini-3.5-flash-lite"
                  checked={geminiModel === "gemini-3.5-flash-lite"}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">gemini-3.5-flash-lite</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Ultra-low latency screening model.
                  </div>
                </div>
              </label>
            </div>
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
                  Automatically attaches resume PDF when upload fields are detected.
                </p>
              </div>
              <Switch checked={autoResume} onCheckedChange={setAutoResume} />
            </div>

            <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3.5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <MousePointer className="w-3.5 h-3.5 text-blue-600" />
                    Autonomous Ghost Cursor
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Animates a visual co-pilot cursor across DOM elements during auto-apply.
                  </p>
                </div>
                <Switch checked={ghostCursor} onCheckedChange={setGhostCursor} />
              </div>

              {ghostCursor && (
                <div className="pt-2 border-t border-slate-200/70 space-y-3.5">
                  {/* Interactive Live Cursor Preview Badge */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">Live Cursor Preview</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {CURSOR_STYLES.find(s => s.id === cursorStyle)?.label} &bull; <span className="font-mono text-[11px]" style={{ color: cursorColor }}>{cursorColor}</span>
                      </span>
                    </div>
                    <div className="w-14 h-12 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden">
                      {cursorStyle === 'figma_arrow' && (
                        <svg viewBox="0 0 17 22" className="w-5 h-6 drop-shadow-sm transition-transform duration-200 hover:scale-110" fill="none">
                          <path d="M0.5 0.5V19.5L5.5 14.5H12.5L0.5 0.5Z" fill={cursorColor} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {cursorStyle === 'modern_wedge' && (
                        <svg viewBox="0 0 18 18" className="w-5 h-5 drop-shadow-sm transition-transform duration-200 hover:scale-110" fill="none">
                          <polygon points="1,1 17,7 9,10 6,17" fill={cursorColor} stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {cursorStyle === 'glowing_orb' && (
                        <svg viewBox="0 0 24 24" className="w-6 h-6 transition-transform duration-200 hover:scale-110" fill="none">
                          <circle cx="12" cy="12" r="6" fill={cursorColor}/>
                          <circle cx="12" cy="12" r="9.5" stroke={cursorColor} strokeWidth="1.8" strokeDasharray="3 3"/>
                          <circle cx="12" cy="12" r="2.5" fill="#FFFFFF"/>
                        </svg>
                      )}
                      {cursorStyle === 'co_pilot_hand' && (
                        <svg viewBox="0 0 24 24" className="w-6 h-6 drop-shadow-sm transition-transform duration-200 hover:scale-110" fill="none">
                          <path d="M7 11V4a2 2 0 0 1 4 0v6M11 7.5a2 2 0 0 1 4 0v3.5M15 9a2 2 0 0 1 4 0v3c0 4.418-3.582 8-8 8H9a6 6 0 0 1-6-6v-2.5a2 2 0 0 1 4 0V11" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M7 11V4a2 2 0 0 1 4 0v6M11 7.5a2 2 0 0 1 4 0v3.5M15 9a2 2 0 0 1 4 0v3c0 4.418-3.582 8-8 8H9a6 6 0 0 1-6-6v-2.5a2 2 0 0 1 4 0V11" fill={cursorColor} stroke={cursorColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Cursor Style Options */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                      <Sliders className="w-3 h-3 text-slate-400" />
                      Cursor Shape & Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CURSOR_STYLES.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setCursorStyle(st.id)}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            cursorStyle === st.id
                              ? "border-blue-500 bg-blue-50/50 shadow-2xs ring-1 ring-blue-500/20"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-800 block truncate">{st.label}</span>
                          <span className="text-[10px] text-slate-500 block truncate">{st.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cursor Color Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                      <Palette className="w-3 h-3 text-slate-400" />
                      Cursor Accent Color
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map((col) => (
                        <button
                          key={col.hex}
                          type="button"
                          title={col.name}
                          onClick={() => setCursorColor(col.hex)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            cursorColor.toLowerCase() === col.hex.toLowerCase()
                              ? "scale-115 ring-2 ring-blue-500 ring-offset-2 border-white"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: col.hex }}
                        />
                      ))}
                      {/* Color Picker Input */}
                      <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
                        <input
                          type="color"
                          value={cursorColor}
                          onChange={(e) => setCursorColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                          title="Custom Color"
                        />
                        <Input
                          type="text"
                          value={cursorColor}
                          onChange={(e) => setCursorColor(e.target.value)}
                          className="w-20 h-7 text-[11px] font-mono bg-white border-slate-200 px-2 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

      {/* Today's Application History Log with Expandable Steps */}
      <Card className="border-slate-200/90 shadow-sm bg-white">
        <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Today&apos;s Application Session Log
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Review full AI reasoning steps and decisions made for each job.
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
                    <th className="py-2.5 px-4 w-8"></th>
                    <th className="py-2.5 px-4">Job Title</th>
                    <th className="py-2.5 px-4">Company</th>
                    <th className="py-2.5 px-4">Site / Platform</th>
                    <th className="py-2.5 px-4 text-center">Match</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionStatus.log.map((item, idx) => {
                    const isExpanded = !!expandedRows[idx];
                    const steps = item.reasoning_steps || [];

                    return (
                      <React.Fragment key={idx}>
                        <tr
                          onClick={() => steps.length > 0 && toggleRowExpanded(idx)}
                          className={`hover:bg-slate-50/70 transition-colors ${steps.length > 0 ? 'cursor-pointer' : ''}`}
                        >
                          <td className="py-2.5 px-4 text-slate-400">
                            {steps.length > 0 ? (
                              isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )
                            ) : null}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-1.5">
                            {item.title}
                            {steps.length > 0 && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                                {steps.length} steps
                              </Badge>
                            )}
                          </td>
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

                        {/* Expanded Reasoning Steps List */}
                        {isExpanded && steps.length > 0 && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-6 py-4 border-t border-b border-slate-100">
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                                  <ListTree className="w-3.5 h-3.5 text-blue-600" />
                                  AI Reasoning Timeline ({steps.length} Steps)
                                </div>
                                <div className="space-y-2 pl-2 border-l-2 border-blue-200">
                                  {steps.map((st, si) => (
                                    <div key={si} className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-[11px] font-bold text-blue-600">
                                            Step {st.step}
                                          </span>
                                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-slate-50 text-slate-700">
                                            {st.action}
                                          </Badge>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400">{st.timestamp}</span>
                                      </div>
                                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                        {st.reasoning}
                                      </p>
                                      {st.fields && st.fields.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                          {st.fields.map((f, fi) => (
                                            <span key={fi} className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                                              ✍️ {f.label || f.selector}: &quot;{f.value || 'selected'}&quot;
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
