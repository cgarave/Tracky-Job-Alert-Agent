"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

interface ScreeningTabProps {
  profile: UserProfile;
  onSaveProfile: (p: UserProfile) => Promise<void>;
  isSaving: boolean;
}

export function ScreeningTab({ profile, onSaveProfile, isSaving }: ScreeningTabProps) {
  const [workPrefs, setWorkPrefs] = useState(profile.work_preferences);
  const [screeningQA, setScreeningQA] = useState(profile.screening_answers);
  const [skillsStr, setSkillsStr] = useState((profile.work_preferences.skills || []).join(", "));

  useEffect(() => {
    setWorkPrefs(profile.work_preferences);
    setScreeningQA(profile.screening_answers);
    setSkillsStr((profile.work_preferences.skills || []).join(", "));
  }, [profile]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const skillsList = skillsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: UserProfile = {
      ...profile,
      work_preferences: {
        ...workPrefs,
        skills: skillsList,
      },
      screening_answers: screeningQA,
    };

    await onSaveProfile(updated);
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle className="text-base">📝 Screening & Work Preferences</CardTitle>
        <CardDescription className="text-xs">
          Pre-configure standard responses for common employer questions (salary expectations, notice period, and technical background).
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Numbers Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="experience">Years of Experience</Label>
              <Input
                id="experience"
                type="number"
                min="0"
                max="40"
                value={workPrefs.years_of_experience || 0}
                onChange={(e) =>
                  setWorkPrefs((prev) => ({
                    ...prev,
                    years_of_experience: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salary">Expected Monthly Salary (PHP)</Label>
              <Input
                id="salary"
                placeholder="e.g. 120000"
                value={workPrefs.expected_salary_php || ""}
                onChange={(e) =>
                  setWorkPrefs((prev) => ({
                    ...prev,
                    expected_salary_php: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notice">Notice Period (Weeks)</Label>
              <Input
                id="notice"
                type="number"
                min="0"
                max="12"
                value={workPrefs.notice_period_weeks || 4}
                onChange={(e) =>
                  setWorkPrefs((prev) => ({
                    ...prev,
                    notice_period_weeks: parseInt(e.target.value) || 4,
                  }))
                }
              />
            </div>
          </div>

          {/* Preferences Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth">Work Authorization</Label>
              <Input
                id="auth"
                value={workPrefs.work_authorization || ""}
                onChange={(e) =>
                  setWorkPrefs((prev) => ({
                    ...prev,
                    work_authorization: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="remote">Workplace Preference</Label>
              <select
                id="remote"
                value={workPrefs.remote_preference || "Remote / Hybrid"}
                onChange={(e) =>
                  setWorkPrefs((prev) => ({
                    ...prev,
                    remote_preference: e.target.value,
                  }))
                }
                className="h-10 px-3.5 rounded-lg border border-white/10 bg-slate-950/60 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Remote / Hybrid">Remote / Hybrid</option>
                <option value="Fully Remote">Fully Remote Only</option>
                <option value="On-site / Hybrid">On-site / Hybrid</option>
              </select>
            </div>
          </div>

          {/* Skills Input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skills">Key Skills (Comma separated)</Label>
            <Input
              id="skills"
              placeholder="Python, FastAPI, React, TypeScript, SQL, Docker"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
            />
            <span className="text-[11px] text-slate-400">
              Used to match job descriptions and automatically highlight strengths in application letters.
            </span>
          </div>

          {/* Screening Free-Form Answers */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="why_hire">Standard "Why should we hire you?" Pitch Note</Label>
            <Textarea
              id="why_hire"
              rows={4}
              placeholder="Summarize your key achievements, reliability, and value proposition..."
              value={screeningQA.why_hire_me || ""}
              onChange={(e) =>
                setScreeningQA((prev) => ({ ...prev, why_hire_me: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="salary_note">Salary Expectation Note</Label>
            <Input
              id="salary_note"
              placeholder="e.g. My expected salary is negotiable depending on overall benefits package."
              value={screeningQA.salary_expectation || ""}
              onChange={(e) =>
                setScreeningQA((prev) => ({
                  ...prev,
                  salary_expectation: e.target.value,
                }))
              }
            />
          </div>

          <Button type="submit" disabled={isSaving} className="self-end gap-2 mt-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Screening Preferences</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
