/**
 * Quote fetching utilities.
 * Primary: qt.gtimg.cn (Tencent public quote API, lightweight)
 * Fallback: Sina (hq.sinajs.cn), Eastmoney (push2.eastmoney.com)
 *
 * In the rebuild, the westock MCP channel (via WorkBuddy automation)
 * enriches quote_snapshots with PE/PB/market_cap/52w data.
 */

import type { Market, QuoteSnapshot } from "@/types";

interface RawQuote {
  code: string;
  name: string;
  price: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  change: number;
  change_percent: number;
  currency: string;
}

/**
 * Convert internal symbol to Tencent qt.gtimg.cn format.
 * sh600519 -> sh600519
 * hk00700  -> hk00700
 * usAAPL   -> usAAPL
 */
function toTencentCode(symbol: string): string {
  return symbol;
}

/**
 * Parse a single quote line from qt.gtimg.cn response.
 * Format: v_sh600519="1~贵州茅台~600519~SH~1272.83~1291.5~..."
 */
function parseTencentQuote(raw: string, symbol: string): RawQuote | null {
  const parts = raw.split("~");
  if (parts.length < 50) return null;

  const name = parts[1];
  const price = parseFloat(parts[3]) || 0;
  const prev_close = parseFloat(parts[4]) || 0;
  const open = parseFloat(parts[5]) || 0;
  const high = parseFloat(parts[33]) || 0;
  const low = parseFloat(parts[34]) || 0;
  const volume = parseInt(parts[36]) || 0;
  const amount = parseFloat(parts[37]) || 0;
  const change = price - prev_close;
  const change_percent = prev_close > 0 ? (change / prev_close) * 100 : 0;

  // Determine currency by market
  const isUS = symbol.startsWith("us");
  const isHK = symbol.startsWith("hk");
  const currency = isUS ? "USD" : isHK ? "HKD" : "CNY";

  return {
    code: symbol,
    name,
    price,
    prev_close,
    open,
    high: high || price,
    low: low || price,
    volume,
    amount,
    change,
    change_percent,
    currency,
  };
}

/**
 * Fetch quotes for multiple stocks from qt.gtimg.cn.
 * Batch size: 40 stocks per request.
 */
export async function fetchQuotes(
  symbols: string[],
  batchSize = 40
): Promise<Map<string, RawQuote>> {
  const results = new Map<string, RawQuote>();

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const codes = batch.map(toTencentCode).join(",");

    try {
      const url = `https://qt.gtimg.cn/q=${codes}`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!resp.ok) {
        console.error(`[quotes] Batch fetch failed: ${resp.status}`);
        continue;
      }

      const text = await resp.text();
      const lines = text.split(";").filter((l) => l.trim().length > 0);

      for (const line of lines) {
        const match = line.match(/v_(\w+)=["'](.*)["']/);
        if (!match) continue;

        const code = match[1];
        const data = match[2];
        const parsed = parseTencentQuote(data, code);

        if (parsed && parsed.price > 0) {
          results.set(code, parsed);
        }
      }
    } catch (err) {
      console.error(`[quotes] Error fetching batch:`, err);
    }
  }

  return results;
}

/**
 * Convert RawQuote to QuoteSnapshot for DB upsert.
 */
export function toQuoteSnapshot(
  raw: RawQuote,
  stockId: string,
  market: Market
): Omit<QuoteSnapshot, "fetched_at"> & { fetched_at: string } {
  return {
    stock_id: stockId,
    symbol: raw.code,
    market,
    price: raw.price,
    prev_close: raw.prev_close,
    open: raw.open,
    high: raw.high,
    low: raw.low,
    volume: raw.volume,
    amount: raw.amount,
    change: raw.change,
    change_percent: raw.change_percent,
    currency: raw.currency,
    source: "qt.gtimg.cn",
    fetched_at: new Date().toISOString(),
  };
}
