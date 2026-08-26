-- ============================================================
-- TechAnalysis Pro - Complete Database Schema
-- Prefix: techanalysis_wb_
-- Execute in Supabase SQL Editor (single transaction)
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  subscription_tags text[] NOT NULL DEFAULT '{}',
  daily_report_email text,
  report_time text NOT NULL DEFAULT '08:00',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE techanalysis_wb_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON techanalysis_wb_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON techanalysis_wb_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON techanalysis_wb_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin can read all profiles
CREATE POLICY "profiles_admin_all" ON techanalysis_wb_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM techanalysis_wb_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Trigger: auto-create profile on signup
-- NOTE: SECURITY DEFINER + explicit search_path + schema-qualified table are
-- REQUIRED on Supabase: the auth service fires this trigger with a session
-- search_path that does not include `public`, so an unqualified table name
-- makes user creation fail with "Database error creating new user".
CREATE OR REPLACE FUNCTION techanalysis_wb_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.techanalysis_wb_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS techanalysis_wb_on_auth_user_created ON auth.users;
CREATE TRIGGER techanalysis_wb_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION techanalysis_wb_handle_new_user();

-- ============================================================
-- 2. STOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  market text NOT NULL CHECK (market IN ('A', 'HK', 'US')),
  name text NOT NULL,
  name_en text,
  industry_tags text[] NOT NULL DEFAULT '{}',
  last_price numeric,
  last_price_change numeric,
  last_price_change_percent numeric,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(symbol, market)
);

CREATE INDEX IF NOT EXISTS idx_stocks_market ON techanalysis_wb_stocks(market);
CREATE INDEX IF NOT EXISTS idx_stocks_tags ON techanalysis_wb_stocks USING GIN(industry_tags);

ALTER TABLE techanalysis_wb_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stocks_read_all" ON techanalysis_wb_stocks FOR SELECT USING (true);

-- ============================================================
-- 3. QUOTE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_quote_snapshots (
  stock_id uuid PRIMARY KEY REFERENCES techanalysis_wb_stocks(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  market text NOT NULL,
  price numeric NOT NULL,
  prev_close numeric,
  open numeric,
  high numeric,
  low numeric,
  volume bigint,
  amount numeric,
  change numeric,
  change_percent numeric,
  pe_ratio numeric,
  pb_ratio numeric,
  total_market_cap numeric,
  high_52week numeric,
  low_52week numeric,
  currency text NOT NULL DEFAULT 'CNY',
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_fetched ON techanalysis_wb_quote_snapshots(fetched_at DESC);

ALTER TABLE techanalysis_wb_quote_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_read_all" ON techanalysis_wb_quote_snapshots FOR SELECT USING (true);

-- ============================================================
-- 4. NEWS SOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('rss', 'web', 'api')),
  region text NOT NULL CHECK (region IN ('cn', 'us', 'hk', 'global')),
  is_active boolean NOT NULL DEFAULT true,
  fail_count integer NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sources_active ON techanalysis_wb_news_sources(is_active) WHERE is_active = true;

ALTER TABLE techanalysis_wb_news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources_read_public" ON techanalysis_wb_news_sources
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "sources_insert_own" ON techanalysis_wb_news_sources
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sources_update_own" ON techanalysis_wb_news_sources
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "sources_delete_own" ON techanalysis_wb_news_sources
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 5. NEWS ARTICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  content text,
  summary text,
  sentiment text CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  tags text[] NOT NULL DEFAULT '{}',
  source_name text NOT NULL,
  source_url text,
  published_at timestamptz NOT NULL,
  stock_symbols text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON techanalysis_wb_news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_tags ON techanalysis_wb_news_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON techanalysis_wb_news_articles(sentiment);

ALTER TABLE techanalysis_wb_news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_read_all" ON techanalysis_wb_news_articles FOR SELECT USING (true);

-- ============================================================
-- 6. INDUSTRY CHAINS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_industry_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  nodes jsonb NOT NULL DEFAULT '[]',
  edges jsonb NOT NULL DEFAULT '[]',
  description_text text,
  is_private boolean NOT NULL DEFAULT false,
  enrich_status text NOT NULL DEFAULT 'idle' CHECK (enrich_status IN ('idle', 'pending', 'running', 'done', 'error')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chains_user ON techanalysis_wb_industry_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_chains_enrich ON techanalysis_wb_industry_chains(enrich_status);

ALTER TABLE techanalysis_wb_industry_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chains_select_own_public" ON techanalysis_wb_industry_chains
  FOR SELECT USING (user_id = auth.uid() OR NOT is_private);
CREATE POLICY "chains_insert_own" ON techanalysis_wb_industry_chains
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "chains_update_own" ON techanalysis_wb_industry_chains
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "chains_delete_own" ON techanalysis_wb_industry_chains
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 7. CHAIN STOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_chain_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES techanalysis_wb_industry_chains(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES techanalysis_wb_stocks(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'tag', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chain_id, stock_id)
);

ALTER TABLE techanalysis_wb_chain_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chain_stocks_read" ON techanalysis_wb_chain_stocks
  FOR SELECT USING (true);

-- ============================================================
-- 8. STOCK ANALYSES
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_stock_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES techanalysis_wb_stocks(id) ON DELETE CASCADE,
  analysis_text text NOT NULL,
  rating text CHECK (rating IN ('buy', 'hold', 'watch', 'avoid')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyses_stock ON techanalysis_wb_stock_analyses(stock_id, created_at DESC);

ALTER TABLE techanalysis_wb_stock_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyses_read_all" ON techanalysis_wb_stock_analyses FOR SELECT USING (true);

-- ============================================================
-- 9. USER WATCHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_user_watchlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES techanalysis_wb_stocks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stock_id)
);

ALTER TABLE techanalysis_wb_user_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_own" ON techanalysis_wb_user_watchlist
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 10. USER CHAIN SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_user_chain_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES techanalysis_wb_industry_chains(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chain_id)
);

