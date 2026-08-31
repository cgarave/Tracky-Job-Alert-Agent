"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { Toaster, toast } from "sonner";

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

  // Data Fetchers
  const loadStatus = useCallback(async () => {
    try {
      const data = await api.fetchStatus();
      setStatusData(data);
    } catch (e) {
      console.error("Status load error:", e);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const data = await api.fetchJobs();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error("Jobs load error:", e);
    }
  }, []);

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

    const interval = setInterval(() => {
      loadStatus();
      loadJobs();
      if (activeTab === "settings") {
        loadSettings();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [loadStatus, loadJobs, loadSettings, activeTab]);

  useEffect(() => {
    if (activeTab === "settings") {
      loadSettings();
    }
  }, [activeTab, loadSettings]);

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
      setTimeout(() => {
        loadJobs();
        loadStatus();
      }, 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Could not trigger scan: ${msg}`);
    } finally {
      setIsScanning(false);
    }
  };

  const tabTitles: Record<string, { heading: string; subtitle: string }> = {
    jobs: { heading: "Jobs Discovery Feed", subtitle: "Real-time listings aggregated across Indeed, JobStreet, and OnlineJobs." },
    settings: { heading: "Search & Alert Configuration", subtitle: "Target keywords, search location, scrape frequency, and iMessage notification destination." },
  };

  const currentHeading = tabTitles[activeTab] || tabTitles.jobs;
  const stats = statusData?.stats || { total_jobs: 0, today_new_jobs: 0 };

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalJobs={stats.total_jobs}
        isPaused={!!statusData?.paused}
        onScanNow={handleScanNow}
        isScanning={isScanning}
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

        {/* Tab Switcher Body */}
        <div className="transition-all duration-200">
          {activeTab === "jobs" && (
            <JobsTab
              jobs={jobs}
              totalTrackedCount={stats.total_jobs}
              onRefresh={() => {
                loadJobs();
                loadStatus();
              }}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              settings={settings}
              onSaveSettings={handleSaveSettings}
              isLoading={isLoadingSettings}
            />
          )}
        </div>
      </main>

      {/* Sonner Toast Notification Provider */}
      <Toaster />
    </div>
  );
}
