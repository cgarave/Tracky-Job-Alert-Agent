import { Job, DaemonSettings, SystemStatus } from "@/types";

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

export async function triggerScan(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/scan-now`, { method: "POST" });
  return handleResponse<{ status: string; message: string }>(res);
}

export async function pauseDaemon(): Promise<{ status: string; paused: boolean }> {
  const res = await fetch(`${API_BASE}/api/pause`, { method: "POST" });
  return handleResponse<{ status: string; paused: boolean }>(res);
}

export async function resumeDaemon(): Promise<{ status: string; paused: boolean }> {
  const res = await fetch(`${API_BASE}/api/resume`, { method: "POST" });
  return handleResponse<{ status: string; paused: boolean }>(res);
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
