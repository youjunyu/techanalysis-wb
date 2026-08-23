/**
 * Cloudflare Worker: High-frequency quote sync.
 * Runs via Cloudflare Cron Triggers every 5 minutes.
 * Fetches quotes from qt.gtimg.cn and writes directly to Supabase.
 *
 * This worker does NOT depend on WorkBuddy or local machine —
 * it runs 24/7 on Cloudflare's edge network.
 */

import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TABLE_PREFIX: string;
}

interface StockRow {
  id: string;
  symbol: string;
  market: string;
}

interface RawQuote {
  price: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  change: number;
  change_percent: number;
}

function parseTencentQuote(raw: string): RawQuote | null {
  const parts = raw.split("~");
  if (parts.length < 40) return null;

  const price = parseFloat(parts[3]) || 0;
  const prev_close = parseFloat(parts[4]) || 0;
  const open = parseFloat(parts[5]) || 0;
  const high = parseFloat(parts[33]) || price;
  const low = parseFloat(parts[34]) || price;
  const volume = parseInt(parts[36]) || 0;
  const amount = parseFloat(parts[37]) || 0;
  const change = price - prev_close;
  const change_percent = prev_close > 0 ? (change / prev_close) * 100 : 0;

  return { price, prev_close, open, high, low, volume, amount, change, change_percent };
}

async function fetchQuotesBatch(symbols: string[]): Promise<Map<string, RawQuote>> {
  const results = new Map<string, RawQuote>();
  const batchSize = 40;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const codes = batch.join(",");

    try {
      const resp = await fetch(`https://qt.gtimg.cn/q=${codes}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!resp.ok) continue;

      const text = await resp.text();
      const lines = text.split(";").filter((l) => l.trim().length > 0);

      for (const line of lines) {
        const match = line.match(/v_(\w+)=["'](.*)["']/);
        if (!match) continue;

        const code = match[1];
        const parsed = parseTencentQuote(match[2]);
        if (parsed && parsed.price > 0) {
          results.set(code, parsed);
        }
      }
    } catch (err) {
      console.error(`[worker] Batch fetch error:`, err);
    }
  }

  return results;
}

async function recordJobRun(supabase: ReturnType<typeof createClient>, prefix: string, jobName: string, status: string, durationMs: number, details: Record<string, unknown>) {
  try {
    await supabase.from(`${prefix}job_runs`).insert({
      job_name: jobName,
      status,
      duration_ms: durationMs,
      details,
      started_at: new Date(Date.now() - durationMs).toISOString(),
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[worker] Failed to record job run:`, err);
  }
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const start = Date.now();
    const prefix = env.TABLE_PREFIX || "techanalysis_wb_";

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      // Get all stocks
      const { data: stocks, error } = await supabase
        .from(`${prefix}stocks`)
        .select("id, symbol, market")
        .order("symbol");

      if (error || !stocks) {
        await recordJobRun(supabase, prefix, "sync-quotes", "failed", Date.now() - start, { error: error?.message });
        return;
      }

      const symbols = stocks.map((s: StockRow) => s.symbol);
      const quotesMap = await fetchQuotesBatch(symbols);

      // Build upsert data
      const upsertData: Record<string, unknown>[] = [];
      const stockUpdates: { id: string; data: Record<string, unknown> }[] = [];

      for (const stock of stocks) {
        const quote = quotesMap.get(stock.symbol);
        if (!quote) continue;

        const currency = stock.market === "US" ? "USD" : stock.market === "HK" ? "HKD" : "CNY";

        upsertData.push({
          stock_id: stock.id,
          symbol: stock.symbol,
          market: stock.market,
          price: quote.price,
          prev_close: quote.prev_close,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          volume: quote.volume,
          amount: quote.amount,
          change: quote.change,
          change_percent: quote.change_percent,
          currency,
          source: "qt.gtimg.cn",
          fetched_at: new Date().toISOString(),
        });

        stockUpdates.push({
          id: stock.id,
          data: {
            last_price: quote.price,
            last_price_change: quote.change,
            last_price_change_percent: quote.change_percent,
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Upsert quote snapshots
      if (upsertData.length > 0) {
        await supabase.from(`${prefix}quote_snapshots`).upsert(upsertData, { onConflict: "stock_id" });
      }

      // Update stock prices
      for (const update of stockUpdates) {
        await supabase.from(`${prefix}stocks`).update(update.data).eq("id", update.id);
      }

      const duration = Date.now() - start;
      await recordJobRun(supabase, prefix, "sync-quotes", "success", duration, {
        total: stocks.length,
        fetched: quotesMap.size,
        upserted: upsertData.length,
      });

      console.log(`[worker] sync-quotes: fetched ${quotesMap.size}/${stocks.length} in ${duration}ms`);
    } catch (err) {
      const duration = Date.now() - start;
      await recordJobRun(supabase, prefix, "sync-quotes", "failed", duration, {
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[worker] sync-quotes failed:`, err);
    }
  },

  // Also expose HTTP endpoint for manual triggers
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/trigger/sync-quotes") {
      // Manually trigger quote sync
      const ctx = { waitUntil: (p: Promise<unknown>) => p } as unknown as ExecutionContext;
      await this.scheduled({} as ScheduledEvent, env, ctx);
      return new Response(JSON.stringify({ ok: true, message: "sync-quotes triggered" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
