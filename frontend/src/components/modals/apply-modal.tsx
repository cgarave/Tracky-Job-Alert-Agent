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
import { FileText, Rocket, ExternalLink, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{job.source}</Badge>
            {job.location && <span className="text-xs text-slate-400">📍 {job.location}</span>}
          </div>
          <DialogTitle className="text-xl font-bold">{job.title}</DialogTitle>
          <DialogDescription className="text-sm font-medium text-slate-300">
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
                <span>No resume uploaded! Please upload a PDF in Profile tab before applying.</span>
              </div>
            )}
          </div>

          {/* Customizable Pitch Note (Option C) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="custom_pitch" className="text-xs text-slate-400">
                Application Pitch / Cover Note (Option C - Editable):
              </Label>
            </div>
            <Textarea
              id="custom_pitch"
              rows={5}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              className="text-xs leading-relaxed font-normal font-sans"
            />
          </div>

          {/* Pre-filled Profile Details Preview */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-slate-400">Pre-filled Profile Details:</Label>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-white/5">
                👤 {profile.personal.first_name} {profile.personal.last_name || "Applicant"}
              </span>
              {profile.personal.email && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-white/5">
                  ✉️ {profile.personal.email}
                </span>
              )}
              {profile.personal.phone && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-white/5">
                  📞 {profile.personal.phone}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-white/5">
                💼 {profile.work_preferences.years_of_experience || 0} yrs exp
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 border border-white/5">
                💰 PHP {profile.work_preferences.expected_salary_php || "100,000"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" asChild size="sm">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <span>Open on Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !hasResume}
            className="gap-2 font-semibold"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            <span>{isSubmitting ? "Submitting..." : "Submit Application"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
