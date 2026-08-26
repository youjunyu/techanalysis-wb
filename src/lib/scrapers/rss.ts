/**
 * Lightweight RSS feed parser.
 * Uses fast-xml-parser to parse RSS/Atom feeds.
 * Each source has independent try/catch — single source failure
 * does not block the batch (circuit breaker pattern).
 */

import { XMLParser } from "fast-xml-parser";

export interface ParsedArticle {
  title: string;
  url: string;
  content?: string;
  published_at: string;
  source_name: string;
  source_url?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function fetchRSSFeed(
  sourceName: string,
  feedUrl: string,
  maxItems = 20
): Promise<ParsedArticle[]> {
  try {
    const resp = await fetch(feedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TechAnalysisBot/1.0; +https://techanalysis-wb.pages.dev)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const text = await resp.text();
    const parsed = parser.parse(text);

    // Handle RSS 2.0
    let items: any[] = [];
    if (parsed.rss?.channel?.item) {
      items = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item];
    }
    // Handle Atom
    else if (parsed.feed?.entry) {
      items = Array.isArray(parsed.feed.entry)
        ? parsed.feed.entry
        : [parsed.feed.entry];
    }

    return items.slice(0, maxItems).map((item: any) => {
      // RSS 2.0
      let title = item.title;
      let url = item.link;
      let pubDate = item.pubDate;

      // Atom
      if (typeof title === "object") title = title["#text"] || "";
      if (typeof url === "object") url = url["@_href"] || url["#text"] || "";
      if (!pubDate && item.published) pubDate = item.published;
      if (!pubDate && item.updated) pubDate = item.updated;

      // Parse date
      let published_at: string;
      try {
        published_at = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      } catch {
        published_at = new Date().toISOString();
      }

      return {
        title: String(title || "").trim(),
        url: String(url || "").trim(),
        content: String(item.description || item.summary || item.content || "").trim().slice(0, 5000) || undefined,
        published_at,
        source_name: sourceName,
        source_url: feedUrl,
      };
    }).filter((a) => a.title && a.url);
  } catch (err) {
    console.error(`[rss] Failed to fetch ${sourceName} (${feedUrl}):`, err);
    return [];
  }
}

/**
 * Fetch multiple RSS feeds in parallel with per-source isolation.
 * All sources are fetched CONCURRENTLY (each has its own 15s timeout in
 * fetchRSSFeed), so total time is bounded by the slowest single source,
 * not by waves of sequential batches.
 * Returns all successfully parsed articles.
 */
export async function fetchMultipleFeeds(
  sources: { name: string; url: string }[],
  maxPerSource = 20,
  _parallelCount = 3 // kept for API compatibility; concurrency is now full
): Promise<{ articles: ParsedArticle[]; failures: { name: string; error: string }[] }> {
  const articles: ParsedArticle[] = [];
  const failures: { name: string; error: string }[] = [];

  // Fetch ALL sources concurrently (subrequest limit on CF free plan is 50;
  // we stay well under it with ~19 sources + a handful of REST calls).
  const results = await Promise.allSettled(
    sources.map(async (src) => {
      const items = await fetchRSSFeed(src.name, src.url, maxPerSource);
      if (items.length === 0) {
        throw new Error("No items returned");
      }
      return items;
    })
  );

  for (let j = 0; j < results.length; j++) {
    const r = results[j];
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      failures.push({
        name: sources[j].name,
        error: (r as PromiseRejectedResult).reason?.message || "Unknown error",
      });
    }
  }

  return { articles, failures };
}
