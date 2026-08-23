# TechAnalysis Pro (WorkBuddy Rebuild)

投资分析平台 — Next.js 15 + Supabase + Cloudflare Pages

## 技术栈

- **前端**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **后端**: Supabase (Auth + PostgreSQL + RLS)
- **部署**: Cloudflare Pages (Edge Runtime)
- **数据源**: 腾讯自选股 API (qt.gtimg.cn) + RSS 新闻聚合
- **CI/CD**: GitHub Actions
- **定时任务**: GitHub Actions Cron + Cloudflare Worker

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── cron/          # 定时任务端点 (sync-quotes, fetch-news, watchdog, daily-report, generate-summaries)
│   │   ├── stocks/        # 股票数据 API
│   │   ├── news/          # 新闻数据 API
│   │   ├── watchlist/     # 自选股 API
│   │   ├── dashboard/     # 仪表盘聚合 API
│   │   └── health/        # 健康检查端点
│   ├── dashboard/         # 仪表盘页面 (市场概览/自选股/资讯/标的/设置)
│   ├── login/             # 登录页
│   ├── register/          # 注册页
│   ├── forgot-password/   # 忘记密码
│   └── auth-confirm/      # 邮箱验证回调
├── components/
│   ├── layout/            # 布局组件 (Sidebar)
│   └── ui/                # 基础 UI 组件 (Button, Card, Badge, Input)
├── lib/
│   ├── supabase/          # Supabase 客户端 (client/server/middleware + table prefix)
│   ├── scrapers/          # RSS 新闻采集器
│   ├── quotes.ts          # 行情数据采集 (腾讯 qt.gtimg.cn)
│   ├── sentiment.ts       # 情感分析 + 标签提取
│   ├── cron.ts            # 定时任务工具 (job tracking + watchdog)
│   └── news-sources.ts    # 新闻源配置 (18 源: CN/US/global)
└── types/
    └── index.ts           # TypeScript 类型定义

supabase/
└── schema.sql             # 数据库 Schema (17 表 + RLS + RPC)

workers/
└── quote-sync.ts          # Cloudflare Worker (高频行情同步)

.github/workflows/
├── deploy.yml             # 部署工作流 (build + deploy to CF Pages)
└── cron.yml               # 定时任务工作流
```

## 数据库表结构

| 表名 | 用途 |
|------|------|
| `profiles` | 用户资料 (关联 auth.users) |
| `stocks` | 股票标的 (110 只科技股: A/HK/US) |
| `stock_quotes` | 实时/历史行情 |
| `watchlist` | 用户自选股 |
| `news_articles` | 新闻文章 |
| `news_sources` | 新闻源配置 |
| `ai_summaries` | AI 生成摘要 |
| `daily_reports` | 日报 |
| `industry_chains` | 产业链图谱 |
| `chain_nodes` | 产业链节点 |
| `macro_events` | 宏观事件 |
| `alerts` | 用户提醒 |
| `job_runs` | 定时任务执行记录 |
| `task_registry` | 任务注册表 (预期间隔/状态) |
| `system_settings` | 系统设置 |

## 环境变量

| 变量 | 用途 | 必需 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公钥 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 (后端) | ✅ |
| `NEXT_PUBLIC_APP_URL` | 网站 URL | ✅ |
| `TABLE_PREFIX` | 表前缀 (多租户) | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | CF 账号 ID | ✅ |
| `CLOUDFLARE_API_TOKEN` | CF API Token (需 Pages:Edit) | ✅ |
| `CRON_SECRET` | 定时任务认证密钥 | ✅ |

## 本地开发

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local 填入实际值
npm run dev
```

## 部署

GitHub push to `main` 自动触发部署。构建流程:
1. `npm ci` — 安装依赖
2. `npx tsc --noEmit` — 类型检查
3. `npx @cloudflare/next-on-pages` — 构建 + 转换为 CF Pages 格式
4. `wrangler pages deploy` — 部署到 Cloudflare Pages
5. 设置 CF Pages 环境变量 (secrets)

## 数据源

### 行情数据
- **主源**: 腾讯自选股公开接口 `qt.gtimg.cn` (A/HK/US 三市场)
- **备份**: Cloudflare Worker 定时同步到 Supabase
- **WorkBuddy 通道**: westock MCP 定时调 `data_quote` 写库 (低频高价值)

### 新闻数据 (18 源)
- **国内科技**: 36氪、机器之心、量子位、芯东西、极客公园
- **国内财经**: 新浪财经、东方财富、财联社
- **国外科技**: Hacker News、TechCrunch、The Verge、Ars Technica
- **国外财经**: SEC EDGAR、Reuters、Bloomberg
- **聚合**: RSSHub (自部署)

## 定时任务

| 任务 | 频率 | 调度器 |
|------|------|--------|
| sync-quotes | 每 5 分钟 | GitHub Actions Cron |
| fetch-news | 每 10 分钟 | GitHub Actions Cron |
| generate-summaries | 每 10 分钟 (偏移 3 分钟) | GitHub Actions Cron |
| watchdog | 每 15 分钟 | GitHub Actions Cron |
| daily-report | 每天 00:00 UTC+8 | GitHub Actions Cron |

### 健康监控
- `task_registry` 表登记每个任务的预期间隔
- `watchdog` 每 15 分钟巡检: 任务超 2 倍间隔未成功 → 告警
- `job_runs` 表记录每次执行的耗时、状态、详情
- 断路器: 连续失败 3 次的源自动暂停
