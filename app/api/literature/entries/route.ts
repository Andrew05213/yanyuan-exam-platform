import {getChatGPTUser} from "../../../chatgpt-auth";
import {storage} from "../../../../db/store";
import {folders,noteId,validEntry,type Entry} from "../../../literature/notes";
import {AccessError,fail,privateHeaders,readLimitedText,sameOrigin} from "../../../../lib/user-access";

const columns="id,work_id AS workId,title,content,status,tags,locator,review_on AS reviewOn,updated_at,revision,folder,language,source_language AS sourceLanguage,discipline";
const insert="INSERT INTO entries(user_id,id,title,content,status,updated_at,work_id,tags,locator,review_on,language,source_language,discipline,folder) VALUES(?,?,?,?,?,?,?,?,?,?,NULLIF(?,''),NULLIF(?,''),NULLIF(?,''),?) ON CONFLICT(user_id,id) DO NOTHING";
const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{...privateHeaders,...headers}});

async function userId() {
  const user=await getChatGPTUser();
  if(!user)throw new AccessError("请先登录",401);
  return user.userId;
}

async function body(request:Request,max:number) {
  sameOrigin(request);
  try{return JSON.parse(await readLimitedText(request,max));}
  catch(error){if(error instanceof AccessError)throw error;throw new AccessError("请检查笔记数据格式。",400);}
}

function fields(entry:Entry,stamp:string) {
  return [entry.title.trim(),entry.content,entry.status,stamp,
    entry.workId??(entry.id.startsWith("note_")?("workId" in entry?"":null):entry.id),
    entry.tags??null,entry.locator??null,entry.reviewOn??null,
    ...[entry.language,entry.sourceLanguage,entry.discipline].map(value=>value===undefined?null:value?.trim()??"")];
}

async function changed(owner:string,id:string) {
  const current=await storage().prepare("SELECT "+columns+" FROM entries WHERE user_id=? AND id=?").bind(owner,id).first<Entry>();
  return reply({error:"云端笔记已更新。你的修改仍保存在草稿中。",current},409);
}

export async function GET() {
  try {
    const owner=await userId();
    const rows=await storage().prepare("SELECT "+columns+" FROM entries WHERE user_id=? ORDER BY updated_at DESC").bind(owner).all<Entry>();
    return reply(rows.results,200,{"X-Draft-Owner":encodeURIComponent(owner)});
  }catch(error){return fail(error,"暂时无法读取笔记");}
}

export async function PUT(request:Request) {
  try {
    const owner=await userId();
    const entry=await body(request,650_000);
    if(!validEntry(entry))throw new AccessError("请检查笔记格式与长度。",400);
    const revision=entry.revision??0;
    if(!Number.isSafeInteger(revision)||revision<0)throw new AccessError("笔记版本无效，请重新读取。",400);
    const stamp=new Date().toISOString(),db=storage();
    const result=revision===0
      ? await db.prepare(insert+" RETURNING "+columns).bind(owner,entry.id,...fields(entry,stamp),"active").first<Entry>()
      : await db.prepare("UPDATE entries SET title=?,content=?,status=?,updated_at=?,work_id=COALESCE(?,work_id),tags=COALESCE(?,tags),locator=COALESCE(?,locator),review_on=COALESCE(?,review_on),language=NULLIF(COALESCE(?,language),''),source_language=NULLIF(COALESCE(?,source_language),''),discipline=NULLIF(COALESCE(?,discipline),''),revision=revision+1 WHERE user_id=? AND id=? AND revision=? AND folder='active' RETURNING "+columns)
        .bind(...fields(entry,stamp),owner,entry.id,revision).first<Entry>();
    if(!result)return await changed(owner,entry.id);
    return reply({ok:true,changed:1,updated_at:result.updated_at,entry:result});
  }catch(error){return fail(error,"保存失败。请保留草稿后重试。");}
}

export async function POST(request:Request) {
  try {
    const owner=await userId(),payload=await body(request,24_500_000),entries=payload?.entries as unknown;
    if(!Array.isArray(entries)||!entries.length||entries.length>40||!entries.every(validEntry))throw new AccessError("请检查备份格式与长度。",400);
    const db=storage(),stamp=new Date().toISOString();
    const results=await db.batch(entries.map(entry=>{
      const date=entry.updated_at&&Number.isFinite(Date.parse(entry.updated_at))?new Date(entry.updated_at).toISOString():stamp;
      return db.prepare(insert).bind(owner,entry.id,...fields(entry,date),entry.folder??"active");
    }));
    return reply({ok:true,updated_at:stamp,changed:results.reduce((n,result)=>n+result.meta.changes,0)});
  }catch(error){return fail(error,"导入笔记失败，请重试。");}
}

export async function PATCH(request:Request) {
  try {
    const owner=await userId(),payload=await body(request,1024);
    const {id,revision,folder}=payload??{};
    if(!noteId(id)||!Number.isSafeInteger(revision)||revision<1||!folders.includes(folder))throw new AccessError("笔记操作无效。",400);
    const result=await storage().prepare(
      "UPDATE entries SET folder=?,revision=revision+1 WHERE user_id=? AND id=? AND revision=? AND folder<>? AND (?<>'archived' OR folder='active') RETURNING "+columns
    ).bind(folder,owner,id,revision,folder,folder).first<Entry>();
    return result?reply({ok:true,entry:result}):await changed(owner,id);
  }catch(error){return fail(error,"移动笔记失败，请重试。");}
}
