import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-blue-50 text-blue-700 border border-blue-200",
        secondary:
          "bg-slate-100 text-slate-700 border border-slate-200",
        destructive:
          "bg-rose-50 text-rose-700 border border-rose-200",
        success:
          "bg-emerald-50 text-emerald-700 border border-emerald-200",
        warning:
          "bg-amber-50 text-amber-700 border border-amber-200",
        outline: "bg-white text-slate-700 border border-slate-200",
        indeed: "bg-blue-50 text-blue-700 border border-blue-200",
        jobstreet: "bg-pink-50 text-pink-700 border border-pink-200",
        onlinejobs: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        linkedin: "bg-sky-50 text-sky-700 border border-sky-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
