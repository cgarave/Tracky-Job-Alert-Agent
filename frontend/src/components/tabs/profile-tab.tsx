"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck,
  User,
  Mail,
  Phone,
  Briefcase,
  Banknote,
  Sparkles,
  Upload,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { uploadResume, analyzeResume } from "@/lib/api";

interface ProfileTabProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onRefreshProfile: () => void;
  isLoading: boolean;
}

export function ProfileTab({
  profile,
  onSaveProfile,
  onRefreshProfile,
  isLoading,
}: ProfileTabProps) {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handlePersonalChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        [field]: value,
      },
    }));
  };

  const handleWorkChange = (field: string, value: string | number | string[]) => {
    setFormData((prev) => ({
      ...prev,
      work_preferences: {
        ...prev.work_preferences,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveProfile(formData);
      toast.success("Profile saved successfully!");
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pdf")) {
      toast.error("Please upload a PDF file only.");
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadResume(file);
      if (res.success) {
        toast.success(`Resume "${file.name}" uploaded successfully!`);
        onRefreshProfile();
      } else {
        toast.error(res.message || "Failed to upload resume.");
      }
    } catch {
      toast.error("Error uploading resume.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAutofill = async () => {
    setIsAutofilling(true);
    try {
      const res = await analyzeResume();
      if (res.success && res.profile) {
        setFormData(res.profile);
        toast.success("Profile autofilled from resume analysis!");
      } else {
        toast.error(res.message || "Autofill failed.");
      }
    } catch {
      toast.error("Error analyzing resume with AI.");
    } finally {
      setIsAutofilling(false);
    }
  };

  const resume = profile.resume || { filename: "" };
  const hasResume = !!resume.filename;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Authentic Resume Upload Section */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <CardTitle className="text-base font-bold text-white tracking-tight">
                  Authentic Resume (PDF Document)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Upload your genuine PDF resume. Tracky strictly attaches this original file to all automated job applications.
              </CardDescription>
            </div>

            {hasResume ? (
              <Badge variant="success" className="gap-1 text-xs self-start sm:self-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified PDF Attached</span>
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1 text-xs self-start sm:self-auto">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Missing Resume</span>
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white truncate max-w-sm">
                  {hasResume ? resume.filename : "No PDF Resume Uploaded"}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {hasResume ? "Active for Easy Apply & automated submissions" : "Upload your genuine PDF to begin applying"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label
                htmlFor="resume-upload"
                className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isUploading ? "Uploading..." : hasResume ? "Replace PDF" : "Upload PDF"}</span>
                <input
                  id="resume-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </Label>

              {hasResume && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutofill}
                  disabled={isAutofilling}
                  className="text-xs gap-1.5 bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isAutofilling ? "Analyzing..." : "Auto-Fill from Resume"}</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Details */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white tracking-tight">
              Personal Information
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Pre-fills employer contact fields across all job board application wizards.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name" className="text-xs text-slate-300">
                First Name
              </Label>
              <Input
                id="first_name"
                value={formData.personal?.first_name || ""}
                onChange={(e) => handlePersonalChange("first_name", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. John"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name" className="text-xs text-slate-300">
                Last Name
              </Label>
              <Input
                id="last_name"
                value={formData.personal?.last_name || ""}
                onChange={(e) => handlePersonalChange("last_name", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. Doe"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs text-slate-300">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.personal?.email || ""}
                onChange={(e) => handlePersonalChange("email", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. applicant@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-xs text-slate-300">
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.personal?.phone || ""}
                onChange={(e) => handlePersonalChange("phone", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. +63 912 345 6789"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="headline" className="text-xs text-slate-300">
                Professional Headline / Target Role
              </Label>
              <Input
                id="headline"
                value={formData.personal?.headline || ""}
                onChange={(e) => handlePersonalChange("headline", e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. Senior Full Stack Engineer (React / TypeScript / Node.js)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Preferences */}
      <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white tracking-tight">
              Work & Compensation Preferences
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Automates salary, years of experience, and screening questions during multi-step applications.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="years_of_experience" className="text-xs text-slate-300">
                Years of Experience
              </Label>
              <Input
                id="years_of_experience"
                type="number"
                value={formData.work_preferences?.years_of_experience ?? 3}
                onChange={(e) => handleWorkChange("years_of_experience", parseInt(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expected_salary_php" className="text-xs text-slate-300">
                Expected Monthly Salary (PHP)
              </Label>
              <Input
                id="expected_salary_php"
                type="number"
                value={formData.work_preferences?.expected_salary_php ?? 100000}
                onChange={(e) => handleWorkChange("expected_salary_php", parseInt(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="skills" className="text-xs text-slate-300">
                Primary Skills (comma separated)
              </Label>
              <Input
                id="skills"
                value={(formData.work_preferences?.skills || []).join(", ")}
                onChange={(e) =>
                  handleWorkChange(
                    "skills",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                placeholder="e.g. React, Next.js, TypeScript, Tailwind CSS, Python, Node.js"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button Bar */}
      <div className="flex items-center justify-end">
        <Button
          type="submit"
          disabled={isSaving || isLoading}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? "Saving..." : "Save Profile Details"}</span>
        </Button>
      </div>
    </form>
  );
}
