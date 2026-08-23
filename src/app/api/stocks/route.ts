/**
 * GET /api/stocks - List stocks with optional filters
 * Query params: market (A|HK|US), tag, search, page, limit
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market");
  const tag = searchParams.get("tag");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  try {
    const supabase = await createClient();

    let query = supabase
      .from("stocks")
      .select("id, symbol, market, name, name_en, industry_tags, last_price, last_price_change, last_price_change_percent, updated_at", { count: "exact" })
      .order("symbol")
      .range((page - 1) * limit, page * limit - 1);

    if (market && ["A", "HK", "US"].includes(market)) {
      query = query.eq("market", market);
    }

    if (tag) {
      query = query.contains("industry_tags", [tag]);
    }

    if (search) {
      query = query.or(`symbol.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      stocks: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
