export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

const kindLabels: Record<string, string> = {
  report: "研报",
  article: "文章",
  paper: "论文",
  filing: "公告",
  doc: "文档",
  pdf: "PDF",
  url: "链接",
  note: "笔记",
};

export default async function KnowledgePage() {
  const supabase = await createClient();

  // RLS：自己的 + 公开的研究文档
  const { data: docs } = await supabase
    .from("research_documents")
    .select("id, title, document_kind, source_type, source_url, content_text, visibility, chain_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">知识库</h1>
        <p className="text-sm text-muted-foreground mt-1">
          研究文档 · 研报 / 文章 / 论文 / 公告沉淀
        </p>
      </div>

      {(!docs || docs.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            暂无研究文档。上传或收藏的资料会在此沉淀。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc: any) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {doc.source_url ? (
                  <a href={doc.source_url} target="_blank" rel="noopener noreferrer" className="block">
                    <h3 className="font-medium hover:text-blue-600">{doc.title}</h3>
                  </a>
                ) : (
                  <h3 className="font-medium">{doc.title}</h3>
                )}
                {doc.content_text && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{doc.content_text}</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {kindLabels[doc.document_kind] || doc.document_kind}
                  </Badge>
                  {doc.visibility === "public" && <Badge variant="outline" className="text-xs">公开</Badge>}
                  <span>·</span>
                  <span>{new Date(doc.created_at).toLocaleString("zh-CN")}</span>
                  <span>·</span>
                  <span>{doc.source_type === "url" ? "链接采集" : "本地上传"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
