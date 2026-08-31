"use client";

import React, { useState, useEffect } from "react";
import { DaemonSettings } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  MessageSquare,
  Save,
  Clock,
  MapPin,
  Sliders,
  Power,
  RefreshCw,
  Plus,
  X,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

interface SettingsTabProps {
  settings: DaemonSettings;
  onSaveSettings: (settings: DaemonSettings) => Promise<void>;
  isLoading: boolean;
}

export function SettingsTab({
  settings,
  onSaveSettings,
  isLoading,
}: SettingsTabProps) {
  const [formData, setFormData] = useState<DaemonSettings>(settings);
  const [keywordInput, setKeywordInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (field: string, value: string | number | string[] | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddKeyword = (rawText?: string) => {
    const textToAdd = rawText !== undefined ? rawText : keywordInput;
    if (!textToAdd.trim()) return;

    // Split on commas or semicolons in case user pasted multiple
    const tokens = textToAdd
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const currentKeywords = formData.keywords || [];
    const lowerExisting = new Set(currentKeywords.map((k) => k.toLowerCase()));

    const newKeywords = [...currentKeywords];
    for (const token of tokens) {
      if (!lowerExisting.has(token.toLowerCase())) {
        newKeywords.push(token);
        lowerExisting.add(token.toLowerCase());
      }
    }

    handleChange("keywords", newKeywords);
    setKeywordInput("");
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    const nextKeywords = (formData.keywords || []).filter((_, idx) => idx !== indexToRemove);
    handleChange("keywords", nextKeywords);
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddKeyword();
    } else if (e.key === "Backspace" && !keywordInput && (formData.keywords || []).length > 0) {
      e.preventDefault();
      handleRemoveKeyword((formData.keywords || []).length - 1);
    }
  };

  const handleKeywordPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes(",") || pasted.includes("\n") || pasted.includes(";")) {
      e.preventDefault();
      handleAddKeyword(pasted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const keywords = formData.keywords || [];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Search & Daemon Settings */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white tracking-tight">
              Search & Alert Configuration
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Configure target keywords, scraping intervals, and iMessage notification destination.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Interactive Keyword Badges / Pills Input */}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="keyword-input" className="text-xs text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Job Search Keywords</span>
                </div>
                <span className="text-[11px] text-indigo-400 font-mono">
                  {keywords.length} active keyword{keywords.length === 1 ? "" : "s"}
                </span>
              </Label>

              {/* Tag / Pill Box */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 min-h-[46px] rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500/80 transition-colors shadow-inner">
                {keywords.map((kw, idx) => (
                  <span
                    key={`${kw}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs font-medium group transition-all hover:border-indigo-400/50"
                  >
                    <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(idx)}
                      className="p-0.5 text-indigo-400 hover:text-white hover:bg-indigo-500/30 rounded transition-colors"
                      title={`Remove "${kw}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <input
                    id="keyword-input"
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    onPaste={handleKeywordPaste}
                    placeholder={
                      keywords.length === 0
                        ? "Type a keyword and press Enter or comma (e.g. React Developer)..."
                        : "Add another keyword + Enter..."
                    }
                    className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none px-1 py-1"
                  />

                  {keywordInput.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddKeyword()}
                      className="h-6 px-2 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Type a role or skill and press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] border border-slate-700">Enter</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] border border-slate-700">,</kbd> to convert it into a pill. Pressing <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] border border-slate-700">Backspace</kbd> on an empty input deletes the last pill.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location" className="text-xs text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Search Location</span>
              </Label>
              <Input
                id="location"
                value={formData.location || "Philippines"}
                onChange={(e) => handleChange("location", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. Philippines, Remote"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="check_interval" className="text-xs text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Scrape Interval (minutes)</span>
              </Label>
              <Input
                id="check_interval"
                type="number"
                min={5}
                max={1440}
                value={formData.check_interval_minutes ?? 60}
                onChange={(e) => handleChange("check_interval_minutes", parseInt(e.target.value) || 60)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="recipient" className="text-xs text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                  <span>iMessage Recipients (Broadcast List)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-normal">Comma-separated</span>
              </Label>
              <Input
                id="recipient"
                value={formData.recipient || ""}
                onChange={(e) => handleChange("recipient", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500"
                placeholder="e.g. fravfore@gmail.com, +639171234567, colleague@icloud.com"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enter one or multiple phone numbers or Apple ID emails. Tracky will broadcast new job alerts to all verified recipients.
              </p>
            </div>

            {/* Daemon State Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 sm:col-span-2 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <Power className={`w-4 h-4 ${formData.paused ? "text-amber-400" : "text-emerald-400"}`} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">Scanner Daemon Status</span>
                  <span className="text-[11px] text-slate-400">
                    {formData.paused ? "Paused — background scanning is inactive" : "Active — periodically discovering new jobs"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  {formData.paused ? "Paused" : "Active"}
                </span>
                <Switch
                  checked={!formData.paused}
                  onCheckedChange={(checked) => handleChange("paused", !checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          disabled={isSaving || isLoading}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 shadow-sm shadow-indigo-600/30"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaving ? "Saving..." : "Save Settings"}</span>
        </Button>
      </div>
    </form>
  );
}
