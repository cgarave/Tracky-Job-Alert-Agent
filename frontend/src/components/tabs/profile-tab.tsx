"use client";

import React, { useState, useEffect, useRef } from "react";
import { CandidateProfile, QAMemoryItem } from "@/types";
import { fetchProfile, saveProfile, uploadResume, deleteResume, fetchQAMemory, saveQAMemory, deleteQAMemory } from "@/lib/api";
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
  MousePointer,
  Save,
  Plus,
  X,
  DollarSign,
  Loader2,
  Tag,
  Check,
  Brain,
  Search,
  Trash2,
  Briefcase,
  GraduationCap,
  Clock,
  Car,
  FileCheck2
} from "lucide-react";
import { toast } from "sonner";

export function ProfileTab() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Skill tag input
  const [skillInput, setSkillInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistent Q&A Memory state
  const [qaItems, setQaItems] = useState<QAMemoryItem[]>([]);
  const [qaSearch, setQaSearch] = useState("");
  const [qaCategory, setQaCategory] = useState("all");
  const [isAddingQa, setIsAddingQa] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [qaLoading, setQaLoading] = useState(false);

  useEffect(() => {
    loadCandidateProfile();
    loadQAMemory();
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

  async function loadQAMemory() {
    try {
      setQaLoading(true);
      const res = await fetchQAMemory();
      if (res?.items) {
        setQaItems(res.items);
      }
    } catch (e) {
      console.error("Failed to load QA memory:", e);
    } finally {
      setQaLoading(false);
    }
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!profile) return;
    try {
      setSaving(true);
      await saveProfile(profile);
      toast.success("Profile & screening defaults saved successfully!");
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

  async function handleDeleteResume() {
    if (!profile) return;
    try {
      setUploading(true);
      const res = await deleteResume();
      setProfile(res.profile);
      toast.success("Resume removed from storage.");
    } catch (err) {
      toast.error("Failed to delete resume.");
    } finally {
      setUploading(false);
    }
  }

  function handleAddSkill() {
    const trimmed = skillInput.trim();
    if (!trimmed || !profile) return;
    if (!profile.skills.includes(trimmed)) {
      setProfile({
        ...profile,
        skills: [...profile.skills, trimmed],
      });
    }
    setSkillInput("");
  }

  function handleRemoveSkill(skillToRemove: string) {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
  }

  async function handleAddQAMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Question and answer cannot be empty.");
      return;
    }

    try {
      await saveQAMemory(newQuestion, newAnswer, newCategory);
      toast.success("Saved to persistent Q&A memory!");
      setNewQuestion("");
      setNewAnswer("");
      setIsAddingQa(false);
      loadQAMemory();
    } catch (err) {
      toast.error("Failed to save Q&A memory.");
    }
  }

  async function handleDeleteQAMemory(id: number) {
    try {
      await deleteQAMemory(id);
      toast.success("Remembered answer deleted.");
      setQaItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      toast.error("Failed to delete Q&A item.");
    }
  }

  const filteredQaItems = qaItems.filter((item) => {
    const matchesSearch =
      qaSearch === "" ||
      item.question_text.toLowerCase().includes(qaSearch.toLowerCase()) ||
      item.answer_value.toLowerCase().includes(qaSearch.toLowerCase());
    const matchesCategory = qaCategory === "all" || item.category === qaCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Loading candidate profile & Q&A memory...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* 1. Personal & Contact Information */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Personal & Professional Profile
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Core personal information used as Tier 1 ground truth across all job applications.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Full Name</Label>
              <Input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Jane Doe"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Primary Profession / Target Role</Label>
              <Input
                type="text"
                value={profile.current_title}
                onChange={(e) => setProfile({ ...profile, current_title: e.target.value })}
                placeholder="e.g. Sales Director / Graphic Designer / Nurse / Software Engineer"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Email Address</Label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="jane@example.com"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Phone Number</Label>
              <Input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+63 917 123 4567"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">City, Province & Country</Label>
              <Input
                type="text"
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="Taguig, Metro Manila, Philippines"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Total Years of Professional Experience</Label>
              <Input
                type="number"
                min="0"
                max="50"
                value={profile.years_of_experience}
                onChange={(e) => setProfile({ ...profile, years_of_experience: Number(e.target.value) })}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono"
              />
            </div>
          </div>

          {/* Links Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Portfolio / Website (Optional)</Label>
              <Input
                type="url"
                value={profile.portfolio_url || ""}
                onChange={(e) => setProfile({ ...profile, portfolio_url: e.target.value })}
                placeholder="https://myportfolio.com"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">LinkedIn Profile URL (Optional)</Label>
              <Input
                type="url"
                value={profile.linkedin_url || ""}
                onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">GitHub / Other Profile (Optional)</Label>
              <Input
                type="url"
                value={profile.github_url || ""}
                onChange={(e) => setProfile({ ...profile, github_url: e.target.value })}
                placeholder="https://github.com/username"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Resume & Skills */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Resume & Skills Vault
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Uploaded once and parsed into memory. Tracky uses this structured data without re-reading the PDF on every question.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {profile.resume_filename || "No resume PDF uploaded yet"}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  PDF format (max 5MB) • Auto-attached when applications require a resume file
                </div>
              </div>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-white border-slate-300 hover:bg-slate-100 text-xs font-semibold gap-1.5"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Upload className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{profile.resume_filename ? "Replace Resume" : "Upload PDF Resume"}</span>
                </Button>
                {profile.resume_filename && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteResume}
                    disabled={uploading}
                    className="bg-white border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Remove</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Skills Tag Management */}
          <div className="pt-2">
            <Label className="text-xs text-slate-700 font-medium mb-2 block">
              Core Skills & Tools (Applicable to Any Industry)
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px]">
              {profile.skills && profile.skills.length > 0 ? (
                profile.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-medium shadow-2xs"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">No skills added yet. Type below to add.</span>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="e.g. Project Management, QuickBooks, Canva, Clinical Care, Python..."
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSkill}
                className="bg-slate-50 border-slate-200 hover:bg-slate-100 text-xs font-semibold px-4"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Skill
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Universal Screening Defaults (For All Job Types) */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Universal Screening Defaults & Availability
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Authoritative answers (Tier 1) for legal, schedule, salary, and qualification questions across all industries.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                placeholder="50,000"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono text-xs"
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
                placeholder="10"
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Earliest Start Date / Notice Period</Label>
              <select
                value={profile.screening_defaults?.earliest_start_date || "2 weeks"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    screening_defaults: {
                      ...profile.screening_defaults,
                      earliest_start_date: e.target.value,
                      notice_period_weeks: e.target.value === "Immediate" ? "0" : "2"
                    },
                  })
                }
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Immediate">Immediate / Ready now</option>
                <option value="1 week">1 week notice</option>
                <option value="2 weeks">2 weeks notice</option>
                <option value="30 days">30 days notice</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Highest Education Level</Label>
              <select
                value={profile.screening_defaults?.education_level || "Bachelor's Degree"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    screening_defaults: {
                      ...profile.screening_defaults,
                      education_level: e.target.value,
                    },
                  })
                }
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Bachelor's Degree">Bachelor&apos;s Degree</option>
                <option value="Master's Degree">Master&apos;s Degree</option>
                <option value="Associate Degree">Associate Degree / College Undergrad</option>
                <option value="Vocational / Certificate">Vocational / Certificate</option>
                <option value="High School / GED">High School / GED</option>
                <option value="Doctorate">Doctorate / Ph.D.</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Work Arrangement Preference</Label>
              <select
                value={profile.screening_defaults?.remote_preferred || "Remote preferred"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    screening_defaults: {
                      ...profile.screening_defaults,
                      remote_preferred: e.target.value,
                    },
                  })
                }
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Remote preferred">Remote preferred</option>
                <option value="Hybrid">Hybrid (Remote + On-site)</option>
                <option value="On-site only">On-site only</option>
                <option value="Open to all">Open to all</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Shift Availability</Label>
              <select
                value={profile.screening_defaults?.shift_availability || "Flexible"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    screening_defaults: {
                      ...profile.screening_defaults,
                      shift_availability: e.target.value,
                    },
                  })
                }
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Flexible">Flexible / Open to any shift</option>
                <option value="Day shift only">Day shift only</option>
                <option value="Night / Graveyard shift">Night / Graveyard shift</option>
                <option value="Weekends only">Weekends only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Authorized to Work in Location?</Label>
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
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Willing to Undergo Background Check?</Label>
              <select
                value={profile.screening_defaults?.background_check_consent || "Yes"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    screening_defaults: {
                      ...profile.screening_defaults,
                      background_check_consent: e.target.value,
                    },
                  })
                }
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-700 font-medium">Valid Driver&apos;s License?</Label>
              <select
                value={profile.screening_defaults?.driver_license || "Yes"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    screening_defaults: {
                      ...profile.screening_defaults,
                      driver_license: e.target.value,
                    },
                  })
                }
                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Not Applicable">Not Applicable</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Persistent Q&A Knowledge Base (Tier 3 Memory) */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                Persistent Q&A Knowledge Base
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Custom employer questions you answered previously. Tracky remembers these across all job boards so you never have to re-type them.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddingQa(!isAddingQa)}
            className="bg-slate-50 border-slate-200 hover:bg-slate-100 text-xs font-semibold gap-1"
          >
            <Plus className="w-3.5 h-3.5 text-amber-600" />
            <span>{isAddingQa ? "Close Form" : "Add Q&A"}</span>
          </Button>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Add New Q&A Form */}
          {isAddingQa && (
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-3">
              <div className="text-xs font-bold text-slate-800">Add Custom Question & Answer Pair</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="e.g. Do you have experience managing offshore teams?"
                    className="bg-white border-slate-200 text-xs text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800"
                  >
                    <option value="general">General</option>
                    <option value="behavioral">Behavioral / Situational</option>
                    <option value="logistics">Logistics / Availability</option>
                    <option value="technical">Technical / Tools</option>
                  </select>
                </div>
              </div>
              <div>
                <Input
                  type="text"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="e.g. Yes, I have managed distributed teams of 5-8 people across 3 timezones."
                  className="bg-white border-slate-200 text-xs text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingQa(false)}
                  className="text-xs text-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddQAMemory}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4"
                >
                  Save to Memory
                </Button>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={qaSearch}
                onChange={(e) => setQaSearch(e.target.value)}
                placeholder="Search remembered questions or answers..."
                className="pl-8 bg-slate-50/70 border-slate-200 text-xs text-slate-900"
              />
            </div>
            <select
              value={qaCategory}
              onChange={(e) => setQaCategory(e.target.value)}
              className="h-9 px-3 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-700"
            >
              <option value="all">All Categories</option>
              <option value="general">General</option>
              <option value="behavioral">Behavioral</option>
              <option value="logistics">Logistics</option>
              <option value="technical">Technical</option>
            </select>
          </div>

          {/* Q&A List */}
          {filteredQaItems.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
              <Brain className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
              <p className="text-xs font-medium">No custom questions in memory yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Whenever you answer an unknown screening question via the cursor bubble, Tracky automatically learns it.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredQaItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white border border-slate-200/80 hover:border-amber-200 transition-colors flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.question_text}</span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-slate-50 text-slate-600">
                        {item.category}
                      </Badge>
                      <span className="text-[10px] font-mono text-slate-400">Used {item.use_count}x</span>
                    </div>
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg font-mono">
                      {item.answer_value}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteQAMemory(item.id)}
                    className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Delete this remembered answer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Save Button */}
      <div className="flex justify-end gap-3 sticky bottom-4 z-10 p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-md">
        <Button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-6 py-2.5 shadow-sm gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? "Saving Changes..." : "Save Profile & Q&A Memory"}</span>
        </Button>
      </div>
    </form>
  );
}
