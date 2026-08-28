"use client";

import React, { useState, useEffect } from "react";
import { DaemonSettings } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Settings,
  MessageSquare,
  Key,
  Save,
  Clock,
  MapPin,
  Sliders,
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
              Search & Daemon Configuration
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Configure target keywords, scraping intervals, and notification endpoints.
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recipient" className="text-xs text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>iMessage Recipient (Phone / Apple ID)</span>
              </Label>
              <Input
                id="recipient"
                value={formData.recipient || ""}
                onChange={(e) => handleChange("recipient", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. +639123456789 or name@icloud.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Intelligence Config */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white tracking-tight">
              AI Parser Key (Optional)
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Provide a Google Gemini API key to enable AI-powered PDF resume parsing and profile auto-fill.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gemini_api_key" className="text-xs text-slate-300">
              Gemini API Key
            </Label>
            <Input
              id="gemini_api_key"
              type="password"
              value={formData.gemini_api_key || ""}
              onChange={(e) => handleChange("gemini_api_key", e.target.value)}
              className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              placeholder="AIzaSy..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          disabled={isSaving || isLoading}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? "Saving..." : "Save Settings"}</span>
        </Button>
      </div>
    </form>
  );
}
