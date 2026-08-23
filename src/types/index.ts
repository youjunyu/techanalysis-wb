// Core type definitions for TechAnalysis Pro

export type Market = "A" | "HK" | "US";

export type Sentiment = "positive" | "negative" | "neutral";

export type Rating = "buy" | "hold" | "watch" | "avoid";

export type EnrichStatus = "idle" | "pending" | "running" | "done" | "error";

export type JobStatus = "success" | "partial" | "failed" | "running";

export type NewsSourceType = "rss" | "web" | "api";

export type NewsSourceRegion = "cn" | "us" | "hk" | "global";

export type UserRole = "admin" | "user";

export interface Stock {
  id: string;
  symbol: string;
  market: Market;
  name: string;
  name_en?: string;
  industry_tags: string[];
  last_price?: number;
  last_price_change?: number;
  last_price_change_percent?: number;
  updated_at?: string;
  created_at: string;
}

export interface QuoteSnapshot {
  stock_id: string;
  symbol: string;
  market: Market;
  price: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  change: number;
  change_percent: number;
  pe_ratio?: number;
  pb_ratio?: number;
  total_market_cap?: number;
  high_52week?: number;
  low_52week?: number;
  currency: string;
  source: string;
  fetched_at: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  content?: string;
  summary?: string;
  sentiment?: Sentiment;
  tags: string[];
  source_name: string;
  source_url?: string;
  published_at: string;
  created_at: string;
  stock_symbols?: string[];
}

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  type: NewsSourceType;
  region: NewsSourceRegion;
  is_active: boolean;
  fail_count: number;
  user_id?: string | null;
  created_at: string;
}

export interface IndustryChain {
  id: string;
  name: string;
  description?: string;
  nodes: ChainNode[];
  edges: ChainEdge[];
  description_text?: string;
  is_private: boolean;
  enrich_status: EnrichStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChainNode {
  id: string;
  label: string;
  type?: string;
  tags?: string[];
  position?: { x: number; y: number };
}

export interface ChainEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  content: Record<string, unknown>;
  email_sent_at?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  subscription_tags: string[];
  daily_report_email?: string;
  report_time?: string;
  avatar_url?: string;
  created_at: string;
}

export interface JobRun {
  id: string;
  job_name: string;
  status: JobStatus;
  duration_ms: number;
  details: Record<string, unknown>;
  started_at: string;
  finished_at: string;
}

export interface SystemLog {
  id: string;
  category: "crawler" | "email" | "report" | "error" | "system";
  level: "info" | "warn" | "error";
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface TaskRegistry {
  job_name: string;
  owner: "cf-worker" | "workbuddy-automation";
  expected_interval_minutes: number;
  alert_threshold_multiplier: number;
  is_enabled: boolean;
}

export interface MacroEvent {
  id: string;
  title: string;
  source: string;
  source_url: string;
  event_hash: string;
  impact: "high" | "medium" | "low";
  horizon: "short" | "medium" | "long";
  related_markets: string[];
  published_at: string;
  created_at: string;
}
