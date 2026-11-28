import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db/index";
import { questionBank } from "../../../db/schema";
import { principal, sameOrigin, fail, AccessError, privateHeaders, readLimitedText } from "../../../lib/user-access";
import {adminDb} from "../../../lib/admin-access";
import {verifySavedGroundEvidence} from "../../../lib/grounded-question-sources";
import { BankContractError, AI_SUBJECTS, validateBankItem, parseStoredItem } from "../../../lib/question-bank-contracts";

export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: privateHeaders });

function present(row: typeof questionBank.$inferSelect) {
  return {
    id: row.id,
    subject: row.subject,
    section: row.section,
    difficulty: row.difficulty,
    source: row.source,
    reviewStatus: row.reviewStatus,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    item: (() => {
      try {
        return parseStoredItem(row.payload);
      } catch {
        return null;
      }
    })(),
  };
}

export async function GET(request: Request) {
  try {
    const user = principal(request);
    const params = new URL(request.url).searchParams;
    const subject = params.get("subject");
    if (subject && !AI_SUBJECTS.includes(subject as (typeof AI_SUBJECTS)[number])) return reply({ error: "科目不正确。" }, 400);
    const conditions = [eq(questionBank.ownerId, user.id)];
    if (subject) conditions.push(eq(questionBank.subject, subject));
    const rows = await getDb()
      .select()
      .from(questionBank)
      .where(and(...conditions))
      .orderBy(desc(questionBank.updatedAt), desc(questionBank.id))
      .limit(300);
    const items = rows.map(present);
    return reply({ items, total: items.length, invalid: items.filter((entry) => !entry.item).length });
  } catch (error) {
    return fail(error, "暂时无法读取个人题库，请稍后重试。");
  }
}

export async function POST(request: Request) {
  try {
    const user = principal(request);
    sameOrigin(request);
    if (!request.headers.get("Content-Type")?.includes("application/json")) return reply({ error: "请使用 JSON 格式。" }, 415);
    const raw = await readLimitedText(request, 400000);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "题库请求格式不正确。" }, 400);
    }
    const list = (body as { items?: unknown })?.items;
    if (!Array.isArray(list) || !list.length || list.length > 20) return reply({ error: "每次保存 1 至 20 组题目。" }, 400);
    const items = list.map((entry) => validateBankItem(entry));
    const jobs=new Map<string,any[]>(),groundEvidence:Parameters<typeof verifySavedGroundEvidence>[2]=[];
    for(const item of items){if(!item.sourceJobId)continue;
      let generated=jobs.get(item.sourceJobId);
      if(!generated){const row=await adminDb().prepare("SELECT result FROM ai_question_jobs WHERE id=? AND owner_id=? AND status='succeeded'").bind(item.sourceJobId,user.id).first<{result:string}>();if(!row)throw new AccessError("材料出题记录不存在。",404);generated=JSON.parse(row.result) as any[];jobs.set(item.sourceJobId,generated);}
      const original=generated.find(x=>x.id===item.id);
      if(!original||JSON.stringify(validateBankItem(original))!==JSON.stringify(item))throw new AccessError("材料出题结果与原始生成记录不一致。",409);
      groundEvidence.push(...item.questions.flatMap(q=>q.evidence||[]));
    }
    await verifySavedGroundEvidence(request,user.id,groundEvidence);
    const db = getDb();
    const ids = items.map((item) => item.id);
    const conflicts = await db
      .select({ id: questionBank.id, ownerId: questionBank.ownerId })
      .from(questionBank)
      .where(inArray(questionBank.id, ids));
    const foreign = conflicts.filter((row) => row.ownerId !== user.id);
    if (foreign.length) return reply({ error: "部分题目编号已被其他账户占用，请重新生成。" }, 409);
    const now = new Date().toISOString();
    const batch = items.map((item) =>
      db
        .insert(questionBank)
        .values({
          id: item.id,
          ownerId: user.id,
          subject: item.subject,
          section: item.section,
          difficulty: item.difficulty,
          source: "ai",
          reviewStatus: "pending",
          payload: JSON.stringify(item),
          revision: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: questionBank.id,
          set: { payload: JSON.stringify(item), updatedAt: now, revision: sql`${questionBank.revision} + 1` },
          setWhere: eq(questionBank.ownerId, user.id),
        }),
    );
    await db.batch(batch as unknown as Parameters<typeof db.batch>[0]);
    const saved = await db
      .select({ id: questionBank.id, revision: questionBank.revision, updatedAt: questionBank.updatedAt })
      .from(questionBank)
      .where(eq(questionBank.ownerId, user.id));
    const mine = new Map(saved.map((row) => [row.id, row]));
    return reply({ ok: true, saved: items.map((item) => ({ id: item.id, revision: mine.get(item.id)?.revision ?? 1 })) }, 201);
  } catch (error) {
    if (error instanceof BankContractError) return reply({ error: error.message }, 400);
    if (error instanceof AccessError) return fail(error);
    return reply({ error: "保存到个人题库未完成，请重试。" }, 503);
  }
}

export async function PUT(request: Request) {
  try {
    const user = principal(request);
    sameOrigin(request);
    const body = JSON.parse(await readLimitedText(request, 4000)) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^ai-[a-f0-9-]{36}$/.test(id)) return reply({ error: "题库编号不正确。" }, 400);
    if (!Number.isSafeInteger(body.expectedRevision)) return reply({ error: "请刷新后重试。" }, 400);
    if (body.reviewStatus !== "approved" && body.reviewStatus !== "pending") return reply({ error: "审核状态不正确。" }, 400);
    const now = new Date().toISOString();
    const updated = await getDb()
      .update(questionBank)
      .set({ reviewStatus: body.reviewStatus, updatedAt: now, revision: (body.expectedRevision as number) + 1 })
      .where(and(eq(questionBank.id, id), eq(questionBank.ownerId, user.id), eq(questionBank.revision, body.expectedRevision as number)))
      .returning({ id: questionBank.id, reviewStatus: questionBank.reviewStatus, revision: questionBank.revision })
      .get();
    if (!updated) return reply({ error: "题库条目已在另一处更新，请刷新后重试。" }, 409);
    return reply({ ok: true, ...updated });
  } catch (error) {
    if (error instanceof AccessError) return fail(error);
    return reply({ error: "更新题库失败，请重试。" }, 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = principal(request);
    sameOrigin(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("id") || "";
    const revision = Number(params.get("revision"));
    if (!/^ai-[a-f0-9-]{36}$/.test(id)) return reply({ error: "题库编号不正确。" }, 400);
    if (!Number.isSafeInteger(revision)) return reply({ error: "请刷新后重试。" }, 400);
    const deleted = await getDb()
      .delete(questionBank)
      .where(and(eq(questionBank.id, id), eq(questionBank.ownerId, user.id), eq(questionBank.revision, revision)))
      .returning({ id: questionBank.id })
      .get();
    if (!deleted) return reply({ error: "题库条目已变化，请刷新后重试。" }, 409);
    return reply({ ok: true, id: deleted.id });
  } catch (error) {
    if (error instanceof AccessError) return fail(error);
    return reply({ error: "删除题库条目失败，请重试。" }, 503);
  }
}
