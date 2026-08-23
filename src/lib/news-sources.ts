/**
 * Default RSS news sources configuration.
 * These are seeded into news_sources table at schema creation.
 * Sources are curated for stability and tech/finance coverage.
 */

export interface NewsSourceConfig {
  name: string;
  url: string;
  type: "rss" | "web" | "api";
  region: "cn" | "us" | "hk" | "global";
}

export const DEFAULT_NEWS_SOURCES: NewsSourceConfig[] = [
  // 国内科技
  { name: "36氪", url: "https://36kr.com/feed", type: "rss", region: "cn" },
  { name: "机器之心", url: "https://www.jiqizhixin.com/rss", type: "rss", region: "cn" },
  { name: "量子位", url: "https://www.qbitai.com/feed", type: "rss", region: "cn" },
  { name: "InfoQ", url: "https://www.infoq.cn/feed", type: "rss", region: "cn" },
  { name: "爱范儿", url: "https://www.ifanr.com/feed", type: "rss", region: "cn" },
  { name: "少数派", url: "https://sspai.com/feed", type: "rss", region: "cn" },
  { name: "钛媒体", url: "https://www.tmtpost.com/feed", type: "rss", region: "cn" },
  // 国外科技
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", type: "rss", region: "us" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", type: "rss", region: "us" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", type: "rss", region: "us" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/", type: "rss", region: "us" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", type: "rss", region: "us" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", type: "rss", region: "us" },
  // 财经
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", type: "rss", region: "global" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", type: "rss", region: "global" },
  { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", type: "rss", region: "global" },
  // 宏观/机构
  { name: "美联储", url: "https://www.federalreserve.gov/feeds/press_all.xml", type: "rss", region: "global" },
  { name: "中国人民银行", url: "http://www.pbc.gov.cn/rss/zhengcefabu.xml", type: "rss", region: "global" },
];
