"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Job,
  UserProfile,
  PlatformSession,
  ApplicationRecord,
  DaemonSettings,
  SystemStatus,
} from "@/types";
import * as api from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { StatsRibbon } from "@/components/stats-ribbon";
import { JobsTab } from "@/components/tabs/jobs-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";
import { ScreeningTab } from "@/components/tabs/screening-tab";
import { AutoApplyTab } from "@/components/tabs/autoapply-tab";
import { SessionsTab } from "@/components/tabs/sessions-tab";
import { HistoryTab } from "@/components/tabs/history-tab";
import { SettingsTab } from "@/components/tabs/settings-tab";
import { ConnectPlatformModal } from "@/components/modals/connect-platform-modal";
import { ApplyModal } from "@/components/modals/apply-modal";
import { ScreenshotModal } from "@/components/modals/screenshot-modal";
import { Toaster, toast } from "sonner";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("jobs");

  // Global State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    personal: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      location: "",
      headline: "",
      linkedin_url: "",
      github_url: "",
      portfolio_url: "",
    },
    work_preferences: {
      years_of_experience: 3,
      current_title: "",
      expected_salary_php: "100000",
      notice_period_weeks: 4,
      work_authorization: "Yes",
      remote_preference: "Remote",
      willing_to_relocate: false,
      skills: [],
    },
    screening_answers: {
      why_hire_me: "",
      notice_period: "30 days",
      salary_expectation: "PHP 100,000",
      relocation: "No",
    },
    resume: { filename: "", path: "", uploaded_at: "", file_size_bytes: 0 },
    auto_apply: {
      enabled: false,
      daily_cap: 5,
      match_threshold: 75,
      blacklisted_companies: [],
      blacklisted_keywords: [],
    },
  });
  const [sessions, setSessions] = useState<Record<string, PlatformSession>>({});
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [settings, setSettings] = useState<DaemonSettings>({
    keywords: [],
    location: "Philippines",
    check_interval_minutes: 60,
    recipient: "",
    gemini_api_key: "",
  });
  const [statusData, setStatusData] = useState<SystemStatus | null>(null);

  // Loading States
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSubmittingApply, setIsSubmittingApply] = useState<boolean>(false);

  // Modal States
  const [selectedPlatformForConnect, setSelectedPlatformForConnect] = useState<string | null>(null);
  const [selectedJobForApply, setSelectedJobForApply] = useState<Job | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

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
    setIsLoadingJobs(true);
    try {
      const data = await api.fetchJobs();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error("Jobs load error:", e);
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const data = await api.fetchProfile();
      setProfile(data || {});
    } catch (e) {
      console.error("Profile load error:", e);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const data = await api.fetchSessions();
      setSessions(data.sessions || {});
    } catch (e) {
      console.error("Sessions load error:", e);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.fetchApplications();
      setApplications(data.applications || []);
    } catch (e) {
      console.error("Applications load error:", e);
    } finally {
      setIsLoadingHistory(false);
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
    loadProfile();
    loadSessions();
    loadApplications();
    loadSettings();

    const interval = setInterval(() => {
      loadStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadStatus, loadJobs, loadProfile, loadSessions, loadApplications, loadSettings]);

  // Actions
  const handleSaveProfile = async (updated: UserProfile) => {
    try {
      const res = await api.saveProfile(updated);
      setProfile(res.profile);
      toast.success("Profile updated successfully.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to save profile: ${msg}`);
    }
  };

  const handleSaveSettings = async (updated: DaemonSettings) => {
    try {
      const res = await api.saveSettings(updated);
      setSettings(res.settings);
      toast.success("Settings updated successfully.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to save settings: ${msg}`);
    }
  };

  const handleLaunchLogin = async (platform: string) => {
    try {
      const res = await api.launchLogin(platform);
      toast.info(res.message || "Browser session helper launched. Please complete login.");
      loadSessions();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Login error: ${msg}`);
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

  const handleSubmitApply = async (jobId: string, customPitch?: string) => {
    setIsSubmittingApply(true);
    toast.info("Submitting application with authentic PDF resume...");
    try {
      const res = await api.applyToJob(jobId, customPitch, "manual");
      if (res.success) {
        toast.success(res.message || "Application submitted successfully.");
      } else if (res.external) {
        toast.info(res.message || "External portal application recorded.");
      } else {
        toast.warning(res.message || "Application could not be completed.");
      }
      setTimeout(() => {
        loadApplications();
        loadJobs();
        loadStatus();
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Application error: ${msg}`);
    } finally {
      setIsSubmittingApply(false);
    }
  };

  const tabTitles: Record<string, { heading: string; subtitle: string }> = {
    jobs: { heading: "Scraped Jobs Feed", subtitle: "Real-time listings filtered by recency and deduplicated." },
    profile: { heading: "Profile & Authentic Resume", subtitle: "Manage contact information and strictly attached PDF document." },
    screening: { heading: "Screening Q&A Config", subtitle: "Standardized answers for years of experience, salary, and availability." },
    autoapply: { heading: "Auto-Apply Guardrails", subtitle: "Configure autonomous application quotas, match threshold, and filters." },
    sessions: { heading: "Platform Accounts & Sessions", subtitle: "Persist authenticated cookies to bypass Cloudflare anti-bot checks." },
    history: { heading: "Applications Audit History", subtitle: "Audit log of all submissions with post-submit confirmation screenshots." },
    settings: { heading: "Search & Daemon Configuration", subtitle: "Target keywords, search location, scrape frequency, and alert recipient." },
  };

  const currentHeading = tabTitles[activeTab] || tabTitles.jobs;
  const stats = statusData?.stats || { total_jobs: 0, total_applied: 0, total_failed: 0, today_applied: 0 };

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalJobs={stats.total_jobs}
        totalApplied={stats.total_applied}
        isPaused={!!statusData?.paused}
        resumeName={profile.resume?.filename}
        onScanNow={handleScanNow}
        isScanning={isScanning}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-8 max-w-7xl overflow-x-hidden">
        <StatsRibbon
          heading={currentHeading.heading}
          subtitle={currentHeading.subtitle}
          totalJobs={stats.total_jobs}
          totalApplied={stats.total_applied}
          todayApplied={stats.today_applied}
          lastScanTime={statusData?.last_scan_time}
        />

        {/* Tab Switcher Body */}
        <div className="transition-all duration-200">
          {activeTab === "jobs" && (
            <JobsTab
              jobs={jobs}
              onOpenApplyModal={(job) => setSelectedJobForApply(job)}
              profile={profile}
            />
          )}

          {activeTab === "profile" && (
            <ProfileTab
              profile={profile}
              onSaveProfile={handleSaveProfile}
              onRefreshProfile={loadProfile}
              isLoading={isLoadingProfile}
            />
          )}

          {activeTab === "screening" && (
            <ScreeningTab
              profile={profile}
              onSaveProfile={handleSaveProfile}
              isLoading={isLoadingProfile}
            />
          )}

          {activeTab === "autoapply" && (
            <AutoApplyTab
              profile={profile}
              onSaveProfile={handleSaveProfile}
              isLoading={isLoadingProfile}
            />
          )}

          {activeTab === "sessions" && (
            <SessionsTab
              sessions={sessions}
              onLaunchLogin={handleLaunchLogin}
              onOpenConnectModal={(p) => setSelectedPlatformForConnect(p)}
              onRefresh={loadSessions}
              isLoading={isLoadingSessions}
            />
          )}

          {activeTab === "history" && (
            <HistoryTab
              applications={applications}
              onRefresh={loadApplications}
              onViewScreenshot={(filename) =>
                setSelectedScreenshot(
                  filename.startsWith("http") ? filename : `/api/screenshot/${filename}`
                )
              }
              isLoading={isLoadingHistory}
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

      {/* Modals */}
      <ConnectPlatformModal
        platformKey={selectedPlatformForConnect}
        isOpen={!!selectedPlatformForConnect}
        onClose={() => setSelectedPlatformForConnect(null)}
        sessions={sessions}
        onRefreshSessions={loadSessions}
      />

      <ApplyModal
        job={selectedJobForApply}
        isOpen={!!selectedJobForApply}
        onClose={() => setSelectedJobForApply(null)}
        profile={profile}
        onSubmitApply={handleSubmitApply}
        isSubmitting={isSubmittingApply}
      />

      <ScreenshotModal
        screenshotUrl={selectedScreenshot}
        isOpen={!!selectedScreenshot}
        onClose={() => setSelectedScreenshot(null)}
      />

      {/* Sonner Toast Notification Provider */}
      <Toaster />
    </div>
  );
}
