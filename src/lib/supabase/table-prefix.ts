/**
 * Multi-tenant table prefix proxy.
 * Wraps a Supabase client so that all .from(tableName) calls
 * automatically prepend the configured table prefix.
 * This allows one Supabase project to serve multiple apps.
 */

const TABLE_PREFIX = process.env.TABLE_PREFIX || "techanalysis_wb_";

// Tables that should be prefixed
const PREFIXED_TABLES = new Set([
  "profiles",
  "news_sources",
  "news_articles",
  "industry_chains",
  "chain_stocks",
  "stocks",
  "stock_analyses",
  "quote_snapshots",
  "market_snapshots",
  "stock_financials",
  "hot_snapshots",
  "sector_snapshots",
  "user_watchlist",
  "user_chain_subscriptions",
  "daily_reports",
  "news_cron_settings",
  "report_cron_settings",
  "system_logs",
  "job_runs",
  "task_registry",
  "research_documents",
  "macro_events",
]);

export function prefixTable(name: string): string {
  if (PREFIXED_TABLES.has(name)) {
    return `${TABLE_PREFIX}${name}`;
  }
  return name;
}

export { TABLE_PREFIX };
