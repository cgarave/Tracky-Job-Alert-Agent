"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ScreenshotModalProps {
  filename: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScreenshotModal({ filename, isOpen, onClose }: ScreenshotModalProps) {
  if (!filename) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">📸 Application Confirmation Proof</DialogTitle>
          <DialogDescription className="text-xs">
            Direct snapshot captured by Playwright after submission.
          </DialogDescription>
        </DialogHeader>

        <div className="p-2 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-center overflow-hidden max-h-[70vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/screenshot/${filename}`}
            alt="Application Confirmation Proof"
            className="rounded-lg object-contain max-h-[65vh] w-auto max-w-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
