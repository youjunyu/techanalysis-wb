export const runtime = "edge";

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";

const marketLabels: Record<string, string> = { A: "A股", HK: "港股", US: "美股" };

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtBig(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1e12) return (v / 1e12).toFixed(2) + " 万亿";
  if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
  if (v >= 1e4) return (v / 1e4).toFixed(2) + " 万";
  return v.toLocaleString("zh-CN");
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: stock } = await supabase
    .from("stocks")
    .select("id, symbol, market, name, name_en, industry_tags, last_price, last_price_change, last_price_change_percent, updated_at")
    .eq("id", id)
    .single();

  if (!stock) notFound();

  // 分两步查询：前缀代理只处理 .from()，不支持 select() 内嵌资源名
  const [quoteRes, analysesRes, chainStocksRes] = await Promise.all([
    supabase.from("quote_snapshots").select("*").eq("stock_id", id).single(),
    supabase.from("stock_analyses").select("analysis_text, rating, created_at").eq("stock_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("chain_stocks").select("chain_id").eq("stock_id", id),
  ]);

  const quote = quoteRes.data;
  const analyses = analysesRes.data || [];
  const chainIds = (chainStocksRes.data || []).map((c: any) => c.chain_id);
  const chains = chainIds.length > 0
    ? (await supabase.from("industry_chains").select("id, name").in("id", chainIds)).data || []
    : [];

  const changePct = stock.last_price_change_percent ?? quote?.change_percent ?? 0;
  const isUp = Number(changePct) >= 0;
  const currency = quote?.currency === "USD" ? "$" : quote?.currency === "HKD" ? "HK$" : "¥";

  const ratingLabels: Record<string, { label: string; variant: any }> = {
    buy: { label: "买入", variant: "success" },
    hold: { label: "持有", variant: "secondary" },
    watch: { label: "关注", variant: "secondary" },
    avoid: { label: "回避", variant: "destructive" },
  };

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard/stocks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回投资标的
      </Link>

      {/* 头部：名称 + 价格 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{stock.name}</h1>
            <Badge variant="secondary">{marketLabels[stock.market] || stock.market}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {stock.symbol}{stock.name_en ? ` · ${stock.name_en}` : ""}
          </p>
          {stock.industry_tags && stock.industry_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {stock.industry_tags.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold font-mono">
            {currency}{fmt(stock.last_price ?? quote?.price)}
          </p>
          <p className={`text-sm flex items-center justify-end gap-1 ${isUp ? "text-red-600" : "text-green-600"}`}>
            {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {isUp ? "+" : ""}{fmt(stock.last_price_change ?? quote?.change)} ({isUp ? "+" : ""}{fmt(changePct)}%)
          </p>
          {stock.updated_at && (
            <p className="text-xs text-muted-foreground mt-1">
              更新于 {new Date(stock.updated_at).toLocaleString("zh-CN")}
            </p>
          )}
        </div>
      </div>

      {/* 行情快照 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-3">行情快照</h2>
          {quote ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
              {[
                ["今开", quote.open != null ? currency + fmt(quote.open) : null],
                ["昨收", quote.prev_close != null ? currency + fmt(quote.prev_close) : null],
                ["最高", quote.high != null ? currency + fmt(quote.high) : null],
                ["最低", quote.low != null ? currency + fmt(quote.low) : null],
                ["成交量", quote.volume != null ? fmtBig(quote.volume) : null],
                ["成交额", quote.amount != null ? currency + fmtBig(quote.amount) : null],
                ["市盈率", quote.pe_ratio != null ? fmt(quote.pe_ratio) : null],
                ["市净率", quote.pb_ratio != null ? fmt(quote.pb_ratio) : null],
                ["总市值", quote.total_market_cap != null ? currency + fmtBig(quote.total_market_cap) : null],
                ["52周最高", quote.high_52week != null ? fmt(quote.high_52week) : null],
                ["52周最低", quote.low_52week != null ? fmt(quote.low_52week) : null],
                ["数据源", quote.source],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between border-b border-dashed pb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{value ?? "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">暂无行情快照数据</p>
          )}
        </CardContent>
      </Card>

      {/* 所属产业链 */}
      {chains.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-base font-semibold mb-3">所属产业链</h2>
            <div className="flex flex-wrap gap-2">
              {chains.map((c: any) => (
                <Link key={c.id} href={`/dashboard/chains/${c.id}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-blue-100">#{c.name}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI 分析 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-3">AI 分析</h2>
          {analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              暂无 AI 分析记录。分析任务生成后会在此展示。
            </p>
          ) : (
            <div className="space-y-3">
              {analyses.map((a: any, i: number) => (
                <div key={i} className="border-l-2 border-blue-200 pl-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(a.created_at).toLocaleString("zh-CN")}</span>
                    {a.rating && ratingLabels[a.rating] && (
                      <Badge variant={ratingLabels[a.rating].variant}>{ratingLabels[a.rating].label}</Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{a.analysis_text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
