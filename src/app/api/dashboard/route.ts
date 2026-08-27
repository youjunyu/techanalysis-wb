/**
 * GET /api/dashboard - Aggregated dashboard data
 * Returns market overview, user watchlist quotes, and latest news
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get latest market snapshot
    const { data: marketOverview } = await supabase
      .from("market_snapshots")
      .select("row, snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    // Get latest news (10)
    const { data: latestNews } = await supabase
      .from("news_articles")
      .select("id, title, url, summary, sentiment, tags, source_name, published_at")
      .order("published_at", { ascending: false })
      .limit(10);

    // Get top gainers and losers
    const { data: gainers } = await supabase
      .from("stocks")
      .select("id, symbol, market, name, last_price, last_price_change, last_price_change_percent")
      .not("last_price", "is", null)
      .order("last_price_change_percent", { ascending: false })
      .limit(5);

    const { data: losers } = await supabase
      .from("stocks")
      .select("id, symbol, market, name, last_price, last_price_change, last_price_change_percent")
      .not("last_price", "is", null)
      .order("last_price_change_percent", { ascending: true })
      .limit(5);

    // Get user watchlist if logged in
    // (两步查询：前缀代理只处理 .from()，select() 内嵌资源名不会被加前缀)
    let watchlist = null;
    if (user) {
      const { data: wlRows } = await supabase
        .from("user_watchlist")
        .select("stock_id")
        .eq("user_id", user.id);
      const wlIds = (wlRows || []).map((w: any) => w.stock_id);
      watchlist = wlIds.length > 0
        ? (await supabase
            .from("stocks")
            .select("id, symbol, market, name, last_price, last_price_change, last_price_change_percent")
            .in("id", wlIds)).data || []
        : [];
    }

    return NextResponse.json({
      market_overview: marketOverview?.row || null,
      market_date: marketOverview?.snapshot_date || null,
      latest_news: latestNews || [],
      gainers: gainers || [],
      losers: losers || [],
      watchlist: watchlist || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
