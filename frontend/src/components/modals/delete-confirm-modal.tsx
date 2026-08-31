"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (blockFuture: boolean) => Promise<void>;
  count: number;
  singleJobTitle?: string;
  isDeleting: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  count,
  singleJobTitle,
  isDeleting,
}: DeleteConfirmModalProps) {
  const [blockFuture, setBlockFuture] = useState(true);

  if (!isOpen) return null;

  const isSingle = count === 1;

  const handleConfirm = async () => {
    await onConfirm(blockFuture);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent className="max-w-md bg-slate-900/95 border-slate-800 text-slate-100 p-6 shadow-2xl backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-tight">
                {isSingle ? "Delete Job Listing" : `Delete ${count} Job Listings`}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                {isSingle
                  ? `Are you sure you want to remove this job from Tracky?`
                  : `Are you sure you want to delete ${count} selected jobs?`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {singleJobTitle && (
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-medium truncate">
              {singleJobTitle}
            </div>
          )}

          {/* Ignore in future scans toggle */}
          <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">
                  Ignore in future scans
                </span>
                <span className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  {blockFuture
                    ? "Tracky will remember these IDs and never send alerts for them again."
                    : "If still listed on the job board, they may be re-discovered on future scans."}
                </span>
              </div>
            </div>

            <Switch
              checked={blockFuture}
              onCheckedChange={setBlockFuture}
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="text-xs gap-2 bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm shadow-rose-600/20"
          >
            {isDeleting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{isDeleting ? "Deleting..." : isSingle ? "Delete Job" : `Delete (${count})`}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
