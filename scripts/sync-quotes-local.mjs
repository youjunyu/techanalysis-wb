#!/usr/bin/env node
/**
 * Local quote sync: fetch quotes from qt.gtimg.cn and upsert into Supabase.
 *
 * Why this exists: the CF Pages cron route fetches qt.gtimg.cn from an
 * overseas edge runtime, where the Tencent CDN can hang or stall. This
 * script runs from a China-reachable network (local machine / WorkBuddy
 * sandbox) and acts as the stable backstop channel (task: westock-quotes).
 *
 * Usage: node scripts/sync-quotes-local.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- load .env.local ---
const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  if (line.trim().startsWith("#")) continue;
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`REST ${path} -> HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp;
}

/** Parse one qt.gtimg.cn quote line (same field layout as src/lib/quotes.ts). */
function parseQuote(raw, symbol) {
  const parts = raw.split("~");
  if (parts.length < 38) return null;
  const price = parseFloat(parts[3]) || 0;
  const prevClose = parseFloat(parts[4]) || 0;
  const open = parseFloat(parts[5]) || 0;
  const high = parseFloat(parts[33]) || price;
  const low = parseFloat(parts[34]) || price;
  const volume = parseInt(parts[36]) || 0;
  const amount = parseFloat(parts[37]) || 0;
  if (price <= 0) return null;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const currency = symbol.startsWith("us") ? "USD" : symbol.startsWith("hk") ? "HKD" : "CNY";
  return {
    price, prev_close: prevClose, open, high, low, volume, amount,
    change, change_percent: changePercent, currency,
  };
}

async function main() {
  // If an outbound proxy is required (sandbox/CI) but Node's fetch is not
  // proxy-enabled yet, re-exec ourselves with NODE_USE_ENV_PROXY=1.
  if (!process.env.NODE_USE_ENV_PROXY && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.argv[0], [fileURLToPath(import.meta.url)], {
      env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  const started = Date.now();

  // 1. Load all stocks (full rows: partial upsert violates NOT NULL on
  // symbol/market/name, so we must carry identity columns through)
  const resp = await rest("/rest/v1/techanalysis_wb_stocks?select=*&limit=1000");
  const stocks = await resp.json();
  if (!Array.isArray(stocks) || stocks.length === 0) {
    throw new Error("No stocks found in techanalysis_wb_stocks");
  }
  console.log(`[1/4] stocks loaded: ${stocks.length}`);

  // 2. Fetch quotes in parallel batches (40 per request, 15s hard timeout)
  const BATCH = 40;
  const batches = [];
  for (let i = 0; i < stocks.length; i += BATCH) batches.push(stocks.slice(i, i + BATCH));
  const quoteMap = new Map();

  await Promise.all(
    batches.map(async (batch) => {
      const codes = batch.map((s) => s.symbol).join(",");
      try {
        const r = await fetch(`https://qt.gtimg.cn/q=${codes}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) {
          console.error(`[quotes] batch HTTP ${r.status}`);
          return;
        }
        const text = await r.text();
        for (const line of text.split(";")) {
          const m = line.match(/v_(\w+)=["'](.*)["']/);
          if (!m) continue;
          const q = parseQuote(m[2], m[1]);
          if (q) quoteMap.set(m[1], q);
        }
      } catch (e) {
        console.error(`[quotes] batch error: ${e.message}`);
      }
    })
  );
  console.log(`[2/4] quotes fetched: ${quoteMap.size}/${stocks.length}`);

  // 3. Upsert quote_snapshots + stocks (one bulk request each)
  const nowIso = new Date().toISOString();
  const snapshots = [];
  const stockUpdates = [];
  for (const s of stocks) {
    const q = quoteMap.get(s.symbol);
    if (!q) continue;
    snapshots.push({
      stock_id: s.id, symbol: s.symbol, market: s.market,
      price: q.price, prev_close: q.prev_close, open: q.open,
      high: q.high, low: q.low, volume: q.volume, amount: q.amount,
      change: q.change, change_percent: q.change_percent,
      currency: q.currency, source: "qt.gtimg.cn(local)", fetched_at: nowIso,
    });
    stockUpdates.push({
      ...s,
      last_price: q.price, last_price_change: q.change,
      last_price_change_percent: q.change_percent, updated_at: nowIso,
    });
  }

  if (snapshots.length > 0) {
    await rest("/rest/v1/techanalysis_wb_quote_snapshots?on_conflict=stock_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(snapshots),
    });
    await rest("/rest/v1/techanalysis_wb_stocks?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(stockUpdates),
    });
  }
  console.log(`[3/4] upserted snapshots: ${snapshots.length}`);

  // 4. Register task + record job run (watchdog observability)
  await rest("/rest/v1/techanalysis_wb_task_registry?on_conflict=job_name", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify([{
      job_name: "westock-quotes",
      owner: "workbuddy-automation",
      expected_interval_minutes: 60,
      alert_threshold_multiplier: 2,
    }]),
  }).catch((e) => console.error(`[registry] ${e.message}`));

  const durationMs = Date.now() - started;
  await rest("/rest/v1/techanalysis_wb_job_runs", {
    method: "POST",
    body: JSON.stringify({
      job_name: "westock-quotes",
      status: snapshots.length > 0 ? "success" : "failed",
      duration_ms: durationMs,
      details: {
        fetched: quoteMap.size, total: stocks.length,
        upserted: snapshots.length, runner: "local-script",
      },
      started_at: new Date(Date.now() - durationMs).toISOString(),
      finished_at: nowIso,
    }),
  }).catch((e) => console.error(`[job_runs] ${e.message}`));

  console.log(`[4/4] done in ${durationMs}ms`);
  console.log(JSON.stringify({
    ok: snapshots.length > 0,
    fetched: quoteMap.size,
    upserted: snapshots.length,
    duration_ms: durationMs,
  }));
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
