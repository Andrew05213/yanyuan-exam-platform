import { getChatGPTUser } from "../../../chatgpt-auth";
import { storage } from "../../../../db/store";
import { mergeMaterials, validMaterialId, validateMaterial, type MaterialRow } from "../../../literature/materials";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  try {
    const result = await storage().prepare("SELECT id, data, deleted FROM materials WHERE user_id = ? ORDER BY updated_at ASC, id ASC").bind(user.userId).all();
    return Response.json(mergeMaterials(result.results as MaterialRow[]), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "暂时无法读取文学资料，请稍后重试" }, { status: 503 });
  }
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!allowedOrigin(request)) return Response.json({ error: "请求被拒绝" }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "无效内容" }, { status: 400 }); }
  const material = validateMaterial(input);
  if (!material) return Response.json({ error: "请检查必填内容、字段长度和参考链接" }, { status: 400 });
  try {
    await storage().prepare("INSERT INTO materials (user_id,id,data,deleted,updated_at) VALUES (?,?,?,0,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data,deleted=0,updated_at=excluded.updated_at")
      .bind(user.userId, material.id, JSON.stringify(material), new Date().toISOString()).run();
    return Response.json(material);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "保存失败，输入仍保留，请重试" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!allowedOrigin(request)) return Response.json({ error: "请求被拒绝" }, { status: 403 });
  let input: { id?: unknown } | null;
  try { input = await request.json() as { id?: unknown } | null; } catch { return Response.json({ error: "无效内容" }, { status: 400 }); }
  if (!validMaterialId(input?.id)) return Response.json({ error: "无效资料" }, { status: 400 });
  try {
    await storage().prepare("INSERT INTO materials (user_id,id,data,deleted,updated_at) VALUES (?,?,'{}',1,?) ON CONFLICT(user_id,id) DO UPDATE SET deleted=1,updated_at=excluded.updated_at")
      .bind(user.userId, input.id, new Date().toISOString()).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "删除失败，请重试" }, { status: 503 });
  }
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"请先登录"},{status:401});
  if(!allowedOrigin(request))return Response.json({error:"来源不匹配"},{status:403});
  const body=await request.json().catch(()=>null) as {materials?:unknown[]}|null;
  if(!Array.isArray(body?.materials)||!body.materials.length||body.materials.length>40)return Response.json({error:"资料包格式不正确"},{status:400});
  const rows=body.materials.map(validateMaterial);
  if(!rows.every(row=>row!==null))return Response.json({error:"资料字段不正确"},{status:400});
  try{
    const db=storage(),now=new Date().toISOString();
    const result=await db.batch(rows.map(row=>db.prepare("INSERT INTO materials(user_id,id,data,deleted,updated_at) VALUES(?,?,?,0,?) ON CONFLICT(user_id,id) DO NOTHING").bind(user.userId,row.id,JSON.stringify(row),now)));
    return Response.json({changed:result.reduce((n,r)=>n+r.meta.changes,0)});
  }catch{return Response.json({error:"恢复中断，请重试"},{status:503});}
}
