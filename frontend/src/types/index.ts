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
  seen_at?: string;
  is_alerted?: boolean | number;
  alerted_at?: string;
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
}
