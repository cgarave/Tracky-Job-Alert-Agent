"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  MousePointer,
  Save,
  Plus,
  X,
  ShieldCheck,
  Briefcase,
  User,
  DollarSign,
  Clock,
  Loader2,
} from "lucide-react";
import { CandidateProfile } from "@/types";
import { fetchProfile, saveProfile, uploadResume, testGeminiKey } from "@/lib/api";

export function ProfileTab() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // API Key & Model testing
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Skill tag input
  const [skillInput, setSkillInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCandidateProfile();
  }, []);

  async function loadCandidateProfile() {
    try {
      setLoading(true);
      const data = await fetchProfile();
      setProfile(data);
    } catch (e) {
      console.error("Failed to load profile:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    try {
      setSaving(true);
      setSaveSuccess(false);
      await saveProfile(profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (e) {
      console.error("Failed to save profile:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await uploadResume(file.name, base64);
        setProfile(res.profile);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to upload resume:", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleTestKey() {
    const apiKey = profile?.ai_settings?.gemini_api_key;
    const model = profile?.ai_settings?.gemini_model || "gemini-3.7-flash";
    if (!apiKey) {
      setTestResult({ success: false, message: "Please enter an API key first." });
      return;
    }

    try {
      setTestingKey(true);
      setTestResult(null);
      const res = await testGeminiKey(apiKey, model);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "Failed to test API key" });
    } finally {
      setTestingKey(false);
    }
  }

  function handleAddSkill() {
    if (!skillInput.trim() || !profile) return;
    const trimmed = skillInput.trim();
    if (!profile.skills.includes(trimmed)) {
      setProfile({
        ...profile,
        skills: [...profile.skills, trimmed],
      });
    }
    setSkillInput("");
  }

  function handleRemoveSkill(skill: string) {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skill),
    });
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <User className="w-6 h-6 text-primary" />
            Candidate Profile & AI Co-Pilot
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your resume details, Gemini AI screening defaults, and browser extension settings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved successfully
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Profile
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Resume Upload & Candidate Info (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resume PDF Uploader */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Resume PDF Parser
              </h2>
              {profile.resume_filename && (
                <span className="text-xs font-medium bg-secondary px-2.5 py-1 rounded-md text-secondary-foreground">
                  Active: {profile.resume_filename}
                </span>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="application/pdf"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/50 bg-secondary/30 hover:bg-secondary/60 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {uploading ? "Extracting skills from resume..." : "Click to upload resume PDF"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically extracts your contact info, work summary, and tech skills.
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Candidate Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Current Title</label>
                <input
                  type="text"
                  value={profile.current_title}
                  onChange={(e) => setProfile({ ...profile, current_title: e.target.value })}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="juan@example.com"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone / Mobile</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+63 917 123 4567"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  placeholder="Manila, Philippines"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={profile.years_of_experience}
                  onChange={(e) => setProfile({ ...profile, years_of_experience: Number(e.target.value) })}
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Profile URLs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">LinkedIn URL</label>
                <input
                  type="text"
                  value={profile.linkedin_url || ""}
                  onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full mt-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">GitHub URL</label>
                <input
                  type="text"
                  value={profile.github_url || ""}
                  onChange={(e) => setProfile({ ...profile, github_url: e.target.value })}
                  placeholder="https://github.com/..."
                  className="w-full mt-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Portfolio URL</label>
                <input
                  type="text"
                  value={profile.portfolio_url || ""}
                  onChange={(e) => setProfile({ ...profile, portfolio_url: e.target.value })}
                  placeholder="https://myportfolio.dev"
                  className="w-full mt-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Skills Badges */}
            <div className="pt-2">
              <label className="text-xs font-medium text-muted-foreground">Tech Skills & Badges</label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 bg-secondary/20 border border-border rounded-lg min-h-[50px]">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-xs font-medium px-2.5 py-1 rounded-md border border-primary/25"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="hover:text-red-400 focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Add skill..."
                    className="bg-transparent border-none text-xs text-foreground focus:outline-none w-28 px-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Screening Defaults */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Screening Question Presets
            </h2>
            <p className="text-xs text-muted-foreground">
              These values are automatically used by Gemini AI when filling platform questionnaires.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Monthly Salary Expectation (PHP)</label>
                <input
                  type="text"
                  value={profile.screening_defaults?.expected_salary_monthly_php || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      screening_defaults: {
                        ...profile.screening_defaults,
                        expected_salary_monthly_php: e.target.value,
                      },
                    })
                  }
                  placeholder="80,000 - 120,000"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Hourly Rate Expectation (USD)</label>
                <input
                  type="text"
                  value={profile.screening_defaults?.expected_salary_hourly_usd || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      screening_defaults: {
                        ...profile.screening_defaults,
                        expected_salary_hourly_usd: e.target.value,
                      },
                    })
                  }
                  placeholder="25"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notice Period (weeks)</label>
                <input
                  type="text"
                  value={profile.screening_defaults?.notice_period_weeks || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      screening_defaults: {
                        ...profile.screening_defaults,
                        notice_period_weeks: e.target.value,
                      },
                    })
                  }
                  placeholder="2"
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Legally Authorized to Work?</label>
                <select
                  value={profile.screening_defaults?.work_authorization || "Yes"}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      screening_defaults: {
                        ...profile.screening_defaults,
                        work_authorization: e.target.value,
                      },
                    })
                  }
                  className="w-full mt-1.5 px-3.5 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Model Settings & Ghost Cursor (1 col) */}
        <div className="space-y-6">
          {/* Gemini AI Settings Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Google Gemini AI Engine
            </h2>

            {/* API Key */}
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>Gemini API Key</span>
                <span className="text-[10px] text-primary">Required for AI answering</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={profile.ai_settings?.gemini_api_key || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      ai_settings: {
                        ...profile.ai_settings,
                        gemini_api_key: e.target.value,
                      },
                    })
                  }
                  placeholder="AIzaSy..."
                  className="w-full pl-3.5 pr-10 py-2 bg-background border border-border rounded-lg text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testingKey || !profile.ai_settings?.gemini_api_key}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {testingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Test Connection
                </button>

                {testResult && (
                  <span
                    className={`text-xs font-medium flex items-center gap-1 ${
                      testResult.success ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {testResult.success ? "Valid" : "Invalid Key"}
                  </span>
                )}
              </div>
            </div>

            {/* Model Selection */}
            <div className="pt-2 border-t border-border">
              <label className="text-xs font-medium text-muted-foreground">Select AI Model</label>
              <div className="space-y-2 mt-2">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="gemini_model"
                    value="gemini-3.7-flash"
                    checked={(profile.ai_settings?.gemini_model || "gemini-3.7-flash") === "gemini-3.7-flash"}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        ai_settings: {
                          ...profile.ai_settings,
                          gemini_model: e.target.value,
                        },
                      })
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      gemini-3.7-flash
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-medium">
                        Recommended
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Fastest structured reasoning for form filling & cover letters.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="gemini_model"
                    value="gemini-2.5-flash"
                    checked={profile.ai_settings?.gemini_model === "gemini-2.5-flash"}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        ai_settings: {
                          ...profile.ai_settings,
                          gemini_model: e.target.value,
                        },
                      })
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground">gemini-2.5-flash</div>
                    <div className="text-[11px] text-muted-foreground">
                      High-accuracy model for detailed screening questionnaires.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Visual Ghost Cursor & Mode Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-primary" />
              Browser Extension Behavior
            </h2>

            {/* Ghost Cursor Toggle */}
            <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">Visual Ghost Cursor</span>
                <p className="text-[11px] text-muted-foreground">
                  Glides smoothly to fields with natural typing. Does not meddle with your real mouse clicks.
                </p>
              </div>
              <input
                type="checkbox"
                checked={profile.ai_settings?.enable_ghost_cursor ?? true}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    ai_settings: {
                      ...profile.ai_settings,
                      enable_ghost_cursor: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 mt-1 accent-primary cursor-pointer"
              />
            </div>

            {/* Application Mode Toggle */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Submission Mode</label>
              <div className="space-y-2 mt-2">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="application_mode"
                    value="review_before_submit"
                    checked={(profile.ai_settings?.application_mode || "review_before_submit") === "review_before_submit"}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        ai_settings: {
                          ...profile.ai_settings,
                          application_mode: e.target.value as any,
                        },
                      })
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Review Before Submit (Safe)</div>
                    <div className="text-[11px] text-muted-foreground">
                      Auto-fills every field and pauses on the final review screen for your 1-click confirmation.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="application_mode"
                    value="full_auto"
                    checked={profile.ai_settings?.application_mode === "full_auto"}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        ai_settings: {
                          ...profile.ai_settings,
                          application_mode: e.target.value as any,
                        },
                      })
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Full Auto Submit</div>
                    <div className="text-[11px] text-muted-foreground">
                      Completes and submits applications end-to-end automatically.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
