/**
 * Cron: Sync stock quotes from qt.gtimg.cn.
 * Fetches all stocks in DB, upserts quote_snapshots.
 * Runs every 5 minutes during market hours via Cloudflare Worker cron.
 *
 * POST /api/cron/sync-quotes
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchQuotes, toQuoteSnapshot } from "@/lib/quotes";
import { withJobTracking, verifyCronSecret, logSystem } from "@/lib/cron";
import type { Market } from "@/types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Verify auth
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result } = await withJobTracking("sync-quotes", async () => {
      const admin = createAdminClient();

      // Get all stocks
      const { data: stocks, error: stockErr } = await admin
        .from("stocks")
        .select("id, symbol, market, name")
        .order("symbol");

      if (stockErr || !stocks) {
        throw new Error(`Failed to fetch stocks: ${stockErr?.message}`);
      }

      const symbols = stocks.map((s) => s.symbol);
      const marketMap = new Map<string, { id: string; market: Market }>();
      for (const s of stocks) {
        marketMap.set(s.symbol, { id: s.id, market: s.market as Market });
      }

      // Fetch quotes in batches
      const quotesMap = await fetchQuotes(symbols);

      let upserted = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Upsert each quote
      const upsertData: Record<string, unknown>[] = [];
      for (const [symbol, quote] of quotesMap) {
        const stockInfo = marketMap.get(symbol);
        if (!stockInfo) {
          skipped++;
          continue;
        }
        const snapshot = toQuoteSnapshot(quote, stockInfo.id, stockInfo.market);
        upsertData.push({
          stock_id: stockInfo.id,
          symbol: snapshot.symbol,
          market: snapshot.market,
          price: snapshot.price,
          prev_close: snapshot.prev_close,
          open: snapshot.open,
          high: snapshot.high,
          low: snapshot.low,
          volume: snapshot.volume,
          amount: snapshot.amount,
          change: snapshot.change,
          change_percent: snapshot.change_percent,
          currency: snapshot.currency,
          source: snapshot.source,
          fetched_at: snapshot.fetched_at,
        });
      }

      if (upsertData.length > 0) {
        const { error: upsertErr } = await admin
          .from("quote_snapshots")
          .upsert(upsertData, { onConflict: "stock_id" });

        if (upsertErr) {
          errors.push(upsertErr.message);
        } else {
          upserted = upsertData.length;
        }
      }

      // Update last_price on stocks table
      const stockUpdates: { id: string; last_price: number; last_price_change: number; last_price_change_percent: number; updated_at: string }[] = [];
      for (const [symbol, quote] of quotesMap) {
        const stockInfo = marketMap.get(symbol);
        if (stockInfo) {
          stockUpdates.push({
            id: stockInfo.id,
            last_price: quote.price,
            last_price_change: quote.change,
            last_price_change_percent: quote.change_percent,
            updated_at: new Date().toISOString(),
          });
          }
        }

      // Batch update stocks (single upsert instead of N sequential requests)
      if (stockUpdates.length > 0) {
        const { error: updateErr } = await admin
          .from("stocks")
          .upsert(stockUpdates, { onConflict: "id" });
        if (updateErr) {
          errors.push(`stocks update: ${updateErr.message}`);
        }
      }

      const summary = {
        total_stocks: stocks.length,
        fetched: quotesMap.size,
        upserted,
        skipped,
        errors,
      };

      await logSystem("crawler", "info", `sync-quotes: fetched ${quotesMap.size}/${stocks.length}, upserted ${upserted}`, summary);

      return summary;
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
