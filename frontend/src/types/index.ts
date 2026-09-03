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
  application_status?: string;
  application_date?: string;
}

export interface ScreeningDefaults {
  expected_salary_monthly_php?: string;
  expected_salary_hourly_usd?: string;
  notice_period_weeks?: string;
  work_authorization?: string;
  require_sponsorship?: string;
  willing_to_relocate?: string;
  remote_preferred?: string;
  custom_notes?: string;
}

export interface AISettings {
  gemini_api_key?: string;
  gemini_model?: string;
  enable_ghost_cursor?: boolean;
  application_mode?: 'review_before_submit' | 'full_auto';
  max_applications_per_day?: number;
  min_match_score?: number;
  resume_auto_upload?: boolean;
  enabled_platforms?: string[];
  show_reasoning_stream?: boolean;
}

export interface CandidateProfile {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  summary?: string;
  skills: string[];
  years_of_experience: number;
  current_title: string;
  screening_defaults: ScreeningDefaults;
  ai_settings: AISettings;
  resume_filename?: string;
  resume_uploaded_at?: string;
}

export interface ApplicationLog {
  id: number;
  job_id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  status: string;
  mode: string;
  applied_at: string;
  notes?: string;
}

export interface ReasoningStep {
  step: number;
  action: string;
  reasoning: string;
  fields?: Array<{ selector?: string; label?: string; value?: string; action_type?: string }>;
  timestamp: string;
}

export interface AISessionLogItem {
  title: string;
  company: string;
  source: string;
  match_score: number;
  status: string;
  timestamp: string;
  reasoning_steps?: ReasoningStep[];
}

export interface AISessionStatus {
  active: boolean;
  paused: boolean;
  mode: string;
  current_job?: Job | null;
  current_steps?: ReasoningStep[];
  session_id: string;
  started_at: string;
  daily_max: number;
  applied_today: number;
  log: AISessionLogItem[];
}

export interface DaemonSettings {
  keywords: string[];
  location: string;
  check_interval_minutes: number;
  recipient: string;
  paused?: boolean;
}

export interface SystemStatus {
  status: string;
  last_scan_time: string;
  stats: {
    total_jobs: number;
    today_new_jobs?: number;
    total_alerted?: number;
    total_applied?: number;
    sources?: Record<string, number>;
  };
  paused: boolean;
  interval: number;
  location: string;
  keywords: string[];
  recipient?: string;
}
