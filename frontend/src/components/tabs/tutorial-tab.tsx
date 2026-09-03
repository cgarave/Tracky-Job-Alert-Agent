"use client";

import React from "react";
import {
  BookOpen,
  Globe,
  Puzzle,
  Key,
  MousePointer,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

export function TutorialTab() {
  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-primary" />
          How-To Guide: AI Browser Extension Auto-Applier
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Step-by-step instructions to set up the Tracky Chrome Extension, configure Gemini AI, and auto-apply to jobs using your authentic browser session.
        </p>
      </div>

      {/* 4-Step Cards */}
      <div className="space-y-6">
        {/* Step 1 */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              1
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-primary" />
                  Load the Tracky Chrome Extension (One-time Setup)
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  Manifest V3
                </span>
              </div>

              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Open Google Chrome (or Arc / Brave / Edge) and type{" "}
                  <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground font-mono">chrome://extensions</code> in the URL bar.
                </li>
                <li>
                  Turn <strong>ON</strong> the <strong>Developer mode</strong> toggle located at the top-right corner.
                </li>
                <li>
                  Click the <strong>Load unpacked</strong> button at the top-left.
                </li>
                <li>
                  Select the <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground font-mono">extension</code> folder located inside your Tracky project directory.
                </li>
                <li>
                  Click the Puzzle icon (Extensions menu) in Chrome&apos;s toolbar and <strong>Pin</strong> Tracky 🐶 for easy access.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              2
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  Upload Resume & Configure Gemini AI Key
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  gemini-3.7-flash
                </span>
              </div>

              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Go to the <strong>Profile & Resume</strong> tab in this dashboard.
                </li>
                <li>
                  Upload your <strong>Resume PDF</strong> to automatically extract your skills, title, and contact details.
                </li>
                <li>
                  Paste your <strong>Gemini API Key</strong> (get one free from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                  ) and click <strong>Test Connection</strong>.
                </li>
                <li>
                  Review your screening defaults (expected monthly salary, hourly rate, notice period) and click <strong>Save Profile</strong>.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              3
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Auto-Apply in Your Authentic Browser Session
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                  Zero Login Friction
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Because Tracky runs as an extension in your active browser, it uses your authentic logged-in cookies and passes all 2FA / Cloudflare checks seamlessly.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-secondary/30 rounded-lg border border-border space-y-1">
                  <span className="text-xs font-semibold text-foreground">Option A: 1-Click from Dashboard</span>
                  <p className="text-[11px] text-muted-foreground">
                    Click the <strong>⚡ Apply with Extension</strong> button next to any job in the Jobs tab to open the listing in Chrome.
                  </p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg border border-border space-y-1">
                  <span className="text-xs font-semibold text-foreground">Option B: Side Panel / Floating Pill</span>
                  <p className="text-[11px] text-muted-foreground">
                    Navigate to any job on LinkedIn, OnlineJobs, Indeed, or JobStreet and click the floating <strong>⚡ Auto-Apply</strong> pill.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              4
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <MousePointer className="w-4 h-4 text-primary" />
                  Visual Ghost Cursor & Review Mode
                </h3>
              </div>

              <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  <strong>Visual Ghost Cursor:</strong> A glowing cursor will navigate smoothly to form inputs, radio buttons, and text areas, simulating natural human typing with click ripples.
                </p>
                <div className="flex items-center gap-2 p-2.5 bg-secondary/20 rounded-lg border border-border text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    <strong>Non-Blocking:</strong> The ghost cursor uses <code className="font-mono">pointer-events: none</code>. You can move your actual mouse, click anywhere, or switch tabs without losing control.
                  </span>
                </div>
                <p>
                  <strong>Review Mode (Default):</strong> Fills every step and pauses on the final review screen so you can inspect everything before a final 1-click confirmation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
