export const runtime = "edge";

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

export default async function ChainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: chain } = await supabase
    .from("industry_chains")
    .select("*")
    .eq("id", id)
    .single();

  if (!chain) notFound();

  // 两步查询：chain_stocks → stocks（避开 select() 内嵌的前缀问题）
  const { data: chainStocks } = await supabase
    .from("chain_stocks")
    .select("stock_id, source")
    .eq("chain_id", id);

  const stockIds = (chainStocks || []).map((cs: any) => cs.stock_id);
  const stocks = stockIds.length > 0
    ? (await supabase
        .from("stocks")
        .select("id, symbol, market, name, industry_tags, last_price, last_price_change_percent")
        .in("id", stockIds)).data || []
    : [];

  const nodes: any[] = Array.isArray(chain.nodes) ? chain.nodes : [];

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard/chains" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回产业链
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{chain.name}</h1>
          {chain.is_private && <Badge variant="secondary">私有</Badge>}
        </div>
        {chain.description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{chain.description}</p>
        )}
      </div>

      {/* 产业链环节 */}
      {nodes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-base font-semibold mb-3">产业链环节</h2>
            <div className="space-y-2">
              {nodes.map((node: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {node.category || node.type || `环节${i + 1}`}
                  </Badge>
                  <span className="text-sm">{node.name || node.label || JSON.stringify(node)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 关联标的 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-3">关联标的（{stocks.length}）</h2>
          {stocks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">该产业链暂未关联标的</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {stocks.map((stock: any) => {
                const change = Number(stock.last_price_change_percent || 0);
                const isUp = change >= 0;
                return (
                  <Link key={stock.id} href={`/dashboard/stocks/${stock.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{stock.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{stock.symbol}</p>
                          </div>
                          {stock.last_price != null && (
                            <div className="text-right">
                              <p className="font-mono text-sm">{Number(stock.last_price).toFixed(2)}</p>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
