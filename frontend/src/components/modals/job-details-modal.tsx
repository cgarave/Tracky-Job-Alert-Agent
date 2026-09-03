"use client";

import React from "react";
import { Job } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Building2,
  MapPin,
  Banknote,
  Clock,
  Trash2,
  Copy,
  Check,
  FileText,
  Smartphone,
  Globe,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";

interface JobDetailsModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (job: Job) => void;
}

export function JobDetailsModal({ job, isOpen, onClose, onDelete }: JobDetailsModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!job || !isOpen) return null;

  const handleCopyLink = () => {
    if (job.url) {
      navigator.clipboard.writeText(job.url);
      setCopied(true);
      toast.success("Job link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasDescription = !!(job.description && job.description.trim().length > 0);
  const isAlerted = Boolean(job.is_alerted);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col bg-white border-slate-200 text-slate-900 p-0 shadow-2xl overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/70">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[11px] bg-white border-slate-200 text-slate-700">
                {job.source}
              </Badge>

              {isAlerted ? (
                <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700 gap-1 flex items-center font-medium">
                  <Smartphone className="w-3 h-3 text-blue-600" />
                  <span>Alert Sent (iMessage)</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-slate-100 border-slate-200 text-slate-500 gap-1 flex items-center">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>Web Discovery</span>
                </Badge>
              )}

              {job.apply_type && job.apply_type !== "unknown" && (
                <Badge variant="outline" className="text-[10px] bg-slate-100 border-slate-200 text-slate-700">
                  {job.apply_type}
                </Badge>
              )}

              <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatTimeAgo(job.seen_at)}
              </span>
            </div>

            <DialogTitle className="text-lg font-bold text-slate-900 leading-tight tracking-tight">
              {job.title}
            </DialogTitle>

            <DialogDescription className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-800 font-semibold">{job.company}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Quick Meta Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <div className="flex flex-col truncate">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Location</span>
                <span className="text-slate-800 truncate font-medium">{job.location || "Philippines"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="flex flex-col truncate">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Salary</span>
                <span className="text-emerald-700 truncate font-semibold font-mono">{job.salary || "Negotiable"}</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <div className="flex flex-col truncate">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Indexed</span>
                <span className="text-slate-800 truncate font-medium">{job.seen_at ? new Date(job.seen_at).toLocaleDateString() : "Recently"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Description Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs leading-relaxed text-slate-700 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Job Description & Requirements</span>
          </div>

          {hasDescription ? (
            <div className="whitespace-pre-line font-sans text-slate-800 text-[13px] leading-relaxed select-text space-y-2">
              {job.description}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 my-4">
              <p className="text-slate-600 text-xs font-medium">
                No full text description cached for this older listing.
              </p>
              <p className="text-slate-400 text-[11px] mt-1">
                Click “Open on {job.source}” below to view the full job post on the original job board.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  onDelete(job);
                }}
                className="h-8 px-2.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 px-2.5 text-xs bg-white border-slate-200 text-slate-700 hover:text-slate-900 gap-1.5 shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? "Copied" : "Copy Link"}</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 px-3 text-xs text-slate-600 hover:text-slate-900"
            >
              Close
            </Button>

            <Button
              size="sm"
              asChild
              className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-sm shadow-blue-500/20"
            >
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <span>Open on {job.source}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
