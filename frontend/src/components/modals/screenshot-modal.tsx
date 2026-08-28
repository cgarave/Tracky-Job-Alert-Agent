"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ExternalLink } from "lucide-react";

interface ScreenshotModalProps {
  screenshotUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScreenshotModal({
  screenshotUrl,
  isOpen,
  onClose,
}: ScreenshotModalProps) {
  if (!screenshotUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-slate-900 border-slate-800 text-slate-100 p-6 shadow-2xl backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <DialogTitle className="text-base font-bold text-white tracking-tight">
              Application Confirmation Proof
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Post-submission screenshot captured during automated browser apply execution.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/80 flex items-center justify-center min-h-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt="Application Confirmation Proof"
              className="w-full h-auto object-contain max-h-[70vh]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-500 font-mono">
            {screenshotUrl.split("/").pop()}
          </span>

          <Button variant="outline" size="sm" asChild className="text-xs gap-1.5 bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850">
            <a href={screenshotUrl} target="_blank" rel="noopener noreferrer">
              <span>Open Full Image</span>
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
