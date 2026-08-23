import Link from "next/link";
import { TrendingUp, Newspaper, GitBranch, BrainCircuit, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold">TechAnalysis Pro</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">登录</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">免费注册 <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            AI 科技投资分析平台
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            产业链图谱 · 多源资讯 · AI 分析 · 量化回测 · 自动日报
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg">开始使用</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">已有账号</Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Newspaper, title: "科技资讯流", desc: "国内外 20+ 稳定源，AI 中文摘要与情绪标签" },
            { icon: GitBranch, title: "产业链图谱", desc: "上传文档自动解析，AI 补全节点与关联标的" },
            { icon: BrainCircuit, title: "AI 分析", desc: "结合行情与新闻情绪，生成投资评级与策略快照" },
            { icon: TrendingUp, title: "量化回测", desc: "三策略回测（买入持有/均线趋势/突破），年化回撤胜率" },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <f.icon className="h-8 w-8 text-blue-600 mb-3" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
