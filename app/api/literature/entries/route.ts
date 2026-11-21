import { getChatGPTUser } from "../../../chatgpt-auth";
import { storage } from "../../../../db/store";
import { validEntry, type Entry } from "../../../literature/notes";

const fail=(error:string,status:number)=>Response.json({error},{status});
export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return fail("请先登录",401);
  try{
    const rows=await storage().prepare("SELECT id,work_id AS workId,title,content,status,tags,locator,review_on AS reviewOn,updated_at FROM entries WHERE user_id=? ORDER BY updated_at DESC").bind(user.userId).all();
    return Response.json(rows.results,{headers:{"Cache-Control":"private, no-store","X-Draft-Owner":encodeURIComponent(user.userId)}});
  }catch{return fail("暂时无法读取笔记",503);}
}
const insert="INSERT INTO entries(user_id,id,title,content,status,updated_at,work_id,tags,locator,review_on) VALUES(?,?,?,?,?,?,?,?,?,?)";
async function write(request:Request, importing:boolean){
  const user=await getChatGPTUser();
  if(!user)return fail("请先登录",401);
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return fail("来源不匹配",403);
  const body=await request.json().catch(()=>null);
  const rows:unknown=importing?(body as {entries?:unknown}|null)?.entries:[body];
  if(!Array.isArray(rows)||!rows.length||rows.length>40||!rows.every(validEntry))return fail("请检查笔记格式与长度",400);
  const updated_at=new Date().toISOString();
  const sql=insert+(importing?" ON CONFLICT(user_id,id) DO NOTHING":" ON CONFLICT(user_id,id) DO UPDATE SET title=excluded.title,content=excluded.content,status=excluded.status,updated_at=excluded.updated_at,work_id=COALESCE(excluded.work_id,entries.work_id),tags=COALESCE(excluded.tags,entries.tags),locator=COALESCE(excluded.locator,entries.locator),review_on=COALESCE(excluded.review_on,entries.review_on)");
  try{
    const db=storage();
    const batch=rows.map(e=>{
      const time=importing&&e.updated_at&&Number.isFinite(Date.parse(e.updated_at))?new Date(e.updated_at).toISOString():updated_at;
      return db.prepare(sql).bind(user.userId,e.id,e.title.trim(),e.content,e.status,time,e.workId??(e.id.startsWith("note_")?("workId" in e?"":null):e.id),e.tags??null,e.locator??null,e.reviewOn??null);
    });
    const results=await db.batch(batch);
    return Response.json({ok:true,updated_at,changed:results.reduce((n,r)=>n+r.meta.changes,0)});
  }catch{return fail("保存失败。请保留草稿或备份文件后重试。",503);}
}
export const PUT=(request:Request)=>write(request,false);
export const POST=(request:Request)=>write(request,true);
