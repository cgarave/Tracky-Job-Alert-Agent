"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Puzzle,
  Key,
  MousePointer,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

export function TutorialTab() {
  return (
    <div className="flex flex-col gap-6">
      {/* Overview Card */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                AI Auto-Applier Extension Guide
              </CardTitle>
            </div>
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-xs font-mono py-0.5 px-2.5 font-semibold">
              Manifest V3
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Complete walkthrough on installing the Tracky Chrome Extension, configuring Gemini AI reasoning, and auto-applying to scraped job listings in your authenticated browser session.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 4 Step Sequential Cards */}
      <div className="flex flex-col gap-4">
        {/* Step 1: Install Extension */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                1
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-blue-600" />
                    Load the Tracky Chrome Extension
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">One-time setup</span>
                </div>

                <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Open Google Chrome (or Arc / Brave / Edge) and type{" "}
                    <code className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-800 font-mono text-[11px] border border-slate-200">
                      chrome://extensions
                    </code>{" "}
                    in the address bar.
                  </li>
                  <li>
                    Turn <strong className="text-slate-900 font-semibold">ON</strong> the <strong className="text-slate-900 font-semibold">Developer mode</strong> toggle in the top-right corner.
                  </li>
                  <li>
                    Click the <strong className="text-slate-900 font-semibold">Load unpacked</strong> button in the top-left toolbar.
                  </li>
                  <li>
                    Select the <code className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-800 font-mono text-[11px] border border-slate-200">extension</code> folder inside your Tracky project directory:
                    <div className="mt-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-600 select-all">
                      /Users/ravforejinoeflores/Documents/antigravity/joyful-bose/extension
                    </div>
                  </li>
                  <li>
                    Click the Puzzle icon in Chrome&apos;s toolbar and <strong className="text-slate-900 font-semibold">Pin</strong> Tracky 🐶 for quick access.
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Configure Profile & Gemini API Key */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                2
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    Configure Candidate Profile & Gemini AI
                  </h3>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-2 font-mono font-semibold">
                    gemini-3.7-flash
                  </Badge>
                </div>

                <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Go to the <strong className="text-slate-900 font-semibold">Profile & Resume</strong> tab in this dashboard.
                  </li>
                  <li>
                    Upload your <strong className="text-slate-900 font-semibold">Resume PDF</strong> to automatically extract candidate details, skills, and summary.
                  </li>
                  <li>
                    Enter your <strong className="text-slate-900 font-semibold">Google Gemini API Key</strong> (get a free key from{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline font-medium inline-flex items-center gap-0.5"
                    >
                      Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                    ) and click <strong className="text-slate-900 font-semibold">Test Connection</strong>.
                  </li>
                  <li>
                    Review your screening defaults (expected monthly salary, hourly rate, notice period) and click <strong className="text-slate-900 font-semibold">Save Candidate Profile</strong>.
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Auto-Applying with Authenticated Session */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                3
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    Auto-Apply in Your Authentic Browser Session
                  </h3>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-2 font-mono font-semibold">
                    Zero 2FA Friction
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Because Tracky runs directly inside your everyday Chrome browser, it uses your authentic logged-in cookies and passes all Cloudflare / 2FA challenges seamlessly.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-xs font-bold text-slate-900">Option A: 1-Click from Dashboard</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Click the <strong className="text-blue-700 font-semibold">⚡ Apply</strong> button next to any job in the Jobs Feed to open the listing in Chrome.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-xs font-bold text-slate-900">Option B: In-Page HUD / Side Panel</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Navigate to any job on LinkedIn, OnlineJobs, Indeed, or JobStreet and click the floating <strong className="text-blue-700 font-semibold">⚡ Auto-Apply</strong> pill.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Ghost Cursor & Review Mode */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                4
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <MousePointer className="w-4 h-4 text-blue-600" />
                    Visual Ghost Cursor & Safe Review Mode
                  </h3>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-2 font-mono font-semibold">
                    Non-Blocking
                  </Badge>
                </div>

                <div className="text-xs text-slate-700 space-y-2.5 leading-relaxed">
                  <p>
                    <strong className="text-slate-900 font-semibold">Visual Ghost Cursor:</strong> A glowing cursor navigates smoothly along bezier paths to form inputs and simulates human typing cadence with click ripples.
                  </p>

                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong className="text-slate-900 font-semibold">Zero Mouse Interference:</strong> The ghost cursor uses <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 font-mono">pointer-events: none</code>. You can move your actual mouse, click anywhere, or switch tabs freely.
                    </span>
                  </div>

                  <p>
                    <strong className="text-slate-900 font-semibold">Review Mode (Default):</strong> Auto-fills every question and pauses on the final review screen so you can inspect everything before a final 1-click confirmation.
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
