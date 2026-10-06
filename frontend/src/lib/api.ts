import { Job, DaemonSettings, SystemStatus } from "@/types";
export type { Job } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
let csrfToken: string | null = null;
async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const res = await fetch(`${API_BASE}/api/session`, { cache: "no-store" });
    if (!res.ok) throw new Error("Dashboard session could not be established");
    csrfToken = (await res.json()).token;
  }
  return csrfToken as string;
}
async function mutationHeaders(): Promise<Record<string, string>> {
  return { "Content-Type": "application/json", "X-Tracky-Token": await getCsrfToken() };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.message || errData.error || errData.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/api/status`);
  return handleResponse<SystemStatus>(res);
}

export type CVSummary = { uploaded: boolean; filename?: string; skills?: string[]; keyword_count?: number; scored_jobs?: number; analysis?: "local" | "gemini"; summary?: string };
export async function fetchCV(): Promise<CVSummary> {
  return handleResponse<CVSummary>(await fetch(`${API_BASE}/api/cv`));
}
export async function uploadCV(file: File): Promise<CVSummary> {
  if (file.size > 4 * 1024 * 1024) throw new Error("CV must be 4 MiB or smaller");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.onerror = () => reject(new Error("Could not read the CV file"));
    reader.readAsDataURL(file);
  });
  return handleResponse<CVSummary>(await fetch(`${API_BASE}/api/cv`, { method: "POST", headers: await mutationHeaders(), body: JSON.stringify({ filename: file.name, data }) }));
}
export async function removeCV(): Promise<CVSummary> {
  return handleResponse<CVSummary>(await fetch(`${API_BASE}/api/cv/remove`, { method: "POST", headers: await mutationHeaders(), body: "{}" }));
}
export async function analyzeCVWithGemini(apiKey: string): Promise<CVSummary> {
  return handleResponse<CVSummary>(await fetch(`${API_BASE}/api/cv/analyze`, { method: "POST", headers: await mutationHeaders(), body: JSON.stringify({ api_key: apiKey }) }));
}

export async function fetchJobs(
  search?: string,
  source?: string,
  alertStatus?: string,
  page = 1,
  pageSize = 25,
  saved = false,
  applicationStatus?: string,
  since?: string,
  sort = "newest"
): Promise<{ jobs: Job[]; total: number; page: number; page_size: number; has_next: boolean }> {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("page_size", pageSize.toString());
  if (search) params.append("search", search);
  if (source && source !== "all") params.append("source", source);
  if (alertStatus && alertStatus !== "all") params.append("alert_status", alertStatus);
  if (saved) params.append("saved", "true");
  if (applicationStatus) params.append("application_status", applicationStatus);
  if (since) params.append("since", since);
  if (sort !== "newest") params.append("sort", sort);
  const queryString = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/api/jobs${queryString}`);
  return handleResponse<{ jobs: Job[]; total: number; page: number; page_size: number; has_next: boolean }>(res);
}

async function updateJobs(path: string, jobIds: string[], extra: Record<string, unknown> = {}) {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: await mutationHeaders(), body: JSON.stringify({ job_ids: jobIds, ...extra }) });
  return handleResponse<{ status: string; updated_count: number }>(res);
}
export const saveJobs = (jobIds: string[], saved = true) => updateJobs("/api/jobs/save", jobIds, { saved });
export const markJobsApplied = (jobIds: string[], status = "applied") => updateJobs("/api/jobs/apply", jobIds, { status });
export const restoreJobs = (jobIds: string[]) => updateJobs("/api/jobs/restore", jobIds);
export async function fetchDismissed() {
  const res = await fetch(`${API_BASE}/api/dismissed`);
  return handleResponse<{ jobs: Job[] }>(res);
}
export async function fetchDeliveryHistory() {
  const res = await fetch(`${API_BASE}/api/delivery-history`);
  return handleResponse<{ deliveries: Array<Record<string, unknown>> }>(res);
}

export async function deleteJobs(
  jobIds: string[],
  blockFuture: boolean = true
): Promise<{ status: string; deleted_count: number; stats?: SystemStatus["stats"] }> {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: "DELETE",
    headers: await mutationHeaders(),
    body: JSON.stringify({ job_ids: jobIds, block_future: blockFuture }),
  });
  return handleResponse<{ status: string; deleted_count: number; stats?: SystemStatus["stats"] }>(res);
}

export async function deleteAllJobs(
  blockFuture: boolean = true,
  search?: string,
  source?: string
): Promise<{ status: string; deleted_count: number; stats?: SystemStatus["stats"] }> {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: "DELETE",
    headers: await mutationHeaders(),
    body: JSON.stringify({
      all: true,
      block_future: blockFuture,
      search: search || undefined,
      source: source && source !== "all" ? source : undefined,
    }),
  });
  return handleResponse<{ status: string; deleted_count: number; stats?: SystemStatus["stats"] }>(res);
}

export async function triggerScan(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/scan-now`, { method: "POST", headers: await mutationHeaders() });
  return handleResponse<{ status: string; message: string }>(res);
}

export async function triggerDryRun(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/scan-dry-run`, { method: "POST", headers: await mutationHeaders() });
  return handleResponse<{ status: string; message: string }>(res);
}

export async function pauseDaemon(): Promise<{ status: string; paused: boolean }> {
  const res = await fetch(`${API_BASE}/api/pause`, { method: "POST", headers: await mutationHeaders() });
  return handleResponse<{ status: string; paused: boolean }>(res);
}

export async function resumeDaemon(): Promise<{ status: string; paused: boolean }> {
  const res = await fetch(`${API_BASE}/api/resume`, { method: "POST", headers: await mutationHeaders() });
  return handleResponse<{ status: string; paused: boolean }>(res);
}

export async function fetchSettings(): Promise<DaemonSettings> {
  const res = await fetch(`${API_BASE}/api/settings`);
  return handleResponse<DaemonSettings>(res);
}

export async function saveSettings(settings: DaemonSettings): Promise<{ status: string; settings: DaemonSettings }> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "POST",
    headers: await mutationHeaders(),
    body: JSON.stringify(settings),
  });
  return handleResponse<{ status: string; settings: DaemonSettings }>(res);
}

export async function testNotification(payload: {
  platform: string;
  destination: string;
  bot_token?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/test-notification`, {
    method: "POST",
    headers: await mutationHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}
