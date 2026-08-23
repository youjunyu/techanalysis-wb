/**
 * Cron: Fetch RSS news from all active sources.
 * Stores new articles in news_articles, classifies sentiment and tags.
 * Runs every 10 minutes.
 *
 * POST /api/cron/fetch-news
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchMultipleFeeds } from "@/lib/scrapers/rss";
import { classifySentiment, extractTags } from "@/lib/sentiment";
import { withJobTracking, verifyCronSecret, logSystem } from "@/lib/cron";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result } = await withJobTracking("fetch-news", async () => {
      const admin = createAdminClient();

      // Get all active RSS sources
      const { data: sources, error: srcErr } = await admin
        .from("news_sources")
        .select("name, url")
        .eq("is_active", true)
        .eq("type", "rss");

      if (srcErr || !sources) {
        throw new Error(`Failed to fetch news sources: ${srcErr?.message}`);
      }

      if (sources.length === 0) {
        return { total_sources: 0, new_articles: 0, duplicates: 0, failures: 0 };
      }

      // Fetch all feeds in parallel batches
      const { articles, failures } = await fetchMultipleFeeds(
        sources.map((s) => ({ name: s.name, url: s.url })),
        20,
        3
      );

      // Process and upsert articles
      let newArticles = 0;
      let duplicates = 0;
      const insertData: Record<string, unknown>[] = [];

      for (const article of articles) {
        const sentiment = classifySentiment(article.title + " " + (article.content || ""));
        const tags = extractTags(article.title + " " + (article.content || ""));

        insertData.push({
          title: article.title,
          url: article.url,
          content: article.content || null,
          summary: null,
          sentiment,
          tags,
          source_name: article.source_name,
          source_url: article.source_url || null,
          published_at: article.published_at,
          stock_symbols: [],
        });
      }

      if (insertData.length > 0) {
        // Upsert by URL (unique constraint)
        const { data: upserted, error: upsertErr } = await admin
          .from("news_articles")
          .upsert(insertData, { onConflict: "url", ignoreDuplicates: true })
          .select("id");

        if (upsertErr) {
          await logSystem("crawler", "error", `fetch-news: upsert error: ${upsertErr.message}`);
        } else {
          newArticles = upserted?.length || 0;
          duplicates = insertData.length - newArticles;
        }
      }

      // Update fail_count for failing sources (best-effort, ignore errors)
      for (const failure of failures) {
        try {
          await admin.from("news_sources")
            .update({ fail_count: (await admin.from("news_sources").select("fail_count").eq("name", failure.name).single()).data?.fail_count + 1 || 1 })
            .eq("name", failure.name);
        } catch {}
      }

      const summary = {
        total_sources: sources.length,
        articles_fetched: articles.length,
        new_articles: newArticles,
        duplicates,
        failures: failures.length,
        failure_details: failures,
      };

      await logSystem("crawler", "info", `fetch-news: ${newArticles} new articles from ${sources.length} sources`, summary);

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
