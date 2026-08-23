/**
 * Cron: Generate daily reports for users.
 * Creates personalized daily report JSON in daily_reports table.
 * Runs once per day (midnight UTC+8).
 *
 * POST /api/cron/daily-report
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { withJobTracking, verifyCronSecret, logSystem } from "@/lib/cron";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result } = await withJobTracking("daily-report", async () => {
      const admin = createAdminClient();

      // Get all users with their profiles
      const { data: profiles, error: profErr } = await admin
        .from("profiles")
        .select("id, email, subscription_tags, report_time");

      if (profErr || !profiles) {
        throw new Error(`Failed to fetch profiles: ${profErr?.message}`);
      }

      const today = new Date().toISOString().split("T")[0];
      let generated = 0;
      let skipped = 0;

      for (const profile of profiles) {
        // Check if report already exists for today
        const { data: existing } = await admin
          .from("daily_reports")
          .select("id")
          .eq("user_id", profile.id)
          .eq("report_date", today)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Get user's watchlist stocks with latest quotes
        const { data: watchlist } = await admin
          .from("user_watchlist")
          .select("stock_id, stocks(id, symbol, market, name, last_price, last_price_change, last_price_change_percent)")
          .eq("user_id", profile.id);

        // Get recent news matching user's subscription tags
        const tags = profile.subscription_tags || [];
        let newsQuery = admin
          .from("news_articles")
          .select("title, url, source_name, published_at, sentiment, tags")
          .order("published_at", { ascending: false })
          .limit(20);

        if (tags.length > 0) {
          newsQuery = newsQuery.overlaps("tags", tags);
        }

        const { data: news } = await newsQuery;

        // Get market overview
        const { data: marketSnapshot } = await admin
          .from("market_snapshots")
          .select("row, snapshot_date")
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .single();

        // Build report content
        const reportContent = {
          date: today,
          user_email: profile.email,
          watchlist: (watchlist || []).map((w: any) => ({
            symbol: w.stocks?.symbol,
            name: w.stocks?.name,
            price: w.stocks?.last_price,
            change: w.stocks?.last_price_change,
            change_percent: w.stocks?.last_price_change_percent,
          })),
          news: (news || []).map((n: any) => ({
            title: n.title,
            url: n.url,
            source: n.source_name,
            published_at: n.published_at,
            sentiment: n.sentiment,
          })),
          market_overview: marketSnapshot?.row || null,
        };

        // Insert report
        const { error: insertErr } = await admin.from("daily_reports").insert({
          user_id: profile.id,
          report_date: today,
          content: reportContent,
        });

        if (insertErr) {
          await logSystem("report", "error", `Failed to generate report for ${profile.email}: ${insertErr.message}`);
        } else {
          generated++;
        }
      }

      const summary = { total_users: profiles.length, generated, skipped };
      await logSystem("report", "info", `daily-report: generated ${generated} reports, skipped ${skipped}`, summary);

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