ALTER TABLE techanalysis_wb_user_chain_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chain_subs_own" ON techanalysis_wb_user_chain_subscriptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 11. DAILY REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_date)
);

ALTER TABLE techanalysis_wb_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_own" ON techanalysis_wb_daily_reports
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- 12. CRON SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_news_cron_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  keywords text[] NOT NULL DEFAULT '{}',
  cron_expression text NOT NULL DEFAULT '*/10 * * * *',
  max_articles_per_run integer NOT NULL DEFAULT 20,
  parallel_fetch_count integer NOT NULL DEFAULT 3,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE techanalysis_wb_news_cron_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_cron_own" ON techanalysis_wb_news_cron_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS techanalysis_wb_report_cron_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cron_expression text NOT NULL DEFAULT '0 0 * * *',
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE techanalysis_wb_report_cron_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_cron_own" ON techanalysis_wb_report_cron_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 13. SYSTEM LOGS & JOB RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('crawler', 'email', 'report', 'error', 'system')),
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON techanalysis_wb_system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_category ON techanalysis_wb_system_logs(category);

ALTER TABLE techanalysis_wb_system_logs ENABLE ROW LEVEL SECURITY;
-- Only admin can read logs
CREATE POLICY "logs_admin_read" ON techanalysis_wb_system_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM techanalysis_wb_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE TABLE IF NOT EXISTS techanalysis_wb_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'running')),
  duration_ms integer,
  details jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_jobs_name ON techanalysis_wb_job_runs(job_name, started_at DESC);

ALTER TABLE techanalysis_wb_job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_admin_read" ON techanalysis_wb_job_runs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM techanalysis_wb_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 14. TASK REGISTRY (NEW - watchdog support)
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_task_registry (
  job_name text PRIMARY KEY,
  owner text NOT NULL CHECK (owner IN ('cf-worker', 'workbuddy-automation')),
  expected_interval_minutes integer NOT NULL,
  alert_threshold_multiplier integer NOT NULL DEFAULT 2,
  is_enabled boolean NOT NULL DEFAULT true
);

ALTER TABLE techanalysis_wb_task_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_registry_admin" ON techanalysis_wb_task_registry
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM techanalysis_wb_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 15. MARKET SNAPSHOTS (NEW)
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  snapshot_type text NOT NULL DEFAULT 'summary',
  row jsonb NOT NULL DEFAULT '{}',
  schema_def jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_date ON techanalysis_wb_market_snapshots(snapshot_date DESC);

ALTER TABLE techanalysis_wb_market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_read_all" ON techanalysis_wb_market_snapshots FOR SELECT USING (true);

