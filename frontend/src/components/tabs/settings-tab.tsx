"use client";

import React, { useState, useEffect } from "react";
import { DaemonSettings, BrowserInfo } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Compass, ShieldCheck, CircleDot, Flame, Sparkles, Layers, Check } from "lucide-react";

interface SettingsTabProps {
  settings: DaemonSettings;
  browsers?: BrowserInfo[];
  onSaveSettings: (s: DaemonSettings) => Promise<void>;
  isSaving: boolean;
}

export function SettingsTab({ settings, browsers = [], onSaveSettings, isSaving }: SettingsTabProps) {
  const [keywordsText, setKeywordsText] = useState((settings.keywords || []).join("\n"));
  const [location, setLocation] = useState(settings.location || "Philippines");
  const [interval, setIntervalVal] = useState(settings.check_interval_minutes || 60);
  const [recipient, setRecipient] = useState(settings.recipient || "");
  const [geminiApiKey, setGeminiApiKey] = useState(settings.gemini_api_key || "");
  const [preferredBrowser, setPreferredBrowser] = useState(settings.preferred_browser || "brave");

  useEffect(() => {
    if (settings.preferred_browser) {
      setPreferredBrowser(settings.preferred_browser);
    }
  }, [settings.preferred_browser]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywordsList = keywordsText
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    const updated: DaemonSettings = {
      ...settings,
      keywords: keywordsList,
      location,
      check_interval_minutes: interval,
      recipient,
      gemini_api_key: geminiApiKey.trim(),
      preferred_browser: preferredBrowser,
    };

    await onSaveSettings(updated);
  };

  return (
    <Card className="max-w-3xl bg-slate-900/60 border-slate-800 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-base">⚙️ Search & Daemon Configuration</CardTitle>
        <CardDescription className="text-xs">
          Configure search queries, default browser, background scraping interval, Gemini AI API key, and your iMessage recipient.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Default Browser Selector */}
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-200">Default Interactive & Login Browser</Label>
              <span className="text-[11px] text-slate-400">Used for 1-click platform account logins</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {browsers.map((b) => {
                const isSelected = b.id === preferredBrowser;
                return (
                  <button
                    type="button"
                    key={b.id}
                    disabled={!b.installed}
                    onClick={() => setPreferredBrowser(b.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all ${
                      isSelected
                        ? "bg-indigo-600/25 border-indigo-500/80 text-white ring-1 ring-indigo-500/40"
                        : b.installed
                        ? "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/90 hover:text-white"
                        : "bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getBrowserIcon(b.id)}
                      <span className="font-medium truncate">{b.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gemini_key">Google Gemini API Key (GEMINI_API_KEY)</Label>
            <Input
              id="gemini_key"
              type="password"
              placeholder="AIzaSy..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
            />
            <span className="text-[11px] text-slate-500">
              Used to automatically analyze uploaded PDF resumes and populate profile & screening Q&A fields. You can also export <code className="font-mono text-indigo-400">GEMINI_API_KEY</code> in your environment.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="keywords">Job Search Keywords (One per line)</Label>
            <Textarea
              id="keywords"
              rows={5}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="software engineer&#10;frontend developer&#10;react developer"
            />
            <span className="text-[11px] text-slate-500">
              Each keyword is queried against Indeed.ph, JobStreet.ph, and OnlineJobs.ph.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Search Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Philippines or Remote"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interval">Scrape Interval (Minutes)</Label>
              <Input
                id="interval"
                type="number"
                min="5"
                value={interval}
                onChange={(e) => setIntervalVal(parseInt(e.target.value) || 60)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recipient">iMessage Alert Recipient (Phone number or Apple ID email)</Label>
            <Input
              id="recipient"
              placeholder="+639171234567 or user@icloud.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <span className="text-[11px] text-slate-500">
              Job alerts and 1-click apply commands are delivered directly to this iMessage address.
            </span>
          </div>

          <Button type="submit" disabled={isSaving} className="self-end gap-2 mt-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Daemon Settings</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
