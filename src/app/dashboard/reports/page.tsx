export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

function sentimentBadge(s: string | null) {
  if (!s) return null;
  const map: Record<string, { label: string; variant: any }> = {
    positive: { label: "利好", variant: "success" },
    negative: { label: "利空", variant: "destructive" },
    neutral: { label: "中性", variant: "secondary" },
  };
  const m = map[s];
  if (!m) return null;
  return <Badge variant={m.variant} className="shrink-0">{m.label}</Badge>;
}

export default async function ReportsPage() {
  const supabase = await createClient();

  // RLS：仅本人日报
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id, report_date, content, email_sent_at, created_at")
    .order("report_date", { ascending: false })
    .limit(14);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 日报</h1>
        <p className="text-sm text-muted-foreground mt-1">
          每日自动生成的个性化投资简报 · 自选股行情 + 订阅资讯
        </p>
      </div>

      {(!reports || reports.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            暂无日报。日报任务每日 00:00（北京时间）自动生成。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {reports.map((report: any) => {
            const c = report.content || {};
            const watchlist: any[] = c.watchlist || [];
            const news: any[] = c.news || [];
            return (
              <Card key={report.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {report.report_date} 投资日报
                    </h2>
                    {report.email_sent_at && (
                      <Badge variant="secondary">已邮件发送</Badge>
                    )}
                  </div>

                  {/* 自选股行情 */}
                  {watchlist.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">自选股行情</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground text-xs border-b">
                              <th className="text-left py-1.5 font-normal">名称</th>
                              <th className="text-right py-1.5 font-normal">代码</th>
                              <th className="text-right py-1.5 font-normal">价格</th>
                              <th className="text-right py-1.5 font-normal">涨跌幅</th>
                            </tr>
                          </thead>
                          <tbody>
                            {watchlist.map((w: any, i: number) => {
                              const pct = Number(w.change_percent || 0);
                              const isUp = pct >= 0;
                              return (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="py-1.5">{w.name || "—"}</td>
                                  <td className="py-1.5 text-right font-mono text-muted-foreground">{w.symbol || "—"}</td>
                                  <td className="py-1.5 text-right font-mono">{w.price != null ? Number(w.price).toFixed(2) : "—"}</td>
                                  <td className={`py-1.5 text-right font-mono ${isUp ? "text-red-600" : "text-green-600"}`}>
                                    {isUp ? "+" : ""}{pct.toFixed(2)}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 重点资讯 */}
                  {news.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">重点资讯（{news.length}）</h3>
                      <ul className="space-y-1.5">
                        {news.slice(0, 10).map((n: any, i: number) => (
                          <li key={i} className="flex items-start justify-between gap-2 text-sm">
                            <a
                              href={n.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600 line-clamp-1"
                            >
                              {n.title}
                            </a>
                            {sentimentBadge(n.sentiment)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-muted-foreground">
                    生成于 {new Date(report.created_at).toLocaleString("zh-CN")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
