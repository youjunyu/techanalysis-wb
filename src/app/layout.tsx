import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechAnalysis Pro - AI 科技投资分析平台",
  description: "产业链投研系统 | 科技资讯 · 行情分析 · AI 日报",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
