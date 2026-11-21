// Server-side limits for AI topic generation. Pure functions so the quota
// math can be verified without a model or a database.

export const AI_GENERATION_LIMITS = {
  windowSeconds: 600,
  maxPerWindow: 6,
  dailySeconds: 86400,
  maxPerDay: 30,
  maxCountPerRequest: 10,
  requestTimeoutSeconds: 100,
} as const;

export const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{10,100}$/;

export type QuotaRow = { createdAt: string; status: string };
export type QuotaDecision =
  | { allowed: true; remaining: number; dailyRemaining: number }
  | { allowed: false; reason: "window" | "daily"; retryAfterSeconds: number; remaining: number; dailyRemaining: number };

export function evaluateQuota(rows: QuotaRow[], now = Date.now(), limits = AI_GENERATION_LIMITS): QuotaDecision {
  const parsed = rows
    .map((row) => ({ at: Date.parse(row.createdAt), status: row.status }))
    .filter((row) => Number.isFinite(row.at))
    .sort((a, b) => a.at - b.at);
  const windowStart = now - limits.windowSeconds * 1000;
  const dayStart = now - limits.dailySeconds * 1000;
  const recent = parsed.filter((row) => row.at > windowStart);
  const daily = parsed.filter((row) => row.at > dayStart);
  if (recent.length >= limits.maxPerWindow) {
    const oldest = recent[0].at;
    return {
      allowed: false,
      reason: "window",
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + limits.windowSeconds * 1000 - now) / 1000)),
      remaining: 0,
      dailyRemaining: Math.max(0, limits.maxPerDay - daily.length),
    };
  }
  if (daily.length >= limits.maxPerDay) {
    const oldest = daily[0].at;
    return {
      allowed: false,
      reason: "daily",
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + limits.dailySeconds * 1000 - now) / 1000)),
      remaining: Math.max(0, limits.maxPerWindow - recent.length),
      dailyRemaining: 0,
    };
  }
  return {
    allowed: true,
    remaining: Math.max(0, limits.maxPerWindow - recent.length - 1),
    dailyRemaining: Math.max(0, limits.maxPerDay - daily.length - 1),
  };
}

export function quotaMessage(decision: Extract<QuotaDecision, { allowed: false }>) {
  const minutes = Math.round(AI_GENERATION_LIMITS.windowSeconds / 60);
  if (decision.reason === "daily") {
    return `今日 AI 出题次数已用完（每天 ${AI_GENERATION_LIMITS.maxPerDay} 次），请在约 ${Math.ceil(decision.retryAfterSeconds / 3600)} 小时后重试。`;
  }
  return `请求过于频繁：每 ${minutes} 分钟最多 ${AI_GENERATION_LIMITS.maxPerWindow} 次，请在 ${decision.retryAfterSeconds} 秒后重试。`;
}
