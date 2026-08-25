"use client";

import React, { useState, useRef } from "react";
import { UserProfile } from "@/types";
import { UploadCloud, FileText, CheckCircle2, Eye, ShieldCheck, Save, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ProfileTabProps {
  profile: UserProfile;
  onSaveProfile: (p: UserProfile) => Promise<void>;
  onUploadResume: (file: File) => Promise<void>;
  isSaving: boolean;
}

export function ProfileTab({
  profile,
  onSaveProfile,
  onUploadResume,
  isSaving,
}: ProfileTabProps) {
  const [formData, setFormData] = useState(profile.personal);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: keyof typeof formData, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...profile, personal: formData };
    await onSaveProfile(updated);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only authentic PDF files (.pdf) are supported.");
      return;
    }
    setIsUploading(true);
    try {
      await onUploadResume(file);
    } finally {
      setIsUploading(false);
    }
  };

  const resume = profile.resume;
  const hasResume = !!(resume && resume.filename && resume.path);
  const fileSizeKb = Math.round((resume?.file_size_bytes || 0) / 1024);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Authentic Resume Uploader */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <Card className="border-indigo-500/20 shadow-indigo-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>📄 Authentic Resume</span>
              </CardTitle>
              <Badge variant="default" className="gap-1 font-semibold text-[11px]">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                <span>Strict File Attach</span>
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Upload your authentic PDF resume. Tracky strictly attaches this original file and will <strong>never</strong> generate fake or rewritten resumes.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files.length > 0) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                isDragging
                  ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
                  : "border-indigo-500/30 bg-slate-950/40 hover:bg-slate-950/70 hover:border-indigo-400"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {isUploading ? "Uploading Resume..." : "Drag & Drop your PDF resume"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  or <span className="text-indigo-400 font-medium underline">browse files</span> from your Mac
                </p>
              </div>
              <span className="text-[11px] text-slate-500">PDF only (Max 10MB)</span>
            </div>

            {/* Active Resume Card */}
            {hasResume && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-semibold text-white truncate">{resume.filename}</h5>
                    <p className="text-[11px] text-slate-400">
                      {fileSizeKb} KB · Uploaded {resume.uploaded_at?.split("T")[0] || "recently"}
                    </p>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  asChild
                  className="gap-1 text-xs shrink-0"
                >
                  <a href="/api/resume/view" target="_blank" rel="noopener noreferrer">
                    <Eye className="w-3.5 h-3.5" />
                    <span>View PDF</span>
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Personal Information Form */}
      <div className="lg:col-span-7">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">👤 Personal Information</CardTitle>
            <CardDescription className="text-xs">
              Your contact details are pre-filled automatically during application form filling.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    placeholder="e.g. Juan"
                    value={formData.first_name || ""}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    placeholder="e.g. Dela Cruz"
                    value={formData.last_name || ""}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g. juan@example.com"
                    value={formData.email || ""}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">Mobile Phone</Label>
                  <Input
                    id="phone"
                    placeholder="e.g. +639171234567"
                    value={formData.phone || ""}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="headline">Headline / Target Role</Label>
                <Input
                  id="headline"
                  placeholder="e.g. Senior Full Stack Developer"
                  value={formData.headline || ""}
                  onChange={(e) => handleInputChange("headline", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Current Location / City</Label>
                <Input
                  id="location"
                  placeholder="e.g. Metro Manila, Philippines"
                  value={formData.location || ""}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input
                    id="linkedin_url"
                    placeholder="https://linkedin.com/in/..."
                    value={formData.linkedin_url || ""}
                    onChange={(e) => handleInputChange("linkedin_url", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="github_url">GitHub URL</Label>
                  <Input
                    id="github_url"
                    placeholder="https://github.com/..."
                    value={formData.github_url || ""}
                    onChange={(e) => handleInputChange("github_url", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portfolio_url">Portfolio / Personal Website</Label>
                <Input
                  id="portfolio_url"
                  placeholder="https://yourportfolio.com"
                  value={formData.portfolio_url || ""}
                  onChange={(e) => handleInputChange("portfolio_url", e.target.value)}
                />
              </div>

              <Button type="submit" disabled={isSaving} className="self-end gap-2 mt-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Personal Details</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
