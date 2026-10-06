export interface Job {
  job_id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  location?: string;
  salary?: string;
  apply_type?: string;
  description?: string;
  match_score?: number;
  cv_score?: number | null;
  cv_reasons?: { matched_skills?: string[]; missing_skills?: string[]; title_terms?: string[]; limited_description?: boolean };
  seen_at?: string;
  is_alerted?: boolean | number;
  alerted_at?: string;
  is_saved?: boolean | number;
  application_status?: string;
  search_keywords?: string[] | string;
}

export interface AlertRecipient {
  id: string;
  name: string;
  platform: "imessage" | "telegram";
  destination: string;
  keywords: string[];
  enabled: boolean;
}

export interface DaemonSettings {
  keywords: string[];
  location: string;
  check_interval_minutes: number;
  recipient?: string;
  telegram_bot_token?: string;
  recipients?: AlertRecipient[];
  paused?: boolean;
  _revision?: number;
  telegram_bot_token_configured?: boolean;
}

export interface SystemStatus {
  status: string;
  last_scan_time: string;
  stats: {
    total_jobs: number;
    today_new_jobs?: number;
    total_alerted?: number;
    sources?: Record<string, number>;
  };
  paused: boolean;
  interval: number;
  location: string;
  keywords: string[];
  recipient?: string;
  recipients?: AlertRecipient[];
  telegram_bot_token?: string;
  scan?: { state: string; started_at?: string; completed_at?: string; completed_tasks?: number; total_tasks?: number; new_jobs?: number; source_errors?: Array<{ source: string; keyword: string; error: string }>; source_health?: Record<string, { status: string; keyword?: string; duration_ms?: number; result_count?: number; error?: string }>; deliveries?: Record<string, number> };
}
