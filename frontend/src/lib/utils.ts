import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a database or ISO date string safely into a JS Date.
 * Handles SQLite UTC timestamps ("YYYY-MM-DD HH:MM:SS"),
 * ISO strings, and standard Date formats.
 */
export function parseUtcDate(isoString?: string): Date | null {
  if (!isoString || isoString === "Never" || isoString.trim() === "") return null;
  const clean = isoString.trim();

  // If already contains timezone offset (Z, +XX:XX, -XX:XX)
  if (clean.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(clean)) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  // SQLite CURRENT_TIMESTAMP: "2026-09-04 10:18:37" or local iso without Z "2026-09-04T10:18:37"
  // SQLite timestamps are in UTC, so append Z to parse as UTC
  const utcIso = clean.includes("T") ? `${clean}Z` : `${clean.replace(" ", "T")}Z`;
  const parsed = new Date(utcIso);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback direct parse
  const fallback = new Date(clean);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Format a timestamp as a human-friendly relative time or time in Philippine Time (PHT / UTC+8).
 * e.g. "Just now", "5m ago", "2h ago", "Today, 6:18 PM", "Yesterday, 3:20 PM", "Sep 2, 4:15 PM"
 */
export function formatPHTRelative(isoString?: string): string {
  const date = parseUtcDate(isoString);
  if (!date) return "—";

  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  // Older dates: Format in Philippine Time
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Format a timestamp as standard date and time in Philippine Time (Asia/Manila, UTC+8).
 * e.g. "Sep 4, 2026, 6:18 PM PHT"
 */
export function formatPHTDateTime(isoString?: string): string {
  const date = parseUtcDate(isoString);
  if (!date) return "—";

  const formatted = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${formatted} PHT`;
}

/**
 * Format time only in Philippine Time (Asia/Manila, UTC+8).
 * e.g. "6:18 PM PHT"
 */
export function formatPHTTime(isoString?: string): string {
  const date = parseUtcDate(isoString);
  if (!date) return "—";

  const formatted = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${formatted} PHT`;
}

/**
 * Backwards-compatible formatTimeAgo helper using Philippine relative time.
 */
export function formatTimeAgo(isoString?: string): string {
  return formatPHTRelative(isoString);
}
