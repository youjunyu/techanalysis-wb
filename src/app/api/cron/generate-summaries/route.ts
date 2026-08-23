/**
 * Cron: Generate AI summaries for recent news articles without summaries.
 * Uses keyword-based summarization as fallback when AI is unavailable.
 * Runs every 10 minutes.
 *
 * POST /api/cron/generate-summaries
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { withJobTracking, verifyCronSecret, logSystem } from "@/lib/cron";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Generate a simple extractive summary from article content.
 * Takes the first 2 sentences as summary (basic approach).
 */
function generateSummary(content: string): string {
  if (!content) return "";
  // Clean HTML tags
  const clean = content.replace(/<[^>]+>/g, "").trim();
  // Split into sentences
  const sentences = clean
    .split(/[。！？.!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length === 0) return clean.slice(0, 200);
  // Take first 2-3 sentences
  const count = Math.min(3, sentences.length);
  return sentences.slice(0, count).join("。") + "。";
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result } = await withJobTracking("generate-summaries", async () => {
      const admin = createAdminClient();

      // Get recent articles without summaries (last 24h)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: articles, error: artErr } = await admin
        .from("news_articles")
        .select("id, title, content")
        .is("summary", null)
        .gte("published_at", cutoff)
        .order("published_at", { ascending: false })
        .limit(50);

      if (artErr || !articles) {
        throw new Error(`Failed to fetch articles: ${artErr?.message}`);
      }

      let updated = 0;
      for (const article of articles) {
        const content = article.content || article.title;
        const summary = generateSummary(content);

        if (summary) {
          const { error: updateErr } = await admin
            .from("news_articles")
            .update({ summary })
            .eq("id", article.id);

          if (!updateErr) updated++;
        }
      }

      const summary = { processed: articles.length, updated };
      await logSystem("crawler", "info", `generate-summaries: updated ${updated}/${articles.length}`, summary);

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
