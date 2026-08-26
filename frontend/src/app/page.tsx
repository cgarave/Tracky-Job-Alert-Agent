"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { StatsRibbon } from "@/components/stats-ribbon";
import { JobsTab } from "@/components/tabs/jobs-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";
import { ScreeningTab } from "@/components/tabs/screening-tab";
import { AutoApplyTab } from "@/components/tabs/autoapply-tab";
import { SessionsTab } from "@/components/tabs/sessions-tab";
import { HistoryTab } from "@/components/tabs/history-tab";
import { SettingsTab } from "@/components/tabs/settings-tab";
import { ApplyModal } from "@/components/modals/apply-modal";
import { ScreenshotModal } from "@/components/modals/screenshot-modal";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Job,
  UserProfile,
  PlatformSession,
  ApplicationRecord,
  DaemonSettings,
  SystemStatus,
  BrowserInfo,
} from "@/types";
import * as api from "@/lib/api";

const DEFAULT_PROFILE: UserProfile = {
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
    years_of_experience: 0,
    current_title: "",
    expected_salary_php: "",
    notice_period_weeks: 4,
    work_authorization: "Filipino Citizen / Authorized to work in Philippines",
    remote_preference: "Remote / Hybrid",
    willing_to_relocate: false,
    skills: [],
  },
  screening_answers: {
    why_hire_me: "",
    notice_period: "",
    salary_expectation: "",
    relocation: "",
  },
  resume: {
    filename: "",
    path: "",
    uploaded_at: "",
    file_size_bytes: 0,
  },
  auto_apply: {
    enabled: false,
    daily_cap: 5,
    match_threshold: 75,
    blacklisted_companies: [],
    blacklisted_keywords: ["unpaid", "internship"],
  },
};

