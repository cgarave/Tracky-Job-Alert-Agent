"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Job } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteConfirmModal } from "@/components/modals/delete-confirm-modal";
import { JobDetailsModal } from "@/components/modals/job-details-modal";
import {
  ExternalLink,
  Search,
  Building2,
  MapPin,
  Banknote,
  LayoutGrid,
  List,
  Clock,
  Trash2,
  CheckSquare,
  X,
  Sparkles,
  Eye,
  FileText,
  Smartphone,
  Globe,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import * as api from "@/lib/api";
import { toast } from "sonner";

interface JobsTabProps {
  jobs: Job[];
  totalTrackedCount: number;
  onRefresh: () => void;
}

export function JobsTab({ jobs, totalTrackedCount, onRefresh }: JobsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedAlertFilter, setSelectedAlertFilter] = useState<"all" | "alerted" | "unalerted">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "selected" | "single" | "all_filtered" | "all_database";
    count: number;
    singleJob?: Job;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Job Details modal state
  const [activeDetailJob, setActiveDetailJob] = useState<Job | null>(null);

  const sources = useMemo(() => ["all", ...Array.from(new Set(jobs.map((j) => j.source)))], [jobs]);

  // Counts for Alert status filter pills
  const alertedCount = useMemo(() => jobs.filter((j) => Boolean(j.is_alerted)).length, [jobs]);
  const unalertedCount = jobs.length - alertedCount;

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSource = selectedSource === "all" || job.source === selectedSource;
      const matchesAlert =
        selectedAlertFilter === "all" ||
        (selectedAlertFilter === "alerted" && Boolean(job.is_alerted)) ||
        (selectedAlertFilter === "unalerted" && !job.is_alerted);
      return matchesSearch && matchesSource && matchesAlert;
    });
  }, [jobs, searchTerm, selectedSource, selectedAlertFilter]);

  // Master Select All status for filtered items
  const isAllFilteredSelected = filteredJobs.length > 0 && filteredJobs.every((j) => selectedIds.has(j.job_id));
  const isSomeFilteredSelected = filteredJobs.some((j) => selectedIds.has(j.job_id)) && !isAllFilteredSelected;

  const masterCheckboxState: boolean | "indeterminate" = isAllFilteredSelected
    ? true
    : isSomeFilteredSelected
    ? "indeterminate"
    : false;

  // Toggle single item selection with Shift+Click range support
  const handleToggleSelect = (jobId: string, e?: React.MouseEvent) => {
    const isShift = e?.shiftKey;
    const next = new Set(selectedIds);

    if (isShift && lastSelectedId && lastSelectedId !== jobId) {
      const currentIndex = filteredJobs.findIndex((j) => j.job_id === jobId);
      const lastIndex = filteredJobs.findIndex((j) => j.job_id === lastSelectedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const shouldSelect = !selectedIds.has(jobId);

        for (let i = start; i <= end; i++) {
          const id = filteredJobs[i].job_id;
          if (shouldSelect) {
            next.add(id);
          } else {
            next.delete(id);
          }
        }
      }
    } else {
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
    }

    setLastSelectedId(jobId);
    setSelectedIds(next);
  };

  // Toggle master select all for currently filtered items
  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const next = new Set(selectedIds);
      filteredJobs.forEach((j) => next.delete(j.job_id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredJobs.forEach((j) => next.add(j.job_id));
      setSelectedIds(next);
    }
  };

  // Select all jobs across the database
  const handleSelectEntireDatabase = () => {
    const next = new Set(jobs.map((j) => j.job_id));
    setSelectedIds(next);
    toast.info(`Selected all ${jobs.length} jobs loaded.`);
  };

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  // Keyboard shortcut: Escape to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIds.size > 0 && !isDeleteModalOpen && !activeDetailJob) {
        handleClearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, isDeleteModalOpen, activeDetailJob, handleClearSelection]);

  // Open delete modal for single item
  const handlePromptSingleDelete = (job: Job, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget({
      type: "single",
      count: 1,
      singleJob: job,
    });
    setIsDeleteModalOpen(true);
  };

  // Open delete modal for bulk selection
  const handlePromptBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({
      type: "selected",
      count: selectedIds.size,
    });
    setIsDeleteModalOpen(true);
  };

  // Confirm delete execution
  const handleConfirmDelete = async (blockFuture: boolean) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "single" && deleteTarget.singleJob) {
        await api.deleteJobs([deleteTarget.singleJob.job_id], blockFuture);
        toast.success(`Deleted “${deleteTarget.singleJob.title}”`);
        const next = new Set(selectedIds);
        next.delete(deleteTarget.singleJob.job_id);
        setSelectedIds(next);
      } else if (deleteTarget.type === "selected") {
        const ids = Array.from(selectedIds);
        const res = await api.deleteJobs(ids, blockFuture);
        toast.success(`Deleted ${res.deleted_count} job listings.`);
        handleClearSelection();
      }
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      toast.error(`Deletion failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 relative pb-16">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 backdrop-blur-xl">
        <div className="flex flex-1 items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 focus-within:border-indigo-500/60 transition-colors">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by title, role, company, location, or skills in description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* iMessage Alert Sent Filter */}
          <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedAlertFilter("all")}
              className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                selectedAlertFilter === "all"
                  ? "bg-slate-800 text-white font-medium shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedAlertFilter("alerted")}
              className={`px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1.5 ${
                selectedAlertFilter === "alerted"
                  ? "bg-indigo-600 text-white font-medium shadow-sm"
                  : "text-indigo-400 hover:text-indigo-200"
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>Alert Sent ({alertedCount})</span>
            </button>
            <button
              onClick={() => setSelectedAlertFilter("unalerted")}
              className={`px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1.5 ${
                selectedAlertFilter === "unalerted"
                  ? "bg-slate-800 text-white font-medium shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Web ({unalertedCount})</span>
            </button>
          </div>

          {/* Source Filter Tabs */}
          <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            {sources.map((src) => (
              <button
                key={src}
                onClick={() => setSelectedSource(src)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  selectedSource === src
                    ? "bg-indigo-600 text-white font-medium shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {src === "all" ? `All Sources` : src}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "table"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Compact Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Header, Selection Status & Select All Checkbox */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={masterCheckboxState}
              onCheckedChange={handleToggleSelectAll}
              id="select-all-filtered"
              aria-label="Select all listings"
            />
            <label htmlFor="select-all-filtered" className="cursor-pointer font-medium text-slate-300 select-none">
              Select All ({filteredJobs.length})
            </label>
          </div>

          {selectedIds.size > 0 && (
            <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        <span>
          Showing <strong className="text-white font-mono">{filteredJobs.length}</strong> of {totalTrackedCount} listings
        </span>
      </div>

      {/* Empty State */}
      {filteredJobs.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800/80 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <CardTitle className="text-sm font-semibold text-white mb-1">
            No matching job listings found
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Try adjusting your search keywords, clearing filters, or triggering a scan.
          </CardDescription>
        </Card>
      ) : viewMode === "table" ? (
        /* High-Density Enterprise Table View */
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60 select-none">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <Checkbox
                      checked={masterCheckboxState}
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all rows"
                    />
                  </th>
                  <th className="py-3 px-3">Title & Company</th>
                  <th className="py-3 px-3">Platform & Delivery</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Salary</th>
                  <th className="py-3 px-3">Discovered</th>
                  <th className="py-3 pr-4 pl-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredJobs.map((job) => {
                  const isSelected = selectedIds.has(job.job_id);
                  const isAlerted = Boolean(job.is_alerted);

                  return (
                    <tr
                      key={job.job_id}
                      onClick={(e) => handleToggleSelect(job.job_id, e)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-indigo-500/10 hover:bg-indigo-500/15"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(job.job_id)}
                          aria-label={`Select ${job.title}`}
                        />
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDetailJob(job);
                          }}
                          className="font-semibold text-white hover:text-indigo-400 transition-colors text-left block truncate"
                          title="Click to view full description"
                        >
                          {job.title}
                        </button>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{job.company}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] bg-slate-950 border-slate-800 text-slate-300">
                            {job.source}
                          </Badge>
                          {isAlerted ? (
                            <Badge variant="outline" className="text-[10px] bg-indigo-500/15 border-indigo-500/30 text-indigo-300 gap-1 flex items-center">
                              <Smartphone className="w-2.5 h-2.5 text-indigo-400" />
                              <span>Alert Sent</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-slate-950/60 border-slate-800/60 text-slate-500 gap-1 flex items-center">
                              <Globe className="w-2.5 h-2.5 text-slate-600" />
                              <span>Web</span>
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{job.location || "Philippines"}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                          <Banknote className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{job.salary || "Negotiable"}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatTimeAgo(job.seen_at)}</span>
                        </div>
                      </td>

                      <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveDetailJob(job)}
                            className="h-7 px-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-1 rounded-md"
                            title="View full description & details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Details</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-7 px-2.5 text-xs bg-indigo-950/60 border-indigo-850 hover:bg-indigo-600 hover:text-white text-indigo-300 gap-1.5 transition-colors"
                            title="Auto-apply with Tracky Extension"
                          >
                            <a href={job.url} target="_blank" rel="noopener noreferrer">
                              <Zap className="w-3 h-3 text-indigo-400" />
                              <span>Apply</span>
                            </a>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-1 rounded-md"
                            title="Open direct job URL"
                          >
                            <a href={job.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handlePromptSingleDelete(job, e)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md"
                            title="Delete this job listing"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Visual Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const isSelected = selectedIds.has(job.job_id);
            const isAlerted = Boolean(job.is_alerted);

            return (
              <Card
                key={job.job_id}
                onClick={(e) => handleToggleSelect(job.job_id, e)}
                className={`flex flex-col justify-between transition-all backdrop-blur-xl shadow-lg cursor-pointer ${
                  isSelected
                    ? "bg-slate-900/90 border-indigo-500/60 ring-1 ring-indigo-500/50"
                    : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80"
                }`}
              >
                <CardHeader className="pb-3 relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(job.job_id)}
                          aria-label={`Select ${job.title}`}
                        />
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-slate-950 border-slate-800 text-slate-300">
                        {job.source}
                      </Badge>

                      {isAlerted ? (
                        <Badge variant="outline" className="text-[10px] bg-indigo-500/15 border-indigo-500/30 text-indigo-300 gap-1 flex items-center">
                          <Smartphone className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Alert Sent</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-slate-950/60 border-slate-800/60 text-slate-500 gap-1 flex items-center">
                          <Globe className="w-2.5 h-2.5 text-slate-600" />
                          <span>Web</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-600" />
                        {formatTimeAgo(job.seen_at)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handlePromptSingleDelete(job, e)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors ml-1"
                        title="Delete listing"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <CardTitle
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDetailJob(job);
                    }}
                    className="text-sm font-bold text-white hover:text-indigo-400 transition-colors line-clamp-2 leading-snug cursor-pointer"
                    title="Click to view full description"
                  >
                    {job.title}
                  </CardTitle>

                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{job.company}</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[140px]">{job.location || "Philippines"}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                        <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{job.salary || "Negotiable"}</span>
                      </div>
                    </div>

                    {/* Scraped Job Description Teaser */}
                    {job.description && (
                      <p
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDetailJob(job);
                        }}
                        className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 hover:border-slate-700 cursor-pointer transition-colors"
                        title="Click to read full description"
                      >
                        {job.description}
                      </p>
                    )}

                    <div className="mt-2 pt-2 border-t border-slate-800/40 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="flex-1 text-xs h-8 bg-indigo-950/60 border-indigo-850 hover:bg-indigo-600 hover:text-white text-indigo-200 gap-1.5 transition-colors shadow-sm"
                        title="Auto-apply with Tracky Extension"
                      >
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          <Zap className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Apply</span>
                        </a>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveDetailJob(job)}
                        className="flex-1 text-xs h-8 bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300 gap-1.5 transition-colors shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Details</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                        title="Open direct job URL"
                      >
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Bulk Action Bar (Linear / Raycast Aesthetic) */}
      {selectedIds.size > 0 && (
        <aside
          aria-label="Bulk actions toolbar"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-indigo-500/40 text-slate-100 px-4 py-2.5 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-2xl flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-white font-mono">
              {selectedIds.size} <span className="text-slate-400 font-sans font-normal">selected</span>
            </span>
          </div>

          {/* If all filtered are selected and there are more in database, show banner */}
          {isAllFilteredSelected && filteredJobs.length < totalTrackedCount && (
            <button
              type="button"
              onClick={handleSelectEntireDatabase}
              className="text-xs text-indigo-300 hover:text-white underline underline-offset-2 flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Select all {totalTrackedCount} in database</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handlePromptBulkDelete}
              className="h-7 px-3 text-xs gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm shadow-rose-600/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.size})</span>
            </Button>

            <button
              type="button"
              onClick={handleClearSelection}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
              title="Clear selection (Press Escape)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
              <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-800 text-slate-400 px-1 py-0.2 rounded border border-slate-700 ml-0.5">
                Esc
              </kbd>
            </button>
          </div>
        </aside>
      )}

      {/* Single / Bulk Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        count={deleteTarget?.count || 0}
        singleJobTitle={deleteTarget?.singleJob?.title}
        isDeleting={isDeleting}
      />

      {/* Full Job Description & Details Modal */}
      <JobDetailsModal
        job={activeDetailJob}
        isOpen={!!activeDetailJob}
        onClose={() => setActiveDetailJob(null)}
        onDelete={(job) => handlePromptSingleDelete(job)}
      />
    </div>
  );
}
