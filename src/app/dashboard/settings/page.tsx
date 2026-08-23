"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Clock } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [reportTime, setReportTime] = useState("08:00");
  const [subTags, setSubTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setReportEmail(data.daily_report_email || user.email || "");
        setReportTime(data.report_time || "08:00");
        setSubTags(data.subscription_tags || []);
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        daily_report_email: reportEmail,
        report_time: reportTime,
        subscription_tags: subTags,
      })
      .eq("id", user.id);

    if (error) {
      setMessage(`保存失败: ${error.message}`);
    } else {
      setMessage("保存成功");
    }
    setSaving(false);
  }

  function addTag() {
    const tag = newTag.trim();
    if (tag && !subTags.includes(tag)) {
      setSubTags([...subTags, tag]);
      setNewTag("");
    }
  }

  function removeTag(tag: string) {
    setSubTags(subTags.filter((t) => t !== tag));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-muted-foreground mt-1">个人资料、订阅标签与日报配置</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" /> 个人资料
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>邮箱</Label>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {email}
            </div>
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <Badge variant={profile?.role === "admin" ? "default" : "secondary"}>
              {profile?.role === "admin" ? "管理员" : "普通用户"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">订阅标签</CardTitle>
          <CardDescription>影响日报内容范围与资讯过滤</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {subTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                {tag} ×
              </Badge>
            ))}
            {subTags.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无标签</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="添加标签（如 AI算力、半导体）"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            />
            <Button variant="outline" onClick={addTag}>添加</Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" /> 日报配置
          </CardTitle>
          <CardDescription>设置日报接收邮箱与发送时间</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reportEmail">日报接收邮箱</Label>
            <Input
              id="reportEmail"
              type="email"
              value={reportEmail}
              onChange={(e) => setReportEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportTime">发送时间（北京时间）</Label>
            <Input
              id="reportTime"
              type="time"
              value={reportTime}
              onChange={(e) => setReportTime(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {message && (
        <p className={`text-sm ${message.includes("失败") ? "text-destructive" : "text-green-600"}`}>
          {message}
        </p>
      )}
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        保存设置
      </Button>
    </div>
  );
}
