/**
 * Simple keyword-based sentiment classifier.
 * Used as fallback when AI is unavailable.
 */

const POSITIVE_KEYWORDS = [
  "增长", "盈利", "突破", "创新高", "超预期", "获批", "合作", "收购",
  "大涨", "利好", "上调", "加速", "强劲", "领先", "成功", "提升",
  "growth", "profit", "beat", "surge", "rally", "breakthrough", "approve",
  "partnership", "acquire", "upgrade", "strong", "record",
];

const NEGATIVE_KEYWORDS = [
  "下跌", "亏损", "裁员", "违规", "处罚", "调查", "下滑", "暴跌",
  "利空", "下调", "警告", "风险", "退市", "诉讼", "召回", "违约",
  "decline", "loss", "layoff", "violation", "penalty", "probe", "drop",
  "plunge", "downgrade", "warning", "risk", "delist", "lawsuit", "recall",
];

export function classifySentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  let positive = 0;
  let negative = 0;

  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) positive++;
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) negative++;
  }

  if (positive > negative) return "positive";
  if (negative > positive) return "negative";
  return "neutral";
}

/**
 * Extract tags from article text using keyword matching.
 */
const TAG_KEYWORDS: Record<string, string[]> = {
  "AI": ["人工智能", "AI", "大模型", "GPT", "LLM", "机器学习", "deep learning"],
  "半导体": ["芯片", "半导体", "chip", "semiconductor", "晶圆", "wafer"],
  "新能源": ["光伏", "solar", "锂电池", "battery", "新能源", "储能", "充电"],
  "机器人": ["机器人", "robot", "自动化", "automation", "人形"],
  "云计算": ["云", "cloud", "SaaS", "IaaS", "PaaS"],
  "5G": ["5G", "通信", "telecom", "基站"],
  "汽车": ["汽车", "vehicle", "电动车", "EV", "自动驾驶"],
  "金融科技": ["fintech", "支付", "payment", "区块链", "blockchain"],
};

export function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }
  return tags;
}
