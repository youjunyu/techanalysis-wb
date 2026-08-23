export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

export default async function StocksPage() {
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from("stocks")
    .select("id, symbol, name, market, industry_tags, last_price, last_price_change, last_price_change_percent")
    .order("market")
    .order("symbol");

  // Group by market
  const grouped = (stocks || []).reduce((acc: Record<string, any[]>, s: any) => {
    const key = s.market || "OTHER";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const marketLabels: Record<string, string> = { A: "A股", HK: "港股", US: "美股" };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">投资标的</h1>
        <p className="text-sm text-muted-foreground mt-1">
          科技主题池 · AI 算力 / 半导体 / 机器人 / 新能源
        </p>
      </div>

      {Object.entries(grouped).map(([market, list]) => (
        <div key={market}>
          <h2 className="text-lg font-semibold mb-3">{marketLabels[market] || market}</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {list.map((stock: any) => {
              const change = stock.last_price_change_percent || 0;
              const isUp = change >= 0;
              return (
                <Link key={stock.id} href={`/dashboard/stocks/${stock.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{stock.name}</p>
                          <p className="text-xs text-muted-foreground">{stock.symbol}</p>
                        </div>
                        {stock.last_price != null && (
                          <div className="text-right">
                            <p className="font-mono text-sm">{stock.last_price.toFixed(2)}</p>
                            <p className={`text-xs flex items-center justify-end gap-0.5 ${isUp ? "text-red-600" : "text-green-600"}`}>
                              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {Math.abs(change).toFixed(2)}%
                            </p>
                          </div>
                        )}
                      </div>
                      {stock.industry_tags && stock.industry_tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {stock.industry_tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
