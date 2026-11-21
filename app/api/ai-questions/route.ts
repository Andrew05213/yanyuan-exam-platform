import { env } from "cloudflare:workers";
import { principal, sameOrigin, fail, AccessError, privateHeaders, readLimitedText } from "../../../lib/user-access";
import { adminDb } from "../../../lib/admin-access";
import { providerForExecution } from "../../../lib/admin-providers";
import { modelListUrl } from "../../../lib/provider-models";
import { upstreamFetch } from "../../../lib/upstream-fetch";
import { textHash } from "../../../lib/study-contracts";
import { deepseekEnvReady, deepseekFromEnv } from "../../../lib/deepseek-config";
import { AI_DIFFICULTIES, AI_SUBJECTS, BankContractError } from "../../../lib/question-bank-contracts";
import {
  AI_COUNTS,
  AI_TYPES,
  generationPlan,
  parseGeneration,
  promptFor,
  upstreamError,
} from "../../../lib/ai-question-generation";
import {
  AI_GENERATION_LIMITS,
  REQUEST_ID_PATTERN,
  evaluateQuota,
  quotaMessage,
} from "../../../lib/ai-question-limits";

export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: privateHeaders });

async function resolveProvider() {
  if (deepseekEnvReady()) {
    const config = deepseekFromEnv();
    return {
      name: "DeepSeek",
      protocol: "openai-compatible",
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
    };
  }
  const provider = await providerForExecution();
  if (provider.protocol !== "openai-compatible") throw new AccessError("默认 Provider 须使用 OpenAI 兼容协议（支持 DeepSeek）。", 409);
  return provider;
}

function chatUrl(baseUrl: string) {
  return modelListUrl(baseUrl, env.AI_MODEL_HOSTS).replace(/\/models$/, "/chat/completions");
}

async function quotaFor(userId: string, now: number) {
  const since = new Date(now - AI_GENERATION_LIMITS.dailySeconds * 1000).toISOString();
  const rows = await adminDb()
    .prepare("SELECT created_at, status FROM ai_question_jobs WHERE owner_id=? AND created_at>?")
    .bind(userId, since)
    .all<{ created_at: string; status: string }>();
  return evaluateQuota(rows.results.map((row) => ({ createdAt: row.created_at, status: row.status })), now);
}

function quotaPayload(decision: Awaited<ReturnType<typeof quotaFor>> | null) {
  return {
    windowSeconds: AI_GENERATION_LIMITS.windowSeconds,
    maxPerWindow: AI_GENERATION_LIMITS.maxPerWindow,
    maxPerDay: AI_GENERATION_LIMITS.maxPerDay,
    ...(decision ? { remaining: decision.remaining, dailyRemaining: decision.dailyRemaining } : {}),
  };
}

function jobId(userId: string, requestId: string) {
  return textHash(`${userId}|${requestId}`).then((hash) => `gen-${hash}`);
}

function replay(row: any, requestHash: string, userId: string) {
  if (row.request_hash !== requestHash) {
    return reply({ error: "该请求编号已用于不同内容，请刷新页面后重新提交。", retryable: true }, 409);
  }
  if (row.status === "pending") {
    const age = Date.now() - Date.parse(row.updated_at);
    if (age > AI_GENERATION_LIMITS.requestTimeoutSeconds * 1000) {
      return reply({ error: "上一次相同请求超时未完成，请重新提交。", retryable: true }, 409);
    }
    return reply({ error: "相同请求正在生成，请稍候再试。", retryable: true, retryAfterSeconds: 5 }, 409);
  }
  if (row.status === "succeeded" && row.result) {
    try {
      return {
        cached: true,
        items: JSON.parse(row.result),
        model: row.model,
        elapsedMs: row.elapsed_ms,
        generatedAt: row.created_at,
        reviewStatus: "pending",
        promptVersion: "ai-topic-v1",
      };
    } catch {
      return reply({ error: "历史生成结果无法读取，请重新提交。", retryable: true }, 503);
    }
  }
  return reply({ error: `该请求上次生成失败：${row.error || "未知原因"} 请重新提交。`, retryable: true, deduplicated: true }, 409);
}

