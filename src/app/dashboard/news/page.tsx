export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function NewsPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("news_articles")
    .select("id, title, url, summary, sentiment, tags, source_name, published_at")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">科技资讯</h1>
        <p className="text-sm text-muted-foreground mt-1">国内外科技媒体 · AI 中文摘要与情绪标签</p>
      </div>

      <div className="space-y-3">
        {(!articles || articles.length === 0) ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              暂无资讯数据。数据采集任务正在配置中。
            </CardContent>
          </Card>
        ) : (
          articles.map((article: any) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium hover:text-blue-600">{article.title}</h3>
                    {article.sentiment && (
                      <Badge
                        variant={
                          article.sentiment === "positive" ? "success" :
                          article.sentiment === "negative" ? "destructive" : "secondary"
                        }
                        className="shrink-0"
                      >
                        {article.sentiment === "positive" ? "利好" : article.sentiment === "negative" ? "利空" : "中性"}
                      </Badge>
                    )}
                  </div>
                  {article.summary && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{article.source_name}</span>
                    <span>·</span>
                    <span>{new Date(article.published_at).toLocaleString("zh-CN")}</span>
                    {article.tags && article.tags.length > 0 && (
                      <>
                        <span>·</span>
                        <div className="flex gap-1">
                          {article.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-blue-600">#{tag}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </a>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
