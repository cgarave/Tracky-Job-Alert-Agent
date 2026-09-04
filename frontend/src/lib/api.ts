import { Job, DaemonSettings, SystemStatus, CandidateProfile, ApplicationLog, AISessionStatus } from "@/types";

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

export async function fetchJobs(
  search?: string,
  source?: string,
  alertStatus?: string
): Promise<{ jobs: Job[]; total: number }> {
  const params = new URLSearchParams({ limit: "100" });
  if (search) params.append("search", search);
  if (source && source !== "all") params.append("source", source);
  if (alertStatus && alertStatus !== "all") params.append("alert_status", alertStatus);
  const res = await fetch(`${API_BASE}/api/jobs?${params.toString()}`);
  return handleResponse<{ jobs: Job[]; total: number }>(res);
}

export async function deleteJobs(
  jobIds: string[],
  blockFuture: boolean = true
): Promise<{ status: string; deleted_count: number; stats?: SystemStatus["stats"] }> {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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

export async function fetchProfile(): Promise<CandidateProfile> {
  const res = await fetch(`${API_BASE}/api/profile`);
  return handleResponse<CandidateProfile>(res);
}

export async function saveProfile(profile: CandidateProfile): Promise<{ status: string; profile: CandidateProfile }> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return handleResponse<{ status: string; profile: CandidateProfile }>(res);
}

export async function uploadResume(filename: string, base64Data: string): Promise<{ status: string; filename: string; parsed_fields: Partial<CandidateProfile>; profile: CandidateProfile }> {
  const res = await fetch(`${API_BASE}/api/profile/resume-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content_base64: base64Data }),
  });
  return handleResponse<{ status: string; filename: string; parsed_fields: Partial<CandidateProfile>; profile: CandidateProfile }>(res);
}

export async function deleteResume(): Promise<{ status: string; profile: CandidateProfile }> {
  const res = await fetch(`${API_BASE}/api/profile/resume-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse<{ status: string; profile: CandidateProfile }>(res);
}

export async function testGeminiKey(apiKey: string, modelName: string = "gemini-3.7-flash"): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/ai/test-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, model_name: modelName }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function fetchApplications(): Promise<{ applications: ApplicationLog[]; total: number }> {
  const res = await fetch(`${API_BASE}/api/applications`);
  return handleResponse<{ applications: ApplicationLog[]; total: number }>(res);
}

export async function fetchAISessionStatus(): Promise<AISessionStatus> {
  const res = await fetch(`${API_BASE}/api/ai/session/status`);
  return handleResponse<AISessionStatus>(res);
}

export async function startAISession(mode: string = "batch", job: Job | null = null): Promise<{ status: string; session: AISessionStatus }> {
  const res = await fetch(`${API_BASE}/api/ai/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, job }),
  });
  return handleResponse<{ status: string; session: AISessionStatus }>(res);
}

export async function pauseAISession(): Promise<{ status: string; session: AISessionStatus }> {
  const res = await fetch(`${API_BASE}/api/ai/session/pause`, { method: "POST" });
  return handleResponse<{ status: string; session: AISessionStatus }>(res);
}

export async function resumeAISession(): Promise<{ status: string; session: AISessionStatus }> {
  const res = await fetch(`${API_BASE}/api/ai/session/resume`, { method: "POST" });
  return handleResponse<{ status: string; session: AISessionStatus }>(res);
}

export async function stopAISession(): Promise<{ status: string; session: AISessionStatus }> {
  const res = await fetch(`${API_BASE}/api/ai/session/stop`, { method: "POST" });
  return handleResponse<{ status: string; session: AISessionStatus }>(res);
}

export async function saveAISessionSettings(settings: Partial<CandidateProfile["ai_settings"]>): Promise<{ status: string; ai_settings: CandidateProfile["ai_settings"] }> {
  const res = await fetch(`${API_BASE}/api/ai/session-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return handleResponse<{ status: string; ai_settings: CandidateProfile["ai_settings"] }>(res);
}

export async function fetchQAMemory(search?: string, category?: string): Promise<{ items: import("@/types").QAMemoryItem[] }> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/api/qa-memory${qs}`);
  return handleResponse<{ items: import("@/types").QAMemoryItem[] }>(res);
}

export async function saveQAMemory(question_text: string, answer_value: string, category: string = "general"): Promise<{ status: string; id: number }> {
  const res = await fetch(`${API_BASE}/api/qa-memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_text, answer_value, category }),
  });
  return handleResponse<{ status: string; id: number }>(res);
}

export async function deleteQAMemory(memoryId: number): Promise<{ status: string; success: boolean }> {
  const res = await fetch(`${API_BASE}/api/qa-memory`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: memoryId }),
  });
  return handleResponse<{ status: string; success: boolean }>(res);
}
