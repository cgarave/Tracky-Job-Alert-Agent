"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import type { Job } from "@/types";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function DismissedTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setJobs((await api.fetchDismissed()).jobs); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const restore = async (job: api.Job) => { try { await api.restoreJobs([job.job_id]); setJobs((items) => items.filter((item) => item.job_id !== job.job_id)); toast.success("Job restored to the feed"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not restore job"); } };
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4"><h2 className="text-sm font-semibold">Dismissed jobs</h2><p className="text-xs text-slate-500">Restore listings if you dismissed them by mistake.</p></div>{loading ? <div className="p-8 text-center text-sm text-slate-500">Loading dismissed jobs…</div> : jobs.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No dismissed jobs to recover.</div> : <div className="divide-y divide-slate-100">{jobs.map((job) => <div key={job.job_id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{job.title}</p><p className="truncate text-xs text-slate-500">{job.company} · {job.source}</p></div><Button size="sm" variant="outline" onClick={() => void restore(job)}><RotateCcw className="mr-2 h-3.5 w-3.5" />Restore</Button></div>)}</div>}</section>;
}
