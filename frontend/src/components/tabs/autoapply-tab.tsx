"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  ShieldAlert,
  Filter,
  Save,
  CheckCircle2,
  Sliders,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface AutoApplyTabProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  isLoading: boolean;
}

export function AutoApplyTab({
  profile,
  onSaveProfile,
  isLoading,
}: AutoApplyTabProps) {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleAutoApplyChange = (
    field: string,
    value: boolean | number | string[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      auto_apply: {
        ...prev.auto_apply,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveProfile(formData);
      toast.success("Auto-Apply settings updated!");
    } catch {
      toast.error("Failed to update auto-apply settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const auto = formData.auto_apply || {
    enabled: false,
    daily_cap: 5,
    match_threshold: 75,
    blacklisted_companies: [],
    blacklisted_keywords: [],
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Master Toggle Banner */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                <CardTitle className="text-base font-bold text-white tracking-tight">
                  Autonomous Auto-Apply Engine
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Automatically submits applications for newly scraped job matches using your authentic PDF resume.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300">
                {auto.enabled ? "Auto-Apply Active" : "Auto-Apply Paused"}
              </span>
              <Switch
                checked={auto.enabled}
                onCheckedChange={(checked) => handleAutoApplyChange("enabled", checked)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1.5">
              <Label htmlFor="daily_cap" className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Daily Application Cap</span>
                <Badge variant="outline" className="text-[10px] font-mono bg-slate-900 text-slate-300 border-slate-700">
                  {auto.daily_cap || 5} per day
                </Badge>
              </Label>
              <Input
                id="daily_cap"
                type="number"
                min={1}
                max={30}
                value={auto.daily_cap ?? 5}
                onChange={(e) => handleAutoApplyChange("daily_cap", parseInt(e.target.value) || 1)}
                className="bg-slate-900 border-slate-800 text-xs text-slate-100 mt-1"
              />
              <span className="text-[11px] text-slate-500">
                Limits automated daily submissions to maintain account safety.
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1.5">
              <Label htmlFor="match_threshold" className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Match Score Threshold</span>
                <Badge variant="outline" className="text-[10px] font-mono bg-slate-900 text-slate-300 border-slate-700">
                  {auto.match_threshold || 75}% match
                </Badge>
              </Label>
              <Input
                id="match_threshold"
                type="number"
                min={50}
                max={100}
                value={auto.match_threshold ?? 75}
                onChange={(e) => handleAutoApplyChange("match_threshold", parseInt(e.target.value) || 50)}
                className="bg-slate-900 border-slate-800 text-xs text-slate-100 mt-1"
              />
              <span className="text-[11px] text-slate-500">
                Minimum keyword and title match required before auto-applying.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Filters & Blacklists */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white tracking-tight">
              Safety Filters & Blacklists
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Prevent automated applications to specific companies, staffing agencies, or unwanted title keywords.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="blacklisted_companies" className="text-xs text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Blacklisted Companies (comma separated)</span>
              </Label>
              <Input
                id="blacklisted_companies"
                value={(auto.blacklisted_companies || []).join(", ")}
                onChange={(e) =>
                  handleAutoApplyChange(
                    "blacklisted_companies",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. Acme Staffing, AgencyX, CyberRecruit"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="blacklisted_keywords" className="text-xs text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Blacklisted Title Keywords (comma separated)</span>
              </Label>
              <Input
                id="blacklisted_keywords"
                value={(auto.blacklisted_keywords || []).join(", ")}
                onChange={(e) =>
                  handleAutoApplyChange(
                    "blacklisted_keywords",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. unpaid, intern, commission-only, cold calling"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Action */}
      <div className="flex items-center justify-end">
        <Button
          type="submit"
          disabled={isSaving || isLoading}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? "Saving..." : "Save Auto-Apply Configuration"}</span>
        </Button>
      </div>
    </form>
  );
}
