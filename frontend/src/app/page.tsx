"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Job,
  DaemonSettings,
  SystemStatus,
} from "@/types";
import * as api from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { StatsRibbon } from "@/components/stats-ribbon";
import { JobsTab } from "@/components/tabs/jobs-tab";
import { SettingsTab } from "@/components/tabs/settings-tab";
import { DeliveryHistoryTab } from "@/components/tabs/delivery-history-tab";
import { DismissedTab } from "@/components/tabs/dismissed-tab";
import { CVTab } from "@/components/tabs/cv-tab";
import { Toaster, toast } from "sonner";

type JobQuery = { search: string; source: string; alertStatus: string; saved: boolean; applicationStatus?: string; sort?: string };

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("jobs");

  // Global State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<DaemonSettings>({
    keywords: [],
    location: "Philippines",
    check_interval_minutes: 60,
    recipient: "",
  });
  const [statusData, setStatusData] = useState<SystemStatus | null>(null);

  // Loading States
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobPage, setJobPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobQuery, setJobQuery] = useState<JobQuery>({ search: "", source: "all", alertStatus: "all", saved: false });
  const previousScanState = useRef<string | undefined>(undefined);

  // Data Fetchers
  const loadJobs = useCallback(async () => {
    try {
      const data = await api.fetchJobs(jobQuery.search, jobQuery.source, jobQuery.alertStatus, jobPage, 25, jobQuery.saved, jobQuery.applicationStatus, undefined, jobQuery.sort);
      setJobs(data.jobs || []);
      setHasNextPage(data.has_next);
      setJobTotal(data.total);
      setJobsError(null);
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : "Could not load jobs");
    }
  }, [jobPage, jobQuery]);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.fetchStatus();
      setStatusData(data);
      setLastUpdated(new Date());
      const scan = data.scan?.state;
      if ((scan === "completed" || scan === "partial") && previousScanState.current !== scan) loadJobs();
      previousScanState.current = scan;
    } catch (e) {
      console.error("Status load error:", e);
    }
  }, [loadJobs]);

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const data = await api.fetchSettings();
      setSettings(data);
    } catch (e) {
      console.error("Settings load error:", e);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadJobs();
    loadSettings();

    const interval = setInterval(loadStatus, 12000);
    return () => clearInterval(interval);
  }, [loadStatus, loadJobs, loadSettings]);

  useEffect(() => {
    if (activeTab === "settings") {
      loadSettings();
    }
  }, [activeTab, loadSettings]);

  useEffect(() => {
    if (statusData?.scan?.state && !["queued", "running"].includes(statusData.scan.state)) {
      setIsScanning(false);
    }
  }, [statusData?.scan?.state]);

  // Actions
  const handleSaveSettings = async (updated: DaemonSettings) => {
    try {
      const res = await api.saveSettings(updated);
      setSettings(res.settings);
      toast.success("Settings updated successfully.");
      loadStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to save settings: ${msg}`);
    }
  };

  const handleScanNow = async () => {
    setIsScanning(true);
    toast.info("Scanning Philippines job boards for fresh listings...");
    try {
      const res = await api.triggerScan();
      toast.success(res.message || "Job scan initiated.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not trigger scan: ${msg}`);
    } finally { /* status polling owns the running state */ }
  };

  const handleDryRun = async () => {
    try {
      const res = await api.triggerDryRun();
      toast.success(res.message || "Safe test scan queued.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not start test scan: ${msg}`);
    }
  };

  const handleJobQueryChange = useCallback((query: JobQuery) => {
    setJobPage(1);
    setJobQuery((current) => JSON.stringify(current) === JSON.stringify(query) ? current : query);
  }, []);

  const tabTitles: Record<string, { heading: string; subtitle: string }> = {
    jobs: { heading: "Jobs Discovery Feed", subtitle: "Real-time listings aggregated across Indeed, JobStreet, and OnlineJobs." },
    settings: { heading: "Search & Alert Configuration", subtitle: "Target keywords, search location, scrape frequency, and iMessage notification destination." },
    deliveries: { heading: "Notification Delivery", subtitle: "Inspect sent alerts, retries, and delivery failures." },
    cv: { heading: "CV Match", subtitle: "See how your experience aligns with tracked jobs." },
  };

  const currentHeading = tabTitles[activeTab] || tabTitles.jobs;
  const stats = statusData?.stats || { total_jobs: 0, today_new_jobs: 0 };
  const scanState = statusData?.scan?.state || (statusData?.paused ? "paused" : "idle");
  const scanBusy = ["queued", "running"].includes(scanState);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalJobs={stats.total_jobs}
        isPaused={!!statusData?.paused}
        onScanNow={handleScanNow}
        onDryRun={handleDryRun}
        isScanning={isScanning || scanBusy}
        location={statusData?.location}
        interval={statusData?.interval}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-8 max-w-7xl overflow-x-hidden">
        <StatsRibbon
          heading={currentHeading.heading}
          subtitle={currentHeading.subtitle}
          totalJobs={stats.total_jobs}
          todayNewJobs={stats.today_new_jobs || 0}
          keywordsCount={statusData?.keywords?.length || settings.keywords.length}
        lastScanTime={statusData?.last_scan_time}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${scanBusy ? "animate-pulse bg-blue-500" : scanState === "failed" ? "bg-red-500" : "bg-emerald-500"}`} />
          <span className="font-semibold capitalize text-slate-800">Scanner {scanState}</span>
          {statusData?.scan?.total_tasks ? <span className="text-slate-500">{statusData.scan.completed_tasks || 0}/{statusData.scan.total_tasks} sources</span> : null}
          {statusData?.scan?.source_errors?.length ? <span className="text-amber-700">{statusData.scan.source_errors.length} source issue(s)</span> : null}
          {statusData?.scan?.source_health && Object.keys(statusData.scan.source_health).length ? <span className="text-slate-500">{Object.values(statusData.scan.source_health).filter((source) => source.status === "completed").length} source(s) reported</span> : null}
        </div>
        <span className="text-slate-500">{lastUpdated ? `Updated at ${lastUpdated.toLocaleTimeString()}` : "Connecting…"}</span>
      </div>

        {/* Tab Switcher Body */}
        <div className="transition-all duration-200">
          {activeTab === "jobs" && (
            <JobsTab
              jobs={jobs}
              totalTrackedCount={jobTotal}
              onRefresh={() => {
                loadJobs();
                loadStatus();
              }}
              isLoading={!statusData && !jobsError}
              error={jobsError}
              page={jobPage}
              hasNextPage={hasNextPage}
              onPageChange={setJobPage}
              availableSources={Object.keys(stats.sources || {})}
              onQueryChange={handleJobQueryChange}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              settings={settings}
              onSaveSettings={handleSaveSettings}
              isLoading={isLoadingSettings}
            />
          )}
          {activeTab === "deliveries" && <DeliveryHistoryTab />}
          {activeTab === "dismissed" && <DismissedTab />}
          {activeTab === "cv" && <CVTab onScoresChanged={() => void loadJobs()} />}
        </div>
      </main>

      {/* Sonner Toast Notification Provider */}
      <Toaster />
    </div>
  );
}
