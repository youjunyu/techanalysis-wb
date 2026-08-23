"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth-confirm?reset=true`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Mail className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold">重置邮件已发送</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              请检查 <strong>{email}</strong> 的收件箱，按邮件指引重置密码。
            </p>
            <Link href="/login">
              <Button className="mt-6 w-full">返回登录</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>重置密码</CardTitle>
          <CardDescription>输入注册邮箱，我们将发送重置链接</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              发送重置邮件
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-blue-600 hover:underline">
              返回登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
