"use client";

import React, { useState, useEffect } from "react";
import { Job, UserProfile } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Rocket,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface ApplyModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSubmitApply: (jobId: string, customPitch?: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ApplyModal({
  job,
  isOpen,
  onClose,
  profile,
  onSubmitApply,
  isSubmitting,
}: ApplyModalProps) {
  const [pitch, setPitch] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (job) {
      const personal = profile.personal || {};
      const work = profile.work_preferences || {};
      const qa = profile.screening_answers || {};
      const skills = (work.skills || []).join(", ");

      const defaultPitch = `Hi,\n\nI am applying for the ${job.title} position at ${job.company}.\nWith ${work.years_of_experience || 3}+ years of experience and hands-on skills in ${skills || "software engineering"}, I am excited about the opportunity to contribute to your team.\n\n${qa.why_hire_me || ""}\n\nBest regards,\n${personal.first_name || ""} ${personal.last_name || ""}\n${personal.phone || ""} · ${personal.email || ""}`;

      setPitch(defaultPitch);
    }
  }, [job, profile]);

  if (!job) return null;

  const resume = profile.resume;
  const hasResume = !!(resume && resume.filename);

  const handleSubmit = async () => {
    await onSubmitApply(job.job_id, pitch);
    onClose();
  };

  const handleCopyAndOpen = () => {
    navigator.clipboard.writeText(pitch);
    setCopied(true);
    toast.success("Application pitch copied to clipboard!");
    window.open(job.url, "_blank", "noopener,noreferrer");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100 p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-slate-800 border-slate-700 text-indigo-400">
              {job.source}
            </Badge>
            {job.location && <span className="text-xs text-slate-400">📍 {job.location}</span>}
          </div>
          <DialogTitle className="text-lg font-bold text-white">{job.title}</DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-300">
            🏢 {job.company}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Authentic Resume Indicator */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-slate-400">Attached Authentic Resume:</Label>
            {hasResume ? (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white truncate max-w-xs">
                    {resume.filename}
                  </span>
                </div>
                <Badge variant="success" className="gap-1 text-[10px]">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified PDF</span>
                </Badge>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>No resume uploaded! Please upload a PDF in Profile tab before automated apply.</span>
              </div>
            )}
          </div>

          {/* Customizable Pitch Note */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="custom_pitch" className="text-xs text-slate-400">
                Application Pitch / Cover Note (Editable):
              </Label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(pitch);
                  setCopied(true);
                  toast.success("Pitch copied!");
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy Pitch"}</span>
              </button>
            </div>
            <Textarea
              id="custom_pitch"
              rows={5}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              className="text-xs leading-relaxed font-normal font-sans bg-slate-950/60 border-slate-800"
            />
          </div>

          {/* Profile Details Preview */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-slate-400">Pre-filled Profile Context:</Label>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700">
                👤 {profile.personal.first_name} {profile.personal.last_name || "Applicant"}
              </span>
              {profile.personal.email && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700">
                  ✉️ {profile.personal.email}
                </span>
              )}
              {profile.personal.phone && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700">
                  📞 {profile.personal.phone}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700">
                💼 {profile.work_preferences.years_of_experience || 0} yrs exp
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700">
                💰 PHP {profile.work_preferences.expected_salary_php || "100,000"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-800">
          {/* Option B: Copy & Open Tab */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyAndOpen}
            className="w-full sm:w-auto gap-1.5 text-xs bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
            title="Copies pitch to clipboard and opens the job in a new tab in your browser"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open in Tab & Copy Pitch</span>
          </Button>

          {/* Option A: Automated Apply */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !hasResume}
            className="w-full sm:w-auto gap-2 font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            <span>{isSubmitting ? "Submitting..." : "Automated 1-Click Apply"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
