"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Sliders,
  Shield,
  Clock,
  DollarSign,
  Save,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface ScreeningTabProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  isLoading: boolean;
}

export function ScreeningTab({
  profile,
  onSaveProfile,
  isLoading,
}: ScreeningTabProps) {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleQAChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      screening_answers: {
        ...prev.screening_answers,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveProfile(formData);
      toast.success("Screening Q&A answers saved successfully!");
    } catch {
      toast.error("Failed to save screening answers.");
    } finally {
      setIsSaving(false);
    }
  };

  const qa = formData.screening_answers || {};

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white tracking-tight">
              Screening & Work Preferences
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Configure standardized answers to common employer screening questionnaires for Indeed, JobStreet, and OnlineJobs.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notice_period" className="text-xs text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Notice Period / Availability</span>
              </Label>
              <Input
                id="notice_period"
                value={qa.notice_period || "30 days"}
                onChange={(e) => handleQAChange("notice_period", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. Immediate, 15 days, 30 days"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="work_auth" className="text-xs text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>Work Authorization</span>
              </Label>
              <Input
                id="work_auth"
                value={qa.work_authorization || "Yes (Filipino Citizen)"}
                onChange={(e) => handleQAChange("work_authorization", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. Yes (Filipino Citizen)"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shift_pref" className="text-xs text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Shift & Schedule Preference</span>
              </Label>
              <Input
                id="shift_pref"
                value={qa.shift_preference || "Flexible / Day / Night Shift"}
                onChange={(e) => handleQAChange("shift_preference", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. Day shift, US hours, Flexible"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="portfolio_url" className="text-xs text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Portfolio / GitHub / Website URL</span>
              </Label>
              <Input
                id="portfolio_url"
                value={qa.portfolio_url || ""}
                onChange={(e) => handleQAChange("portfolio_url", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. https://github.com/username"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="why_hire_me" className="text-xs text-slate-300">
                Default Cover Pitch & Value Proposition (Why Hire Me)
              </Label>
              <Textarea
                id="why_hire_me"
                rows={4}
                value={qa.why_hire_me || ""}
                onChange={(e) => handleQAChange("why_hire_me", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100 font-sans leading-relaxed"
                placeholder="Describe your core strengths, project achievements, and value proposition for prospective employers."
              />
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
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? "Saving..." : "Save Screening Q&A"}</span>
        </Button>
      </div>
    </form>
  );
}
