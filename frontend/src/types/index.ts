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
  application_status?: string;
  applied_status?: string;
  applied_at?: string;
  application_mode?: string;
  application_screenshot?: string;
}

export interface UserProfile {
  personal?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    location?: string;
    headline?: string;
    linkedin_url?: string;
    github_url?: string;
    portfolio_url?: string;
  };
  work_preferences?: {
    years_of_experience?: number;
    current_title?: string;
    expected_salary_php?: number | string;
    notice_period_weeks?: number;
    work_authorization?: string;
    remote_preference?: string;
    willing_to_relocate?: boolean;
    skills?: string[];
  };
  screening_answers?: {
    why_hire_me?: string;
    notice_period?: string;
    salary_expectation?: string;
    relocation?: string;
    work_authorization?: string;
    shift_preference?: string;
    portfolio_url?: string;
    [key: string]: string | undefined;
  };
  resume?: {
    filename?: string;
    path?: string;
    uploaded_at?: string;
    file_size_bytes?: number;
  };
  auto_apply?: {
    enabled?: boolean;
    daily_cap?: number;
    match_threshold?: number;
    blacklisted_companies?: string[];
    blacklisted_keywords?: string[];
  };
}

export interface PlatformSession {
  platform?: string;
  name?: string;
  login_url?: string;
  home_url?: string;
  connected: boolean;
  cookie_count?: number;
  updated_at?: string;
  is_helper_open?: boolean;
  session_file?: string;
}

export interface ApplicationRecord {
  id: number;
  job_id: string;
  status: string;
  mode: string;
  applied_at: string;
  notes: string;
  screenshot_path: string;
  error_message: string;
  title: string;
  company: string;
  url: string;
  source: string;
  location?: string;
}

export interface DaemonSettings {
  keywords: string[];
  location: string;
  check_interval_minutes: number;
  recipient: string;
  gemini_api_key?: string;
  preferred_browser?: string;
  paused?: boolean;
}

export interface SystemStatus {
  status: string;
  last_scan_time: string;
  stats: {
    total_jobs: number;
    total_applied: number;
    total_failed: number;
    today_applied: number;
  };
  paused: boolean;
  interval: number;
  location: string;
  keywords: string[];
}