-- ============================================================
-- 16. STOCK FINANCIALS (NEW)
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_stock_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES techanalysis_wb_stocks(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('income', 'balance', 'cashflow', 'profile')),
  period text,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stock_id, report_type, period)
);

ALTER TABLE techanalysis_wb_stock_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financials_read_all" ON techanalysis_wb_stock_financials FOR SELECT USING (true);

-- ============================================================
-- 17. HOT SNAPSHOTS (NEW)
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_hot_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  data jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hot_created ON techanalysis_wb_hot_snapshots(created_at DESC);

ALTER TABLE techanalysis_wb_hot_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hot_read_all" ON techanalysis_wb_hot_snapshots FOR SELECT USING (true);

-- ============================================================
-- 18. SECTOR SNAPSHOTS (NEW)
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_sector_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  data jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE techanalysis_wb_sector_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sector_read_all" ON techanalysis_wb_sector_snapshots FOR SELECT USING (true);

-- ============================================================
-- 19. RESEARCH DOCUMENTS (Knowledge Base)
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_research_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  document_kind text NOT NULL CHECK (document_kind IN ('report', 'article', 'paper', 'filing', 'doc', 'pdf', 'url', 'note')),
  source_type text NOT NULL CHECK (source_type IN ('url', 'upload')),
  source_url text,
  storage_path text,
  content_text text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  chain_id uuid REFERENCES techanalysis_wb_industry_chains(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE techanalysis_wb_research_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select" ON techanalysis_wb_research_documents
  FOR SELECT USING (user_id = auth.uid() OR visibility = 'public');
CREATE POLICY "docs_insert_own" ON techanalysis_wb_research_documents
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "docs_update_own" ON techanalysis_wb_research_documents
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "docs_delete_own" ON techanalysis_wb_research_documents
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 20. MACRO EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS techanalysis_wb_macro_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL,
  source_url text NOT NULL,
  event_hash text NOT NULL UNIQUE,
  impact text CHECK (impact IN ('high', 'medium', 'low')),
  horizon text CHECK (horizon IN ('short', 'medium', 'long')),
  related_markets text[] NOT NULL DEFAULT '{}',
  published_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macro_published ON techanalysis_wb_macro_events(published_at DESC);

ALTER TABLE techanalysis_wb_macro_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "macro_read_all" ON techanalysis_wb_macro_events FOR SELECT USING (true);

-- ============================================================
-- SEED DATA: STOCKS (110 tech stocks: A + HK + US)
-- ============================================================
INSERT INTO techanalysis_wb_stocks (symbol, market, name, industry_tags) VALUES
-- A股 - AI算力
('sh002230', 'A', '科大讯飞', ARRAY['AI算力','语音AI']),
('sh688111', 'A', '金山办公', ARRAY['AI应用','办公']),
('sh688787', 'A', '海天瑞声', ARRAY['AI算力','数据']),
('sz000977', 'A', '中科曙光', ARRAY['AI算力','服务器']),
('sh603019', 'A', '中科软', ARRAY['AI应用','软件']),
('sz002415', 'A', '海康威视', ARRAY['AI应用','安防']),
('sh688567', 'A', '孚能科技', ARRAY['新能源','电池']),
-- A股 - 半导体
('sh688981', 'A', '中芯国际', ARRAY['半导体','代工']),
('sz002049', 'A', '紫光国微', ARRAY['半导体','芯片设计']),
('sh688012', 'A', '中微公司', ARRAY['半导体','设备']),
('sh603501', 'A', '韦尔股份', ARRAY['半导体','设计']),
('sh688005', 'A', '容百科技', ARRAY['半导体','材料']),
('sz300142', 'A', '沃森生物', ARRAY['半导体','材料']),
('sh688082', 'A', '盛美上海', ARRAY['半导体','设备']),
('sz300661', 'A', '圣邦股份', ARRAY['半导体','设计']),
('sh688107', 'A', '安路科技', ARRAY['半导体','FPGA']),
('sh603986', 'A', '兆易创新', ARRAY['半导体','存储']),
('sh688396', 'A', '华润微', ARRAY['半导体','IDM']),
('sz300223', 'A', '北京君正', ARRAY['半导体','存储']),
-- A股 - 机器人
('sz300024', 'A', '机器人', ARRAY['机器人','工业']),
('sh688169', 'A', '石头科技', ARRAY['机器人','服务']),
('sz002747', 'A', '埃斯顿', ARRAY['机器人','工业']),
('sh603585', 'A', '苏美达', ARRAY['机器人','零部件']),
-- A股 - 新能源
('sz300750', 'A', '宁德时代', ARRAY['新能源','电池']),
('sh601012', 'A', '隆基绿能', ARRAY['新能源','光伏']),
('sz002594', 'A', '比亚迪', ARRAY['新能源','汽车']),
('sh600089', 'A', '特变电工', ARRAY['新能源','特高压']),
('sz300274', 'A', '阳光电源', ARRAY['新能源','逆变']),
('sh601877', 'A', '正泰电器', ARRAY['新能源','光伏']),
('sz002129', 'A', 'TCL中环', ARRAY['新能源','光伏']),
-- 港股
('hk00700', 'HK', '腾讯控股', ARRAY['互联网','AI']),
('hk09988', 'HK', '阿里巴巴', ARRAY['互联网','电商']),
('hk03690', 'HK', '美团', ARRAY['互联网','本地生活']),
('hk01024', 'HK', '快手', ARRAY['互联网','短视频']),
('hk09888', 'HK', '百度集团', ARRAY['互联网','AI']),
('hk09618', 'HK', '京东集团', ARRAY['互联网','电商']),
('hk03888', 'HK', '中芯国际', ARRAY['半导体','代工']),
('hk01810', 'HK', '小米集团', ARRAY['消费电子','手机']),
('hk00981', 'HK', 'SMIC', ARRAY['半导体','代工']),
('hk02382', 'HK', '舜宇光学', ARRAY['消费电子','光学']),
('hk00992', 'HK', '联想集团', ARRAY['消费电子','PC']),
('hk02013', 'HK', '微盟集团', ARRAY['互联网','SaaS']),
-- 美股 - AI算力
('usNVDA', 'US', '英伟达', ARRAY['AI算力','GPU']),
('usAMD', 'US', 'AMD', ARRAY['半导体','GPU']),
('usMSFT', 'US', '微软', ARRAY['AI应用','云']),
('usGOOGL', 'US', '谷歌', ARRAY['AI应用','搜索']),
('usMETA', 'US', 'Meta', ARRAY['AI应用','社交']),
('usAMZN', 'US', '亚马逊', ARRAY['AI应用','云']),
('usTSLA', 'US', '特斯拉', ARRAY['新能源','汽车']),
('usCRM', 'US', 'Salesforce', ARRAY['AI应用','SaaS']),
('usPLTR', 'US', 'Palantir', ARRAY['AI应用','数据']),
('usNOW', 'US', 'ServiceNow', ARRAY['AI应用','SaaS']),
('usSNOW', 'US', 'Snowflake', ARRAY['AI应用','数据']),
('usDDOG', 'US', 'Datadog', ARRAY['AI应用','监控']),
('usMNDY', 'US', 'monday.com', ARRAY['AI应用','SaaS']),
('usAI', 'US', 'C3.ai', ARRAY['AI应用','企业AI']),
('usSOUN', 'US', 'SoundHound', ARRAY['AI应用','语音']),
-- 美股 - 半导体
('usTSM', 'US', '台积电', ARRAY['半导体','代工']),
('usINTC', 'US', '英特尔', ARRAY['半导体','CPU']),
('usASML', 'US', 'ASML', ARRAY['半导体','设备']),
('usAMAT', 'US', '应用材料', ARRAY['半导体','设备']),
('usLRCX', 'US', '泛林半导体', ARRAY['半导体','设备']),
('usKLAC', 'US', '科磊', ARRAY['半导体','设备']),
('usMU', 'US', '美光科技', ARRAY['半导体','存储']),
('usQCOM', 'US', '高通', ARRAY['半导体','通信']),
('usAVGO', 'US', '博通', ARRAY['半导体','通信']),
('usTXN', 'US', '德州仪器', ARRAY['半导体','模拟']),
('usNXPI', 'US', '恩智浦', ARRAY['半导体','汽车']),
('usMRVL', 'US', 'Marvell', ARRAY['半导体','数据']),
('usON', 'US', '安森美', ARRAY['半导体','电源']),
('usADI', 'US', '亚德诺', ARRAY['半导体','模拟']),
('usSWKS', 'US', 'Skyworks', ARRAY['半导体','射频']),
('usCRUS', 'US', 'Cirrus Logic', ARRAY['半导体','音频']),
('usMP', 'US', 'MP Materials', ARRAY['半导体','材料']),
('usARM', 'US', 'ARM Holdings', ARRAY['半导体','IP']),
('usGFS', 'US', 'GlobalFoundries', ARRAY['半导体','代工']),
-- 美股 - 机器人/自动化
('usUBTECH', 'US', '优必选', ARRAY['机器人','人形']),
('usROBO', 'US', 'ROBO ETF', ARRAY['机器人','ETF']),
-- 美股 - 新能源
('usENPH', 'US', 'Enphase', ARRAY['新能源','逆变']),
('usFSLR', 'US', 'First Solar', ARRAY['新能源','光伏']),
('usSEDG', 'US', 'SolarEdge', ARRAY['新能源','逆变']),
('usRUN', 'US', 'Sunrun', ARRAY['新能源','光伏']),
('usBE', 'US', 'Bloom Energy', ARRAY['新能源','燃料电池']),
('usPLUG', 'US', 'Plug Power', ARRAY['新能源','氢能']),
('usCHPT', 'US', 'ChargePoint', ARRAY['新能源','充电']),
('usBLNK', 'US', 'Blink Charging', ARRAY['新能源','充电'])
ON CONFLICT (symbol, market) DO NOTHING;

-- ============================================================
-- SEED DATA: NEWS SOURCES (stable sources only)
-- ============================================================
INSERT INTO techanalysis_wb_news_sources (name, url, type, region) VALUES
-- 国内科技
('36氪', 'https://36kr.com/feed', 'rss', 'cn'),
('机器之心', 'https://www.jiqizhixin.com/rss', 'rss', 'cn'),
('量子位', 'https://www.qbitai.com/feed', 'rss', 'cn'),
('InfoQ', 'https://www.infoq.cn/feed', 'rss', 'cn'),
('爱范儿', 'https://www.ifanr.com/feed', 'rss', 'cn'),
('少数派', 'https://sspai.com/feed', 'rss', 'cn'),
('钛媒体', 'https://www.tmtpost.com/feed', 'rss', 'cn'),
('雷科技', 'https://www.leikeji.com/feed', 'rss', 'cn'),
-- 国外科技
('TechCrunch', 'https://techcrunch.com/feed/', 'rss', 'us'),
('The Verge', 'https://www.theverge.com/rss/index.xml', 'rss', 'us'),
('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'rss', 'us'),
('VentureBeat', 'https://venturebeat.com/feed/', 'rss', 'us'),
('MIT Tech Review', 'https://www.technologyreview.com/feed/', 'rss', 'us'),
('Wired', 'https://www.wired.com/feed/rss', 'rss', 'us'),
-- 财经
('Yahoo Finance', 'https://finance.yahoo.com/news/rssindex', 'rss', 'global'),
('CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'rss', 'global'),
('MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories', 'rss', 'global'),
-- 宏观/机构
('美联储', 'https://www.federalreserve.gov/feeds/press_all.xml', 'rss', 'global'),
('中国人民银行', 'http://www.pbc.gov.cn/rss/zhengcefabu.xml', 'rss', 'global')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA: TASK REGISTRY
-- ============================================================
INSERT INTO techanalysis_wb_task_registry (job_name, owner, expected_interval_minutes, alert_threshold_multiplier) VALUES
('sync-quotes', 'cf-worker', 5, 2),
('fetch-news', 'cf-worker', 10, 2),
('generate-summaries', 'cf-worker', 10, 3),
('daily-report', 'cf-worker', 1440, 2),
('enrich-chains', 'cf-worker', 720, 2),
('watchdog', 'cf-worker', 15, 2),
('westock-news-sync', 'workbuddy-automation', 60, 2),
('westock-market-overview', 'workbuddy-automation', 720, 2),
('westock-financials', 'workbuddy-automation', 1440, 3),
('westock-hot', 'workbuddy-automation', 720, 2)
ON CONFLICT (job_name) DO NOTHING;

-- ============================================================
-- DONE - Schema v1.0
-- ============================================================
