import { getChatGPTUser } from "../../../chatgpt-auth";
import { storage } from "../../../../db/store";
import { AccessError, fail, privateHeaders, readLimitedText, sameOrigin } from "../../../../lib/user-access";

const pageSize=20;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const entryPattern=/^[a-zA-Z0-9_-]{1,100}$/;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const requireId=(value:unknown,pattern=uuid)=>{
  if(typeof value!=="string"||!pattern.test(value))throw new AccessError("编号无效。",400);
  return value;
};
const field=(value:unknown,max:number,required=true)=>{
  if(typeof value!=="string"||value.length>max||(required&&!value.trim()))throw new AccessError("请检查文字内容及长度。",400);
  return value.trim();
};
const notFound=()=>new AccessError("该内容不存在或已撤回。",404);
function pageOffset(value:string|null){
  if(value===null)return 0;
  if(!/^\d{1,5}$/.test(value)||Number(value)>10000)throw new AccessError("分页参数无效。",400);
  return Number(value);
}
type PublicationRow={id:string;topicId:string;title:string;content?:string;excerpt?:string;language:string|null;sourceLanguage:string|null;discipline:string|null;revision:number;updatedAt:string;sourceUpdatedAt:string;ownerId:string;entryId:string};
function view(row:PublicationRow,owner:string){
  const {ownerId,entryId,sourceUpdatedAt,...safe}=row;
  // A public note alias is scoped to the publication; no email or account id leaves the server.
  return {...safe,authorAlias:"研究者-"+row.id.slice(0,8),mine:ownerId===owner,...(ownerId===owner?{entryId,sourceUpdatedAt}:{})};
}
const baseColumns="id,topic_id AS topicId,title,language,source_language AS sourceLanguage,discipline,revision,updated_at AS updatedAt,source_updated_at AS sourceUpdatedAt,owner_id AS ownerId,entry_id AS entryId";

