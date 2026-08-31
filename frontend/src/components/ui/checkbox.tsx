"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    const isIndeterminate = checked === "indeterminate";
    const isChecked = checked === true;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disabled) return;
      if (onCheckedChange) {
        onCheckedChange(!isChecked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (onCheckedChange) {
          onCheckedChange(!isChecked);
        }
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center cursor-pointer",
          isChecked || isIndeterminate
            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/30"
            : "bg-slate-950/80 border-slate-700/80 hover:border-slate-500 text-transparent",
          className
        )}
        {...props}
      >
        {isIndeterminate ? (
          <Minus className="h-3 w-3 stroke-[3]" />
        ) : isChecked ? (
          <Check className="h-3 w-3 stroke-[3]" />
        ) : null}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";
