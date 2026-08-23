"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  GitBranch,
  TrendingUp,
  FileText,
  BookOpen,
  Settings,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/dashboard/news", label: "科技资讯", icon: Newspaper },
  { href: "/dashboard/chains", label: "产业链", icon: GitBranch },
  { href: "/dashboard/stocks", label: "投资标的", icon: TrendingUp },
  { href: "/dashboard/reports", label: "AI 日报", icon: FileText },
  { href: "/dashboard/knowledge", label: "知识库", icon: BookOpen },
  { href: "/dashboard/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsAdmin(data?.role === "admin");
      }
    }
    checkAdmin();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-white">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <span className="font-bold">TechAnalysis</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-2 border-t" />
            <Link
              href="/dashboard/admin/health"
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith("/dashboard/admin")
                  ? "bg-blue-50 text-blue-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              系统监控
            </Link>
          </>
        )}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