export async function GET(request:Request){
  try{
    const user=await getChatGPTUser();if(!user)throw new AccessError("请先登录。",401);
    const db=storage(), params=new URL(request.url).searchParams;
    const publication=params.get("publication"),topic=params.get("topic");
    if(publication!==null){
      const id=requireId(publication);
      const row=await db.prepare("SELECT "+baseColumns+",content FROM research_publications WHERE id=?").bind(id).first<PublicationRow>();
      if(!row)throw notFound();
      return json(view(row,user.userId));
    }
    const offset=pageOffset(params.get("offset"));
    if(topic!==null){
      const id=requireId(topic);
      const found=await db.prepare("SELECT id,title,description,created_at AS createdAt FROM research_topics WHERE id=?").bind(id).first();
      if(!found)throw notFound();
      const rows=await db.prepare("SELECT "+baseColumns+",substr(content,1,240) AS excerpt FROM research_publications WHERE topic_id=? ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?").bind(id,pageSize+1,offset).all<PublicationRow>();
      return json({topic:found,publications:rows.results.slice(0,pageSize).map(row=>view(row,user.userId)),nextOffset:rows.results.length>pageSize&&offset+pageSize<=10000?offset+pageSize:null});
    }
    const q=field(params.get("q")??"",100,false);
    const rows=await db.prepare("SELECT t.id,t.title,t.description,t.created_at AS createdAt,(SELECT count(*) FROM research_publications p WHERE p.topic_id=t.id) AS noteCount FROM research_topics t WHERE instr(lower(t.title||' '||t.description),lower(?))>0 ORDER BY t.created_at DESC,t.id DESC LIMIT ? OFFSET ?").bind(q,pageSize+1,offset).all();
    return json({topics:rows.results.slice(0,pageSize),nextOffset:rows.results.length>pageSize&&offset+pageSize<=10000?offset+pageSize:null});
  }catch(error){return fail(error,"研究社区暂时不可用。");}
}
export async function POST(request:Request){
  try{
    const user=await getChatGPTUser();if(!user)throw new AccessError("请先登录。",401);
    sameOrigin(request);
    let body:Record<string,unknown>;
    try{body=JSON.parse(await readLimitedText(request,16_000));}
    catch(error){if(error instanceof AccessError)throw error;throw new AccessError("提交格式无效。",400);}
    if(!body||typeof body!=="object"||Array.isArray(body))throw new AccessError("提交格式无效。",400);
    const db=storage(),now=new Date().toISOString();
    if(body.action==="createTopic"){
      const title=field(body.title,160),description=field(body.description??"",2000,false),id=crypto.randomUUID();
      const result=await db.prepare("INSERT INTO research_topics(id,owner_id,title,description,created_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM research_topics WHERE owner_id=?)<30").bind(id,user.userId,title,description,now,user.userId).run();
      if(!result.meta.changes)throw new AccessError("每个账号最多创建30个议题。",429);
      return json({id,title,description,createdAt:now,noteCount:0},201);
    }
    if(body.action==="publish"){
      const topicId=requireId(body.topicId),entryId=requireId(body.entryId,entryPattern),version=field(body.sourceUpdatedAt,64);
      if(!Number.isFinite(Date.parse(version)))throw new AccessError("请先保存并重新读取笔记。",400);
      if(body.confirm!==true)throw new AccessError("请确认公开当前已保存版本。",400);
      const topic=await db.prepare("SELECT id FROM research_topics WHERE id=?").bind(topicId).first();
      if(!topic)throw notFound();
      // INSERT SELECT copies only the authenticated owner's exact saved version.
      // The copy is separate from private entries, and an upsert cannot touch another author's row.
      const id=crypto.randomUUID();
      const result=await db.prepare("INSERT INTO research_publications(id,topic_id,owner_id,entry_id,title,content,language,source_language,discipline,source_updated_at,revision,created_at,updated_at) SELECT ?,?,e.user_id,e.id,e.title,e.content,e.language,e.source_language,e.discipline,e.updated_at,1,?,? FROM entries e WHERE e.user_id=? AND e.id=? AND e.updated_at=? AND length(trim(e.content))>0 AND EXISTS(SELECT 1 FROM research_topics WHERE id=?) AND ((SELECT count(*) FROM research_publications WHERE owner_id=?)<100 OR EXISTS(SELECT 1 FROM research_publications WHERE owner_id=? AND entry_id=? AND topic_id=?)) ON CONFLICT(owner_id,entry_id,topic_id) DO UPDATE SET title=excluded.title,content=excluded.content,language=excluded.language,source_language=excluded.source_language,discipline=excluded.discipline,source_updated_at=excluded.source_updated_at,revision=research_publications.revision+1,updated_at=excluded.updated_at").bind(id,topicId,now,now,user.userId,entryId,version,topicId,user.userId,user.userId,entryId,topicId).run();
      if(!result.meta.changes){
        const source=await db.prepare("SELECT updated_at AS updatedAt,content FROM entries WHERE user_id=? AND id=?").bind(user.userId,entryId).first<{updatedAt:string;content:string}>();
        if(!source)throw notFound();
        if(source.updatedAt!==version)throw new AccessError("笔记已变化，请重新读取并确认公开内容。",409);
        if(!source.content.trim())throw new AccessError("请先填写并保存笔记正文。",400);
        throw new AccessError("每个账号最多保留100条公开笔记。",429);
      }
      const row=await db.prepare("SELECT "+baseColumns+",content FROM research_publications WHERE owner_id=? AND entry_id=? AND topic_id=?").bind(user.userId,entryId,topicId).first<PublicationRow>();
      if(!row)throw notFound();
      return json(view(row,user.userId));
    }
    if(body.action==="withdraw"){
      const id=requireId(body.id);
      const result=await db.prepare("DELETE FROM research_publications WHERE id=? AND owner_id=?").bind(id,user.userId).run();
      if(!result.meta.changes)throw notFound();
      return json({ok:true});
    }
    throw new AccessError("未知操作。",400);
  }catch(error){return fail(error,"研究社区操作未完成，请重试。");}
}
