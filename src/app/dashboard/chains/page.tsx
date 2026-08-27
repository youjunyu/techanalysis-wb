export const runtime = "edge";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";

export default async function ChainsPage() {
  const supabase = await createClient();

  // RLS：自己的 + 公开的产业链
  const { data: chains } = await supabase
    .from("industry_chains")
    .select("id, name, description, nodes, is_private, user_id, created_at")
    .order("created_at", { ascending: false });

  // 统计每条链的股票数（chain_stocks 全表可读）
  const { data: chainStocks } = await supabase
    .from("chain_stocks")
    .select("chain_id, stock_id");

  const countByChain: Record<string, number> = {};
  for (const cs of chainStocks || []) {
    countByChain[cs.chain_id] = (countByChain[cs.chain_id] || 0) + 1;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">产业链</h1>
        <p className="text-sm text-muted-foreground mt-1">
          科技产业链图谱 · 上中下游结构与关联标的
        </p>
      </div>

      {(!chains || chains.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-40" />
            暂无产业链数据。产业链生成后会在此展示。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {chains.map((chain: any) => {
            const nodeCount = Array.isArray(chain.nodes) ? chain.nodes.length : 0;
            const stockCount = countByChain[chain.id] || 0;
            return (
              <Link key={chain.id} href={`/dashboard/chains/${chain.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium">{chain.name}</h3>
                      {chain.is_private && <Badge variant="secondary" className="shrink-0">私有</Badge>}
                    </div>
                    {chain.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{chain.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{nodeCount} 个环节</span>
                      <span>·</span>
                      <span>{stockCount} 只标的</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
