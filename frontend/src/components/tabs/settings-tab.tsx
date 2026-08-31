"use client";

import React, { useState, useEffect } from "react";
import { DaemonSettings } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  MessageSquare,
  Save,
  Clock,
  MapPin,
  Sliders,
  Power,
  RefreshCw,
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
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="keywords" className="text-xs text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Job Search Keywords (comma separated)</span>
              </Label>
              <Input
                id="keywords"
                value={(formData.keywords || []).join(", ")}
                onChange={(e) =>
                  handleChange(
                    "keywords",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. software engineer, frontend developer, react developer, python"
              />
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
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 shadow-sm"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaving ? "Saving..." : "Save Settings"}</span>
        </Button>
      </div>
    </form>
  );
}