const DEFAULT_SETTINGS: DaemonSettings = {
  keywords: [],
  location: "Philippines",
  check_interval_minutes: 60,
  recipient: "",
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("jobs");

  // State
  const [statusData, setStatusData] = useState<SystemStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [sessions, setSessions] = useState<Record<string, PlatformSession>>({});
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [settings, setSettings] = useState<DaemonSettings>(DEFAULT_SETTINGS);
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [preferredBrowser, setPreferredBrowser] = useState<string>("brave");

  // Filters & UI States
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Modal States
  const [selectedJobForApply, setSelectedJobForApply] = useState<Job | null>(null);
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // ── Load Data ────────────────────────────────────────────────────────────
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
      const data = await api.fetchJobs(search, platformFilter);
      setJobs(data.jobs || []);
    } catch (e: any) {
      toast.error(`Could not load jobs: ${e.message}`);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [search, platformFilter]);

  const loadProfile = useCallback(async () => {
    try {
      const data = await api.fetchProfile();
      setProfile(data);
    } catch (e) {
      console.error("Profile load error:", e);
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

  const loadBrowsers = useCallback(async () => {
    try {
      const data = await api.fetchBrowsers();
      setBrowsers(data.browsers || []);
      if (data.preferred) {
        setPreferredBrowser(data.preferred);
      }
    } catch (e) {
      console.error("Browsers load error:", e);
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
    try {
      const data = await api.fetchSettings();
      setSettings(data);
      if (data.preferred_browser) {
        setPreferredBrowser(data.preferred_browser);
      }
    } catch (e) {
      console.error("Settings load error:", e);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadJobs();
    loadProfile();
    loadSessions();
    loadBrowsers();
    loadApplications();
    loadSettings();

    // 10s periodic polling
    const interval = setInterval(() => {
      loadStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadStatus, loadJobs, loadProfile, loadSessions, loadBrowsers, loadApplications, loadSettings]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleSaveProfile = async (updated: UserProfile) => {

    setIsSavingProfile(true);
    try {
      const res = await api.saveProfile(updated);
      setProfile(res.profile);
      toast.success("Profile saved successfully!");
    } catch (e: any) {
      toast.error(`Failed to save profile: ${e.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUploadResume = async (file: File) => {
    setIsAnalyzingResume(true);
    try {
      const res = await api.uploadResume(file);
      if (res.profile) {
        setProfile(res.profile);
      } else {
        await loadProfile();
      }
      if (res.ai_analyzed) {
        toast.success(res.message || "✨ Resume uploaded and auto-filled with Gemini AI!");
      } else {
        toast.info(res.message || "Resume uploaded successfully!");
      }
    } catch (e: any) {
      toast.error(`Upload error: ${e.message}`);
    } finally {
      setIsAnalyzingResume(false);
    }
  };

  const handleAnalyzeResume = async () => {
    setIsAnalyzingResume(true);
    toast.info("✨ Analyzing resume with Gemini AI...");
    try {
      const res = await api.analyzeResume();
      if (res.profile) {
        setProfile(res.profile);
      }
      if (res.ai_analyzed) {
        toast.success(res.message || "✨ Profile auto-filled with Gemini AI!");
      } else {
        toast.error(res.message || "AI Analysis could not complete.");
      }
    } catch (e: any) {
      toast.error(`AI Analysis error: ${e.message}`);
    } finally {
      setIsAnalyzingResume(false);
    }
  };


  const handleSaveSettings = async (updated: DaemonSettings) => {
    setIsSavingSettings(true);
    try {
      const res = await api.saveSettings(updated);
      setSettings(res.settings);
      toast.success("Daemon settings saved successfully!");
    } catch (e: any) {
      toast.error(`Failed to save settings: ${e.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSelectBrowser = async (browserId: string) => {
    setPreferredBrowser(browserId);
    try {
      await api.setPreferredBrowser(browserId);
      toast.success(`Default login browser updated to ${browserId.toUpperCase()}`);
      loadBrowsers();
    } catch (e: any) {
      toast.error(`Could not set preferred browser: ${e.message}`);
    }
  };

  const handleLaunchLogin = async (platform: string, customBrowserId?: string) => {
    const browserToUse = customBrowserId || preferredBrowser;
    try {
      const res = await api.launchLogin(platform, browserToUse);
      toast.success(res.message || `Browser window launched with ${browserToUse}! Please log in.`);
      setTimeout(loadSessions, 8000);
    } catch (e: any) {
      toast.error(`Login error: ${e.message}`);
    }
  };

  const handleScanNow = async () => {
    setIsScanning(true);
    toast.info("Triggering scan across Indeed, JobStreet, and OnlineJobs.ph...");
    try {
      const res = await api.triggerScan();
      toast.success(res.message || "Scan initiated!");
      setTimeout(() => {
        loadJobs();
        loadStatus();
      }, 4000);
    } catch (e: any) {
      toast.error(`Could not trigger scan: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmitApply = async (jobId: string, customPitch?: string) => {
    setIsSubmittingApply(true);
    toast.info("Initiating application with authentic PDF resume...");
    try {
      const res = await api.applyToJob(jobId, customPitch, "manual");
      toast.success(res.message || "Application process submitted!");
      setTimeout(() => {
        loadApplications();
        loadJobs();
        loadStatus();
      }, 4000);
    } catch (e: any) {
      toast.error(`Application error: ${e.message}`);
    } finally {
      setIsSubmittingApply(false);
    }
  };

  // Subtitle / Heading map
  const tabTitles: Record<string, { heading: string; subtitle: string }> = {
    jobs: { heading: "Scraped Jobs Feed", subtitle: "Real-time job listings scraped from Philippine job boards." },
    profile: { heading: "Profile & Authentic Resume", subtitle: "Manage your contact info and strictly attached PDF resume." },
    screening: { heading: "Screening Q&A Config", subtitle: "Standard answers for years of experience, salary, and notice period." },
    autoapply: { heading: "Auto-Apply Guardrails", subtitle: "Configure automated 1-click submission quotas and safety filters." },
    sessions: { heading: "Platform Accounts & Sessions", subtitle: "1-click login helper to persist authenticated session cookies." },
    history: { heading: "Applications Audit History", subtitle: "Log of all submitted applications with confirmation screenshots." },
    settings: { heading: "Search & Daemon Settings", subtitle: "Manage search keywords, scrape frequency, and iMessage notifications." },
  };

  const currentHeading = tabTitles[activeTab] || tabTitles.jobs;
  const stats = statusData?.stats || { total_jobs: 0, total_applied: 0, total_failed: 0, today_applied: 0 };

  return (
    <div className="flex min-h-screen bg-[#0b0f17] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased">
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
      <main className="flex-1 p-6 lg:p-10 max-w-7xl overflow-x-hidden">
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
              isLoading={isLoadingJobs}
              onRefresh={loadJobs}
              onOpenApplyModal={(job) => setSelectedJobForApply(job)}
              search={search}
              setSearch={setSearch}
              platformFilter={platformFilter}
              setPlatformFilter={setPlatformFilter}
            />
          )}

          {activeTab === "profile" && (
            <ProfileTab
              profile={profile}
              onSaveProfile={handleSaveProfile}
              onUploadResume={handleUploadResume}
              onAnalyzeResume={handleAnalyzeResume}
              isSaving={isSavingProfile}
              isAnalyzing={isAnalyzingResume}
            />
          )}


          {activeTab === "screening" && (
            <ScreeningTab
              profile={profile}
              onSaveProfile={handleSaveProfile}
              isSaving={isSavingProfile}
            />
          )}

          {activeTab === "autoapply" && (
            <AutoApplyTab
              profile={profile}
              onSaveProfile={handleSaveProfile}
              isSaving={isSavingProfile}
            />
          )}

          {activeTab === "sessions" && (
            <SessionsTab
              sessions={sessions}
              browsers={browsers}
              preferredBrowser={preferredBrowser}
              onSelectBrowser={handleSelectBrowser}
              onLaunchLogin={handleLaunchLogin}
              onRefresh={loadSessions}
              isLoading={isLoadingSessions}
            />
          )}

          {activeTab === "history" && (
            <HistoryTab
              applications={applications}
              onRefresh={loadApplications}
              onViewScreenshot={(filename) => setSelectedScreenshot(filename)}
              isLoading={isLoadingHistory}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              settings={settings}
              browsers={browsers}
              onSaveSettings={handleSaveSettings}
              isSaving={isSavingSettings}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <ApplyModal
        job={selectedJobForApply}
        isOpen={!!selectedJobForApply}
        onClose={() => setSelectedJobForApply(null)}
        profile={profile}
        onSubmitApply={handleSubmitApply}
        isSubmitting={isSubmittingApply}
      />

      <ScreenshotModal
        filename={selectedScreenshot}
        isOpen={!!selectedScreenshot}
        onClose={() => setSelectedScreenshot(null)}
      />

      {/* Sonner Toast Notification Provider */}
      <Toaster />
    </div>
  );
}
