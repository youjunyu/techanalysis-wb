/**
 * GET /api/news - List news articles
 * Query params: tag, sentiment, source, page, limit
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");
  const sentiment = searchParams.get("sentiment");
  const source = searchParams.get("source");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);

  try {
    const supabase = await createClient();

    let query = supabase
      .from("news_articles")
      .select("id, title, url, summary, sentiment, tags, source_name, published_at, stock_symbols", { count: "exact" })
      .order("published_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (tag) {
      query = query.contains("tags", [tag]);
    }

    if (sentiment && ["positive", "negative", "neutral"].includes(sentiment)) {
      query = query.eq("sentiment", sentiment);
    }

    if (source) {
      query = query.eq("source_name", source);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      articles: data || [],
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
