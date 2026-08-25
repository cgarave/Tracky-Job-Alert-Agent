import { Job, UserProfile, PlatformSession, ApplicationRecord, DaemonSettings, SystemStatus } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/api/status`);
  return handleResponse<SystemStatus>(res);
}

export async function fetchJobs(search?: string, source?: string): Promise<{ jobs: Job[]; total: number }> {
  const params = new URLSearchParams({ limit: "100" });
  if (search) params.append("search", search);
  if (source) params.append("source", source);
  const res = await fetch(`${API_BASE}/api/jobs?${params.toString()}`);
  return handleResponse<{ jobs: Job[]; total: number }>(res);
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/profile`);
  return handleResponse<UserProfile>(res);
}

export async function saveProfile(profile: UserProfile): Promise<{ status: string; profile: UserProfile }> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return handleResponse<{ status: string; profile: UserProfile }>(res);
}

export async function uploadResume(file: File): Promise<{ status: string; message: string; path: string }> {
  const formData = new FormData();
  formData.append("resume", file);
  const res = await fetch(`${API_BASE}/api/resume/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<{ status: string; message: string; path: string }>(res);
}

export async function fetchSessions(): Promise<{ sessions: Record<string, PlatformSession> }> {
  const res = await fetch(`${API_BASE}/api/sessions`);
  return handleResponse<{ sessions: Record<string, PlatformSession> }>(res);
}

export async function launchLogin(platform: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/sessions/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
  return handleResponse<{ status: string; message: string }>(res);
}

export async function fetchApplications(): Promise<{ applications: ApplicationRecord[] }> {
  const res = await fetch(`${API_BASE}/api/applications`);
  return handleResponse<{ applications: ApplicationRecord[] }>(res);
}

export async function applyToJob(jobId: string, customNote?: string, mode: string = "manual"): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, custom_note: customNote, mode }),
  });
  return handleResponse<{ status: string; message: string }>(res);
}

export async function triggerScan(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/scan-now`, { method: "POST" });
  return handleResponse<{ status: string; message: string }>(res);
}

export async function fetchSettings(): Promise<DaemonSettings> {
  const res = await fetch(`${API_BASE}/api/settings`);
  return handleResponse<DaemonSettings>(res);
}

export async function saveSettings(settings: DaemonSettings): Promise<{ status: string; settings: DaemonSettings }> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return handleResponse<{ status: string; settings: DaemonSettings }>(res);
}
