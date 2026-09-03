"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Puzzle,
  Key,
  MousePointer,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  Check,
  Layers,
} from "lucide-react";

export function TutorialTab() {
  return (
    <div className="flex flex-col gap-6">
      {/* Overview Card */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <CardTitle className="text-base font-bold text-white tracking-tight">
                AI Auto-Applier Extension Guide
              </CardTitle>
            </div>
            <Badge variant="outline" className="bg-indigo-500/15 border-indigo-500/30 text-indigo-300 text-xs font-mono py-0.5 px-2.5">
              Manifest V3
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Complete walkthrough on installing the Tracky Chrome Extension, configuring Gemini AI reasoning, and auto-applying to scraped job listings in your authenticated browser session.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 4 Step Sequential Cards */}
      <div className="flex flex-col gap-4">
        {/* Step 1: Install Extension */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                1
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-indigo-400" />
                    Load the Tracky Chrome Extension
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">One-time setup</span>
                </div>

                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Open Google Chrome (or Arc / Brave / Edge) and type{" "}
                    <code className="bg-slate-950 px-2 py-0.5 rounded-md text-indigo-300 font-mono text-[11px] border border-slate-800">
                      chrome://extensions
                    </code>{" "}
                    in the address bar.
                  </li>
                  <li>
                    Turn <strong className="text-white">ON</strong> the <strong className="text-white">Developer mode</strong> toggle in the top-right corner.
                  </li>
                  <li>
                    Click the <strong className="text-white">Load unpacked</strong> button in the top-left toolbar.
                  </li>
                  <li>
                    Select the <code className="bg-slate-950 px-2 py-0.5 rounded-md text-indigo-300 font-mono text-[11px] border border-slate-800">extension</code> folder inside your Tracky project directory:
                    <div className="mt-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-400 select-all">
                      /Users/ravforejinoeflores/Documents/antigravity/joyful-bose/extension
                    </div>
                  </li>
                  <li>
                    Click the Puzzle icon in Chrome&apos;s toolbar and <strong className="text-white">Pin</strong> Tracky 🐶 for quick access.
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Configure Profile & Gemini API Key */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                2
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    Configure Candidate Profile & Gemini AI
                  </h3>
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-2 font-mono">
                    gemini-3.7-flash
                  </Badge>
                </div>

                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Go to the <strong className="text-white">Profile & Resume</strong> tab in this dashboard.
                  </li>
                  <li>
                    Upload your <strong className="text-white">Resume PDF</strong> to automatically extract candidate details, skills, and summary.
                  </li>
                  <li>
                    Enter your <strong className="text-white">Google Gemini API Key</strong> (get a free key from{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-0.5"
                    >
                      Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                    ) and click <strong className="text-white">Test Connection</strong>.
                  </li>
                  <li>
                    Review your screening defaults (expected monthly salary, hourly rate, notice period) and click <strong className="text-white">Save Candidate Profile</strong>.
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Auto-Applying with Authenticated Session */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                3
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    Auto-Apply in Your Authentic Browser Session
                  </h3>
                  <Badge variant="outline" className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[10px] py-0 px-2 font-mono">
                    Zero 2FA Friction
                  </Badge>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Because Tracky runs directly inside your everyday Chrome browser, it uses your authentic logged-in cookies and passes all Cloudflare / 2FA challenges seamlessly.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs font-semibold text-white">Option A: 1-Click from Dashboard</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Click the <strong className="text-indigo-300">⚡ Apply</strong> button next to any job in the Jobs Feed to open the listing in Chrome.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs font-semibold text-white">Option B: In-Page HUD / Side Panel</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Navigate to any job on LinkedIn, OnlineJobs, Indeed, or JobStreet and click the floating <strong className="text-indigo-300">⚡ Auto-Apply</strong> pill.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Ghost Cursor & Review Mode */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                4
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <MousePointer className="w-4 h-4 text-indigo-400" />
                    Visual Ghost Cursor & Safe Review Mode
                  </h3>
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-2 font-mono">
                    Non-Blocking
                  </Badge>
                </div>

                <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                  <p>
                    <strong className="text-white">Visual Ghost Cursor:</strong> A glowing cursor navigates smoothly along bezier paths to form inputs and simulates human typing cadence with click ripples.
                  </p>

                  <div className="flex items-center gap-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong className="text-slate-200">Zero Mouse Interference:</strong> The ghost cursor uses <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono">pointer-events: none</code>. You can move your actual mouse, click anywhere, or switch tabs freely.
                    </span>
                  </div>

                  <p>
                    <strong className="text-white">Review Mode (Default):</strong> Auto-fills every question and pauses on the final review screen so you can inspect everything before a final 1-click confirmation.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
