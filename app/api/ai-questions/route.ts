import { principal, sameOrigin, fail, AccessError, privateHeaders, readLimitedText } from "../../../lib/user-access";
import { adminDb } from "../../../lib/admin-access";
import { runStudyAI, studyAIProvider } from "../../../lib/study-ai";
import { textHash } from "../../../lib/study-contracts";
import {groundSelection,loadGroundSources,modelGroundSources,groundFingerprint} from "../../../lib/grounded-question-sources";
import {groundedPrompt,parseGroundedGeneration} from "../../../lib/grounded-question-generation";
import { AI_DIFFICULTIES, AI_SUBJECTS, BankContractError } from "../../../lib/question-bank-contracts";
import {
  AI_COUNTS,
  AI_TYPES,
  generationPlan,
  parseGeneration,
  promptFor,
} from "../../../lib/ai-question-generation";
import {
  AI_GENERATION_LIMITS,
  REQUEST_ID_PATTERN,
  evaluateQuota,
  quotaMessage,
} from "../../../lib/ai-question-limits";

export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: privateHeaders });

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

function replay(row: any, requestHash: string) {
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
        promptVersion: JSON.parse(row.result).some((item:any)=>item.sourceJobId)?"grounded-v1":"ai-topic-v1",
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
    try {
      const {provider,url} = await studyAIProvider();
      ready = true;
      model = provider.model;
      endpointHost = new URL(url).hostname;
    } catch { /* The status endpoint remains usable without a default Provider. */ }
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
      message: ready ? "AI 专题出题已就绪" : "请管理员在后台配置默认 Provider 和模型。",
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
    const selection=body.ground!==undefined?groundSelection(body.ground):null;
    if(body.action==="preview"&&!selection)return reply({error:"请选择材料。"},400);
    const sources=selection?await loadGroundSources(request,user.id,selection):null;
    const groundTarget=selection?await studyAIProvider():null;
    const destination=groundTarget?{host:new URL(groundTarget.url).hostname,model:groundTarget.provider.model}:null;
    const fingerprint=groundTarget&&sources?await groundFingerprint({user:user.id,plan,selection,sources,provider:groundTarget.provider.id,revision:groundTarget.provider.revision,destination}):null;
    if(body.action==="preview")return reply({sources,plan,destination,fingerprint});
    if(selection&&(body.confirm!==true||body.fingerprint!==fingerprint))return reply({error:"材料、题型或模型配置已变化，请重新预览并确认。"},409);
    const requestHash = await textHash(JSON.stringify(selection?{plan,fingerprint}:plan));
    id = await jobId(user.id, body.requestId);
    const db = adminDb();
    const prior = await db.prepare("SELECT * FROM ai_question_jobs WHERE id=? AND owner_id=?").bind(id, user.id).first<any>();
    if (prior) {
      const cached = replay(prior, requestHash);
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

    const target = groundTarget||await studyAIProvider();
    const {provider} = target;
    const stamp = new Date(now).toISOString();
    try {
      const result = await db
        .prepare("INSERT INTO ai_question_jobs(id,owner_id,request_hash,status,model,created_at,updated_at) VALUES(?,?,?,'pending',?,?,?)")
        .bind(id, user.id, requestHash, provider.model, stamp, stamp)
        .run();
      if (!result.meta.changes) {
        const concurrent = await db.prepare("SELECT * FROM ai_question_jobs WHERE id=? AND owner_id=?").bind(id, user.id).first<any>();
        if (concurrent) {
          const cached = replay(concurrent, requestHash);
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

    const items = await runStudyAI(target,user,id,"question-generation",[
      {role:"system",content:sources?groundedPrompt(promptFor(plan)):promptFor(plan)},
      {role:"user",content:JSON.stringify({subject:plan.subject,type:plan.type.id,topic:plan.topic,difficulty:plan.difficulty,count:plan.count,...(sources?{sources:modelGroundSources(sources)}:{})})},
    ],text => sources?parseGroundedGeneration(text,plan,sources,id):parseGeneration(text,plan),{
      since:new Date(now-AI_GENERATION_LIMITS.dailySeconds*1000).toISOString(),
      limit:AI_GENERATION_LIMITS.maxPerDay,
    });
    if(selection&&sources){const current=await loadGroundSources(request,user.id,selection);if(await groundFingerprint(current)!==await groundFingerprint(sources))throw new AccessError("生成期间材料已变化，请重新预览。",409);}
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
      promptVersion: sources?"grounded-v1":"ai-topic-v1",
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