export async function GET(request: Request) {
  try {
    principal(request);
    let ready = false;
    let model = "";
    let endpointHost = "";
    if (deepseekEnvReady()) {
      const config = deepseekFromEnv();
      ready = true;
      model = config.model;
      endpointHost = new URL(config.baseUrl).hostname;
    } else {
      try {
        const provider = await providerForExecution();
        modelListUrl(provider.baseUrl, env.AI_MODEL_HOSTS);
        ready = true;
        model = provider.model;
        endpointHost = new URL(provider.baseUrl).hostname;
      } catch {
        ready = false;
      }
    }
    return reply({
      ready,
      model,
      endpointHost,
      subjects: AI_SUBJECTS.map((subject) => ({
        id: subject,
        types: AI_TYPES[subject].map((type) => ({ id: type.id, label: type.label, counts: AI_COUNTS[type.id].options })),
      })),
      difficulties: AI_DIFFICULTIES,
      limits: {
        maxCountPerRequest: AI_GENERATION_LIMITS.maxCountPerRequest,
        maxPerWindow: AI_GENERATION_LIMITS.maxPerWindow,
        windowSeconds: AI_GENERATION_LIMITS.windowSeconds,
        maxPerDay: AI_GENERATION_LIMITS.maxPerDay,
      },
      message: ready ? "AI 专题出题已就绪" : "请在服务端配置 DEEPSEEK_API_KEY 与 DEEPSEEK_MODEL，或在管理后台选择 DeepSeek 官方默认模型。",
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  let inserted = false;
  let id = "";
  let userId = "";
  try {
    const user = principal(request);
    userId = user.id;
    sameOrigin(request);
    if (!request.headers.get("Content-Type")?.includes("application/json")) return reply({ error: "请使用 JSON 格式。" }, 415);
    let body: any;
    try {
      body = JSON.parse(await readLimitedText(request, 8000));
    } catch (error) {
      if (error instanceof AccessError) return fail(error);
      return reply({ error: "请求格式不正确。" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "请求格式不正确。" }, 400);
    if (typeof body.requestId !== "string" || !REQUEST_ID_PATTERN.test(body.requestId)) {
      return reply({ error: "缺少或无效的请求编号，请刷新页面后重试。", retryable: true }, 400);
    }
    const plan = generationPlan({
      subject: body.subject,
      topic: body.topic,
      difficulty: body.difficulty,
      type: body.type,
      count: body.count, focus: body.focus, words: body.words,
    });
    const requestHash = await textHash(JSON.stringify(plan));
    id = await jobId(user.id, body.requestId);
    const db = adminDb();
    const prior = await db.prepare("SELECT * FROM ai_question_jobs WHERE id=? AND owner_id=?").bind(id, user.id).first<any>();
    if (prior) {
      const cached = replay(prior, requestHash, user.id);
      if (cached instanceof Response) return cached;
      return reply({ ...cached, requestId: body.requestId, deduplicated: true, quota: quotaPayload(await quotaFor(user.id, Date.now())) });
    }

    const now = Date.now();
    const quota = await quotaFor(user.id, now);
    if (!quota.allowed) {
      return reply(
        {
          error: quotaMessage(quota),
          retryable: true,
          retryAfterSeconds: quota.retryAfterSeconds,
          limit: { ...quotaPayload(quota), reason: quota.reason },
        },
        429,
      );
    }

    const provider = await resolveProvider();
    let url: string;
    try {
      url = chatUrl(provider.baseUrl);
    } catch (error) {
      return reply({ error: (error as Error).message }, 409);
    }
    const stamp = new Date(now).toISOString();
    try {
      const result = await db
        .prepare("INSERT INTO ai_question_jobs(id,owner_id,request_hash,status,model,created_at,updated_at) VALUES(?,?,?,'pending',?,?,?)")
        .bind(id, user.id, requestHash, provider.model, stamp, stamp)
        .run();
      if (!result.meta.changes) {
        const concurrent = await db.prepare("SELECT * FROM ai_question_jobs WHERE id=? AND owner_id=?").bind(id, user.id).first<any>();
        if (concurrent) {
          const cached = replay(concurrent, requestHash, user.id);
          if (cached instanceof Response) return cached;
          return reply({ ...cached, requestId: body.requestId, deduplicated: true, quota: quotaPayload(quota) });
        }
        return reply({ error: "相同请求正在生成，请稍候再试。", retryable: true, retryAfterSeconds: 5 }, 409);
      }
    } catch {
      const concurrent = await db.prepare("SELECT * FROM ai_question_jobs WHERE id=? AND owner_id=?").bind(id, user.id).first<any>();
      if (concurrent) return reply({ error: "相同请求正在生成，请稍候再试。", retryable: true, retryAfterSeconds: 5 }, 409);
      return reply({ error: "无法创建出题任务，请稍后重试。", retryable: true }, 503);
    }
    inserted = true;

    let response: Response;
    try {
      response = await upstreamFetch(url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(90000),
        headers: { Authorization: "Bearer " + provider.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          response_format: { type: "json_object" },
          max_tokens: 4000,
          temperature: 0.6,
          ...(new URL(url).hostname === "api.deepseek.com" ? { thinking: { type: "disabled" } } : {}),
          messages: [
            { role: "system", content: promptFor(plan) },
            { role: "user", content: JSON.stringify({ subject: plan.subject, type: plan.type.id, topic: plan.topic, difficulty: plan.difficulty, count: plan.count }) },
          ],
        }),
      });
    } catch {
      const message = "连接 DeepSeek 失败或超时，本次未保存任何题目，可重试。";
      await finish(id, user.id, "failed", { error: message, elapsedMs: Date.now() - started });
      return reply({ error: message, retryable: true }, 502);
    }
    if (!response.ok) {
      const message = upstreamError(response.status) + " 本次未保存任何题目，可重试。";
      await finish(id, user.id, "failed", { error: message, elapsedMs: Date.now() - started });
      return reply({ error: message, retryable: true }, 502);
    }
    const upstream = (await response.json().catch(() => null)) as any;
    let items;
    try {
      const content = typeof upstream?.choices?.[0]?.message?.content === "string" ? upstream.choices[0].message.content : "";
      if (content.includes(provider.apiKey)) throw new BankContractError("响应包含不应出现的内容。");
      items = parseGeneration(content, plan);
    } catch (error) {
      const message = `${error instanceof BankContractError ? error.message : "模型返回格式不正确。"} 本次未保存任何题目，可重试。`;
      await finish(id, user.id, "failed", { error: message, elapsedMs: Date.now() - started });
      return reply({ error: message, retryable: true }, 502);
    }
    const elapsedMs = Date.now() - started;
    const generatedAt = new Date().toISOString();
    await finish(id, user.id, "succeeded", { result: JSON.stringify(items), elapsedMs, model: provider.model });
    return reply({
      items,
      model: provider.model,
      provider: provider.name,
      generatedAt,
      elapsedMs,
      reviewStatus: "pending",
      promptVersion: "ai-topic-v1",
      requestId: body.requestId,
      deduplicated: false,
      quota: quotaPayload(quota),
    });
  } catch (error) {
    if (inserted && id && userId) {
      await finish(id, userId, "failed", { error: "AI 出题未完成，请重试。", elapsedMs: Date.now() - started }).catch(() => undefined);
    }
    if (error instanceof BankContractError) return reply({ error: error.message }, 400);
    if (error instanceof AccessError) return fail(error);
    return reply({ error: "AI 出题未完成，本次未保存任何题目，可重试。", retryable: true }, 503);
  }
}

async function finish(id: string, userId: string, status: "succeeded" | "failed", data: { result?: string; error?: string; elapsedMs: number; model?: string }) {
  await adminDb()
    .prepare("UPDATE ai_question_jobs SET status=?, result=?, error=?, elapsed_ms=?, model=COALESCE(?,model), updated_at=? WHERE id=? AND owner_id=?")
    .bind(status, data.result ?? null, data.error ?? null, data.elapsedMs, data.model ?? null, new Date().toISOString(), id, userId)
    .run();
}
