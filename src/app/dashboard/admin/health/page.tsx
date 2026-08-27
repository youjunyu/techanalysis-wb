export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: any }> = {
    success: { label: "成功", variant: "success" },
    partial: { label: "部分成功", variant: "secondary" },
    failed: { label: "失败", variant: "destructive" },
    running: { label: "运行中", variant: "secondary" },
  };
  const m = map[status] || { label: status, variant: "secondary" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export default async function AdminHealthPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .single();

  if (profile?.role !== "admin") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-40" />
            该页面仅管理员可见。
          </CardContent>
        </Card>
      </div>
    );
  }

  // job_runs / task_registry 仅管理员可读（RLS）
  const [runsRes, tasksRes, sourcesRes] = await Promise.all([
    supabase.from("job_runs").select("job_name, status, duration_ms, started_at").order("started_at", { ascending: false }).limit(50),
    supabase.from("task_registry").select("job_name, owner, expected_interval_minutes, is_enabled").order("job_name"),
    supabase.from("news_sources").select("name, fail_count").order("fail_count", { ascending: false }),
  ]);

  const runs = runsRes.data || [];
  const tasks = tasksRes.data || [];
  const sources = (sourcesRes.data || []).filter((s: any) => (s.fail_count || 0) > 0);

  // 按任务聚合统计
  const agg: Record<string, Record<string, number>> = {};
  for (const r of runs) {
    agg[r.job_name] = agg[r.job_name] || {};
    agg[r.job_name][r.status] = (agg[r.job_name][r.status] || 0) + 1;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">系统监控</h1>
          <p className="text-sm text-muted-foreground mt-1">定时任务运行状况 · 新闻源健康度</p>
        </div>
      </div>

      {/* 任务运行统计 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-3">任务运行统计（最近 {runs.length} 次）</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-1.5 font-normal">任务</th>
                  <th className="text-right py-1.5 font-normal">成功</th>
                  <th className="text-right py-1.5 font-normal">部分</th>
                  <th className="text-right py-1.5 font-normal">失败</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(agg).map(([job, stats]) => (
                  <tr key={job} className="border-b last:border-0">
                    <td className="py-1.5 font-mono text-xs">{job}</td>
                    <td className="py-1.5 text-right text-green-600">{stats.success || 0}</td>
                    <td className="py-1.5 text-right text-amber-600">{stats.partial || 0}</td>
                    <td className="py-1.5 text-right text-red-600">{stats.failed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 最近运行明细 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-3">最近运行明细</h2>
          <div className="space-y-1.5">
            {runs.slice(0, 20).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    {new Date(r.started_at).toLocaleString("zh-CN")}
                  </span>
                  <span className="font-mono text-xs truncate">{r.job_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">{r.duration_ms}ms</span>
                  {statusBadge(r.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 任务注册表 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-3">任务注册表</h2>
          <div className="space-y-1.5 text-sm">
            {tasks.map((t: any) => (
              <div key={t.job_name} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs truncate">{t.job_name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{t.owner}</Badge>
                  <span className="text-xs text-muted-foreground">
                    预期间隔 {t.expected_interval_minutes}min
                  </span>
                  <Badge variant={t.is_enabled ? "success" : "destructive"} className="text-xs">
                    {t.is_enabled ? "启用" : "停用"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 失败新闻源 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-3">异常新闻源（fail_count &gt; 0）</h2>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">所有新闻源均正常 ✓</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              {sources.map((s: any) => (
                <div key={s.name} className="flex items-center justify-between">
                  <span className="font-mono text-xs">{s.name}</span>
                  <Badge variant={s.fail_count >= 3 ? "destructive" : "secondary"} className="text-xs">
                    连续失败 {s.fail_count} 次
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
