/**
 * GET/POST/DELETE /api/watchlist - User watchlist management
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// GET user's watchlist
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_watchlist")
      .select("stock_id, created_at, stocks(id, symbol, market, name, industry_tags, last_price, last_price_change, last_price_change_percent)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ watchlist: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// POST add stock to watchlist
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { stock_id } = body;

    if (!stock_id) {
      return NextResponse.json({ error: "stock_id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_watchlist")
      .insert({ user_id: user.id, stock_id });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, message: "Already in watchlist" });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// DELETE remove stock from watchlist
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stock_id = searchParams.get("stock_id");

    if (!stock_id) {
      return NextResponse.json({ error: "stock_id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("stock_id", stock_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
