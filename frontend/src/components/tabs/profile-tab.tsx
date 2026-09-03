"use client";

import React, { useState, useEffect, useRef } from "react";
import { CandidateProfile } from "@/types";
import { fetchProfile, saveProfile, uploadResume, testGeminiKey } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  User,
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
  DollarSign,
  Loader2,
  Tag,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export function ProfileTab() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Gemini API Key & Model testing
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
      toast.error("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!profile) return;
    try {
      setSaving(true);
      await saveProfile(profile);
      toast.success("Profile & AI settings saved successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save profile: ${msg}`);
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
        toast.success(`Resume "${file.name}" uploaded & parsed!`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to upload resume:", err);
      toast.error("Failed to process resume PDF.");
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
      if (res.success) {
        toast.success("Gemini API key is valid and connected!");
      } else {
        toast.error(`API Key Error: ${res.message}`);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "Connection failed" });
      toast.error("Failed to validate Gemini API key.");
    } finally {
      setTestingKey(false);
    }
  }

  function handleAddSkill() {
    if (!skillInput.trim() || !profile) return;
    const tokens = skillInput
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const currentSkills = profile.skills || [];
    const lowerExisting = new Set(currentSkills.map((s) => s.toLowerCase()));

    const newSkills = [...currentSkills];
    for (const token of tokens) {
      if (!lowerExisting.has(token.toLowerCase())) {
        newSkills.push(token);
        lowerExisting.add(token.toLowerCase());
      }
    }

    setProfile({ ...profile, skills: newSkills });
    setSkillInput("");
  }

  function handleRemoveSkill(skillToRemove: string) {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: (profile.skills || []).filter((s) => s !== skillToRemove),
    });
  }

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSkill();
    } else if (e.key === "Backspace" && !skillInput && (profile?.skills || []).length > 0) {
      e.preventDefault();
      handleRemoveSkill(profile!.skills[profile!.skills.length - 1]);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const skills = profile.skills || [];

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      {/* 1. Resume PDF Parser Card */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                Resume PDF & Auto-Parser
              </CardTitle>
            </div>
            {profile.resume_filename && (
              <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 font-mono text-[11px] gap-1.5 py-1 px-2.5">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>{profile.resume_filename}</span>
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Upload your resume PDF to automatically extract candidate details, skills, and summary.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="application/pdf"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform border border-blue-200">
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {uploading ? "Extracting profile & skills from resume PDF..." : "Click or drag & drop resume PDF here"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Supports standard 1-2 page PDF resumes. Text is parsed locally on your Mac.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Candidate Information Card */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Candidate Information
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Primary details used by the AI Auto-Applier when filling contact fields and cover letters.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Full Name</Label>
              <Input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="e.g. Juan Dela Cruz"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Current Title / Role</Label>
              <Input
                type="text"
                value={profile.current_title}
                onChange={(e) => setProfile({ ...profile, current_title: e.target.value })}
                placeholder="e.g. Senior Full Stack Engineer"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Email Address</Label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="juan@example.com"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Phone / Mobile Number</Label>
              <Input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+63 917 123 4567"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Location</Label>
              <Input
                type="text"
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="Manila, Philippines"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Years of Experience</Label>
              <Input
                type="number"
                min="0"
                max="40"
                value={profile.years_of_experience}
                onChange={(e) => setProfile({ ...profile, years_of_experience: Number(e.target.value) })}
                className="bg-white border-slate-200 text-slate-900 font-mono"
              />
            </div>
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-4 border-t border-slate-100">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-600">LinkedIn Profile URL</Label>
              <Input
                type="text"
                value={profile.linkedin_url || ""}
                onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/..."
                className="bg-white border-slate-200 text-slate-900 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-600">GitHub Profile URL</Label>
              <Input
                type="text"
                value={profile.github_url || ""}
                onChange={(e) => setProfile({ ...profile, github_url: e.target.value })}
                placeholder="https://github.com/..."
                className="bg-white border-slate-200 text-slate-900 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-600">Portfolio Website</Label>
              <Input
                type="text"
                value={profile.portfolio_url || ""}
                onChange={(e) => setProfile({ ...profile, portfolio_url: e.target.value })}
                placeholder="https://myportfolio.dev"
                className="bg-white border-slate-200 text-slate-900 text-xs"
              />
            </div>
          </div>

          {/* Interactive Skills Pill Box */}
          <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-slate-100">
            <Label className="text-xs text-slate-700 font-medium flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Technical Skills & Badges</span>
              </div>
              <span className="text-[11px] text-blue-600 font-mono font-semibold">
                {skills.length} active skill{skills.length === 1 ? "" : "s"}
              </span>
            </Label>

            <div className="flex flex-wrap items-center gap-2 p-2.5 min-h-[46px] rounded-xl bg-slate-50 border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-2xs">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium group transition-all hover:border-blue-300"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-blue-400 group-hover:text-rose-600 transition-colors focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                <Input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder={skills.length === 0 ? "Type a skill and hit Enter..." : "Add skill..."}
                  className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs text-slate-900 placeholder:text-slate-400 p-0"
                />
                {skillInput.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddSkill}
                    className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 rounded-md"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Screening Question Presets */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Screening Question Presets
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Preset values automatically injected into platform screening questionnaires by Gemini AI.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Monthly Salary Expectation (PHP)</Label>
              <Input
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
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Hourly Rate Expectation (USD)</Label>
              <Input
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
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Notice Period (weeks)</Label>
              <Input
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
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Legally Authorized to Work in PH?</Label>
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
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Google Gemini AI Engine Card */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Google Gemini AI Engine & API Key
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Reasoning model used to parse custom screening questionnaires and draft tailored cover letters.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-slate-700 font-medium flex items-center justify-between">
              <span>Gemini API Key</span>
              <span className="text-[11px] text-slate-500 font-mono">From Google AI Studio</span>
            </Label>
            <div className="relative">
              <Input
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
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestKey}
                disabled={testingKey || !profile.ai_settings?.gemini_api_key}
                className="h-8 px-3 text-xs bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 gap-1.5"
              >
                {testingKey ? <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> : <Key className="w-3 h-3 text-blue-600" />}
                <span>Test Connection</span>
              </Button>

              {testResult && (
                <span
                  className={`text-xs font-semibold flex items-center gap-1 ${
                    testResult.success ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {testResult.success ? "Valid Key Connected" : testResult.message}
                </span>
              )}
            </div>
          </div>

          {/* Model Selection */}
          <div className="pt-3 border-t border-slate-100">
            <Label className="text-xs text-slate-700 font-medium mb-2 block">Select AI Model</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  (profile.ai_settings?.gemini_model || "gemini-3.7-flash") === "gemini-3.7-flash"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
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
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    gemini-3.7-flash
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5 font-semibold">
                      Recommended
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Multimodal vision & agentic reasoning.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  profile.ai_settings?.gemini_model === "gemini-3.6-flash"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="gemini_model"
                  value="gemini-3.6-flash"
                  checked={profile.ai_settings?.gemini_model === "gemini-3.6-flash"}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      ai_settings: {
                        ...profile.ai_settings,
                        gemini_model: e.target.value,
                      },
                    })
                  }
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">gemini-3.6-flash</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    High-performance workhorse model.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  profile.ai_settings?.gemini_model === "gemini-3.5-flash-lite"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="gemini_model"
                  value="gemini-3.5-flash-lite"
                  checked={profile.ai_settings?.gemini_model === "gemini-3.5-flash-lite"}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      ai_settings: {
                        ...profile.ai_settings,
                        gemini_model: e.target.value,
                      },
                    })
                  }
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">gemini-3.5-flash-lite</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Fast & lightweight screening answers.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Browser Extension Automation Controls */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MousePointer className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Browser Extension Behavior
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Configure visual navigation and auto-submission preferences inside your browser session.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Ghost Cursor Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-slate-900">Visual Ghost Cursor</span>
              <span className="text-[11px] text-slate-500">
                Animates a glowing cursor and simulates natural typing. Non-blocking with zero interference to mouse clicks.
              </span>
            </div>
            <Switch
              checked={profile.ai_settings?.enable_ghost_cursor ?? true}
              onCheckedChange={(checked) =>
                setProfile({
                  ...profile,
                  ai_settings: {
                    ...profile.ai_settings,
                    enable_ghost_cursor: checked,
                  },
                })
              }
            />
          </div>

          {/* Submission Mode */}
          <div>
            <Label className="text-xs text-slate-700 font-medium mb-2 block">Application Submission Mode</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  (profile.ai_settings?.application_mode || "review_before_submit") === "review_before_submit"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
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
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Review Before Submit (Recommended)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Auto-fills every form step and pauses on the final review page for your 1-click confirmation.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  profile.ai_settings?.application_mode === "full_auto"
                    ? "bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
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
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Full Auto Submit</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Fills all steps and automatically clicks final submit without pausing.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="gap-2 font-semibold text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 px-5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saving ? "Saving Profile..." : "Save Candidate Profile"}</span>
        </Button>
      </div>
    </form>
  );
}
