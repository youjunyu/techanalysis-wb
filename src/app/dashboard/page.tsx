export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Newspaper, Activity } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch watchlist stocks with latest quotes
  // (两步查询：前缀代理只处理 .from()，select() 内嵌资源名不会被加前缀)
  const { data: watchRows } = await supabase
    .from("user_watchlist")
    .select("stock_id")
    .eq("user_id", user?.id || "")
    .limit(10);

  const watchIds = (watchRows || []).map((w: any) => w.stock_id);
  const stocks = watchIds.length > 0
    ? (await supabase
        .from("stocks")
        .select("id, symbol, name, market, last_price, last_price_change, last_price_change_percent")
        .in("id", watchIds)).data || []
    : [];

  // Fetch recent news
  const { data: recentNews } = await supabase
    .from("news_articles")
    .select("id, title, summary, sentiment, source_name, published_at")
    .order("published_at", { ascending: false })
    .limit(8);

  // Fetch market snapshot
  const { data: marketSnapshot } = await supabase
    .from("market_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();



  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("zh-CN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Market Overview */}
      {marketSnapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-blue-600" />
              市场画像
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "情绪", value: marketSnapshot.row?.SENTIMENT_STATUS, score: marketSnapshot.row?.SENTIMENT_SCORE },
                { label: "短期趋势", value: marketSnapshot.row?.TREND_SHORT_DIRECTION_STATUS, score: marketSnapshot.row?.TREND_SHORT_DIRECTION_SCORE },
                { label: "估值水平", value: marketSnapshot.row?.VALUATION_STATUS, score: marketSnapshot.row?.VALUATION_SCORE },
                { label: "量能", value: marketSnapshot.row?.VOLUME_ENERGE_STATUS, score: marketSnapshot.row?.VOLUME_ENERGE_SCORE },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="mt-1 text-sm font-medium">{m.value || "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">评分: {m.score || "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Watchlist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                自选股
              </span>
              <Link href="/dashboard/stocks" className="text-xs text-blue-600 hover:underline">
                查看全部
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stocks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                暂无自选股，<Link href="/dashboard/stocks" className="text-blue-600 hover:underline">去添加</Link>
              </p>
            ) : (
              <div className="space-y-2">
                {stocks.map((stock: any) => (
                  <Link
                    key={stock.id}
                    href={`/dashboard/stocks/${stock.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div>
                      <span className="font-medium">{stock.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{stock.symbol}</span>
                    </div>
                    {stock.last_price != null && (
                      <div className="text-right">
                        <span className="font-mono text-sm">{stock.last_price.toFixed(2)}</span>
                        <span
                          className={`ml-2 text-xs font-medium ${
                            (stock.last_price_change_percent || 0) >= 0 ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {(stock.last_price_change_percent || 0) >= 0 ? "↑" : "↓"}
                          {Math.abs(stock.last_price_change_percent || 0).toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent News */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-blue-600" />
                最新资讯
              </span>
              <Link href="/dashboard/news" className="text-xs text-blue-600 hover:underline">
                查看全部
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recentNews || recentNews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无资讯</p>
            ) : (
              <div className="space-y-2">
                {recentNews.map((news: any) => (
                  <Link
                    key={news.id}
                    href={`/dashboard/news`}
                    className="block rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2">{news.title}</p>
                      {news.sentiment && (
                        <Badge
                          variant={
                            news.sentiment === "positive" ? "success" :
                            news.sentiment === "negative" ? "destructive" : "secondary"
                          }
                          className="shrink-0"
                        >
                          {news.sentiment === "positive" ? "利好" : news.sentiment === "negative" ? "利空" : "中性"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {news.source_name} · {new Date(news.published_at).toLocaleDateString("zh-CN")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
