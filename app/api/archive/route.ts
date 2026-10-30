import {principal,owned,owns,AccessError,fail} from '../../../lib/user-access';
import {checkPrivateReferences} from '../../../lib/study-store';
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "../../../db/index";
import { archiveRecords } from "../../../db/schema";
import {textHash,validateStudyPayload} from "../../../lib/study-contracts";

export const dynamic = "force-dynamic";
const kinds = new Set(["packet", "oral-attempt", "written-attempt", "legacy-backup", "preset", "error-set", "review-attempt", "essay"]);
const schools = new Set(["pku", "speit", "thu", "ruc", "bfsu", "zju", "legacy"]);
const headers = {"Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff"};
const reply = (data: unknown, status = 200) => Response.json(data, {status, headers});
const metadata = (r: typeof archiveRecords.$inferSelect) => {
  const {payload,ownerId, ...meta} = r; return meta;
};

// Every private query is scoped to the verified Sites visitor identity.
export async function GET(request: Request) {
  try {
    const user=principal(request);
    const params = new URL(request.url).searchParams,id=params.get("id");
    const db = getDb();
    if (id) {
      if (!/^[a-zA-Z0-9_-]{1,90}$/.test(id)) return reply({error:"无效的档案编号"},400);
      const record = await db.select().from(archiveRecords).where(and(eq(archiveRecords.id,id),owned(archiveRecords.ownerId,user))).get();
      if(!record)return reply({error:"档案不存在"},404);
      const payload=JSON.parse(record.payload);
      return reply({...metadata(record),payload,...(record.kind==='essay'?{sourceHash:await textHash(payload.originalText||'')}:{})});
    }
    const conditions=[owned(archiveRecords.ownerId,user)];const kind=params.get('kind'),schoolId=params.get('schoolId'),query=params.get('q')?.slice(0,200);
    if(kind){if(!kinds.has(kind))return reply({error:'无效的档案类型'},400);conditions.push(eq(archiveRecords.kind,kind));}
    if(schoolId){if(!schools.has(schoolId))return reply({error:'无效的学校'},400);conditions.push(eq(archiveRecords.schoolId,schoolId));}
    if(query)conditions.push(or(like(archiveRecords.title,'%'+query+'%'),like(archiveRecords.payload,'%'+query+'%'))!);
    const records = await db.select({id:archiveRecords.id,kind:archiveRecords.kind,schoolId:archiveRecords.schoolId,title:archiveRecords.title,revision:archiveRecords.revision,createdAt:archiveRecords.createdAt,updatedAt:archiveRecords.updatedAt,subtype:sql<string>`json_extract(${archiveRecords.payload}, '$.kind')`}).from(archiveRecords).where(and(...conditions)).orderBy(desc(archiveRecords.updatedAt)).limit(500);
    return reply({records,limit:500});
  } catch(error) {
    return fail(error,"云端档案暂时无法读取，请稍后重试。");
  }
}

export async function POST(request: Request) {
  let user;try{user=principal(request);}catch(error){return fail(error);}
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const host = request.headers.get("Host") || url.host;
  try {
    if (request.headers.get("Sec-Fetch-Site") === "cross-site" || (origin && new URL(origin).host !== host && new URL(origin).host !== url.host)) return reply({error:"请从本站页面保存档案"},403);
  } catch {return reply({error:"无效的请求来源"},403);}
  if (!request.headers.get("Content-Type")?.includes("application/json")) return reply({error:"请使用 JSON 格式"},415);
  try {
    if (Number(request.headers.get("Content-Length")) > 1_000_000) return reply({error:"档案超过 1 MB，请分开保存"},413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1_000_000) return reply({error:"档案超过 1 MB，请分开保存"},413);
    let body;
    try {body = JSON.parse(raw);} catch {return reply({error:"档案格式不完整"},400);}
    const {id,kind,schoolId,title,payload,expectedRevision = 0} = body || {};
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,90}$/.test(id) || !kinds.has(kind) || !schools.has(schoolId) || typeof title !== "string" || !title.trim() || title.length > 180 || !payload || typeof payload !== "object" || Array.isArray(payload) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return reply({error:"档案字段不完整"},400);
    const db = getDb();
    const existing = await db.select().from(archiveRecords).where(eq(archiveRecords.id,id)).get();
    if(existing&&!owns(existing.ownerId,user))return reply({error:"档案不存在"},404);
    try{await checkPrivateReferences(kind,payload,user);validateStudyPayload(kind,payload,existing?JSON.parse(existing.payload):undefined);}catch(error){return reply({error:(error as Error).message},400);}
    const now = new Date().toISOString();
    if (existing) {
      if (expectedRevision !== existing.revision) return reply({error:"另一处已更新此档案，请重新打开后再保存。当前内容仍在页面中，可先导出。",revision:existing.revision},409);
      if (existing.kind !== kind || existing.schoolId !== schoolId) return reply({error:"请保留此档案的学校与类型，或另存新档案"},400);
      const updated = await db.update(archiveRecords).set({ownerId:user.id,title:title.trim(),payload:JSON.stringify(payload),updatedAt:now,revision:existing.revision+1}).where(and(eq(archiveRecords.id,id),eq(archiveRecords.revision,expectedRevision),owned(archiveRecords.ownerId,user))).returning().get();
      if (!updated) return reply({error:"档案刚刚在另一处更新，请重新打开后再保存"},409);
      return reply({record:metadata(updated)});
    }
    if (expectedRevision !== 0) return reply({error:"档案版本已变化，请另存新档案"},409);
    const record = await db.insert(archiveRecords).values({id,ownerId:user.id,kind,schoolId,title:title.trim(),payload:JSON.stringify(payload),createdAt:now,updatedAt:now,revision:1}).returning().get();
    return reply({record:metadata(record!)},201);
  } catch {
    return reply({error:"保存未完成，请重试或导出当前内容备份。"},503);
  }
}
