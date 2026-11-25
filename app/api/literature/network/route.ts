import {getChatGPTUser} from "../../../chatgpt-auth";
import {storage} from "../../../../db/store";
import {AccessError,fail,privateHeaders,readLimitedText,sameOrigin} from "../../../../lib/user-access";
import {visible,viewer,publicationVisible,publicationViewer,referenceVisible} from "../../../../lib/research-community";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const notFound=()=>new AccessError("内容不存在或不可访问。",404);
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
function id(value:unknown){if(typeof value!=="string"||!uuid.test(value))throw new AccessError("编号无效。",400);return value;}
function revision(value:unknown){if(typeof value!=="number"||!Number.isSafeInteger(value)||value<1)throw new AccessError("版本编号无效。",400);return value;}
function field(value:unknown,max:number,required=false){if(typeof value!=="string"||value.length>max||(required&&!value.trim()))throw new AccessError("请检查文字及长度。",400);return value.trim();}
function offset(value:string|null){if(value===null)return 0;if(!/^\d{1,5}$/.test(value)||Number(value)>10000)throw new AccessError("分页参数无效。",400);return Number(value);}
type Pub={id:string;topicId:string;ownerId:string;revision:number;title:string;content:string;language:string|null;discipline:string|null};
async function publication(db:ReturnType<typeof storage>,pid:string,user:string){
 const row=await db.prepare("SELECT id,topic_id AS topicId,owner_id AS ownerId,revision,title,content,language,discipline FROM research_publications p WHERE id=? AND "+publicationVisible("p")).bind(pid,...publicationViewer(user)).first<Pub>();
 if(!row)throw notFound();return row;
}
async function topic(db:ReturnType<typeof storage>,tid:string,user:string){
 if(!await db.prepare("SELECT id FROM research_topics t WHERE id=? AND "+visible("t","topic")).bind(tid,...viewer(user)).first())throw notFound();
}
type LinkRow={id:string;sourceId:string;targetId:string;sourceRevision:number;targetRevision:number;kind:string;sourceTitle:string;targetTitle:string;sourceCurrent:number;targetCurrent:number;ownerId:string};
type ReferenceRow={id:string;ownerId:string;title:string;authors:string;year:string;identifier:string;createdAt:string};
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)throw new AccessError("请先登录。",401);
  const uid=user.userId,db=storage(),params=new URL(request.url).searchParams,o=offset(params.get("offset"));
  if(params.has("compare")){
   const tid=id(params.get("topic")),ids=(params.get("compare")||"").split(",").map(id);
   if(ids.length<2||ids.length>3||new Set(ids).size!==ids.length)throw new AccessError("请选择2至3篇不同的笔记。",400);
   await topic(db,tid,uid);
   const rows=await Promise.all(ids.map(pid=>publication(db,pid,uid)));
   if(rows.some(p=>p.topicId!==tid))throw notFound();
   return json({notes:rows.map(({ownerId,...p})=>({...p,mine:ownerId===uid,authorAlias:"研究者-"+p.id.slice(0,8)}))});
  }
  if(params.has("publication")){
   const p=await publication(db,id(params.get("publication")),uid);
   const rows=await db.prepare("SELECT l.id,l.source_id AS sourceId,l.target_id AS targetId,l.source_revision AS sourceRevision,l.target_revision AS targetRevision,l.kind,s.title AS sourceTitle,t.title AS targetTitle,s.revision AS sourceCurrent,t.revision AS targetCurrent,s.owner_id AS ownerId FROM research_links l JOIN research_publications s ON s.id=l.source_id JOIN research_publications t ON t.id=l.target_id WHERE (l.source_id=? OR l.target_id=?) AND "+publicationVisible("s")+" AND "+publicationVisible("t")+" ORDER BY l.created_at DESC,l.id DESC LIMIT 21 OFFSET ?").bind(p.id,p.id,...publicationViewer(uid),...publicationViewer(uid),o).all<LinkRow>();
   return json({links:rows.results.slice(0,20).map(({ownerId,...row})=>({...row,mine:ownerId===uid,direction:row.sourceId===p.id?"outgoing":"incoming",stale:row.sourceRevision!==row.sourceCurrent||row.targetRevision!==row.targetCurrent})),nextOffset:rows.results.length>20?o+20:null});
  }
  const tid=id(params.get("topic"));await topic(db,tid,uid);
  const q=field(params.get("q")??"",100);
  const rows=await db.prepare("SELECT r.id,r.owner_id AS ownerId,r.title,r.authors,r.year,r.identifier,r.created_at AS createdAt FROM research_references r WHERE r.topic_id=? AND instr(lower(r.title||' '||r.authors||' '||r.identifier),lower(?))>0 AND "+referenceVisible("r")+" ORDER BY r.created_at DESC,r.id DESC LIMIT 21 OFFSET ?").bind(tid,q,...publicationViewer(uid),o).all<ReferenceRow>();
  return json({references:rows.results.slice(0,20).map(({ownerId,...row})=>({...row,mine:ownerId===uid})),nextOffset:rows.results.length>20?o+20:null});
 }catch(e){return fail(e,"知识协作数据暂不可用。");}
}
export async function POST(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)throw new AccessError("请先登录。",401);
  sameOrigin(request);
  let body:Record<string,unknown>;
  try{body=JSON.parse(await readLimitedText(request,16000));}catch(e){if(e instanceof AccessError)throw e;throw new AccessError("提交格式无效。",400);}
  if(!body||typeof body!=="object"||Array.isArray(body))throw new AccessError("提交格式无效。",400);
  const uid=user.userId,db=storage(),now=new Date().toISOString(),newId=crypto.randomUUID();
  if(body.action==="link"){
   const sid=id(body.sourceId),tid=id(body.targetId),sr=revision(body.sourceRevision),tr=revision(body.targetRevision),kind=body.kind;
   if(sid===tid||(kind!=="citation"&&kind!=="derivative"))throw new AccessError("引用关系无效。",400);
   const result=await db.prepare("INSERT INTO research_links(id,source_id,target_id,source_revision,target_revision,kind,created_at) SELECT ?,s.id,t.id,s.revision,t.revision,?,? FROM research_publications s JOIN research_publications t ON t.topic_id=s.topic_id WHERE s.id=? AND t.id=? AND s.owner_id=? AND s.revision=? AND t.revision=? AND "+publicationVisible("s")+" AND "+publicationVisible("t")+" AND (SELECT count(*) FROM research_links WHERE source_id=s.id)<100 ON CONFLICT(source_id,target_id,source_revision,target_revision,kind) DO NOTHING").bind(newId,kind,now,sid,tid,uid,sr,tr,...publicationViewer(uid),...publicationViewer(uid)).run();
   if(!result.meta.changes)throw new AccessError("仅可从自己的当前公开笔记关联同议题可见版本；可能已关联、版本变化或达到上限。",409);
   return json({id:newId},201);
  }
  if(body.action==="unlink"){
   const result=await db.prepare("DELETE FROM research_links WHERE id=? AND EXISTS(SELECT 1 FROM research_publications p WHERE p.id=research_links.source_id AND p.owner_id=?)").bind(id(body.id),uid).run();
   if(!result.meta.changes)throw notFound();return json({ok:true});
  }
  if(body.action==="addReference"){
   const tid=id(body.topicId),title=field(body.title,240,true),authors=field(body.authors??"",240),year=field(body.year??"",32),identifier=field(body.identifier??"",500);
   // Bibliographic identifiers are plain text, never executable links or uploaded documents.
   const result=await db.prepare("INSERT INTO research_references(id,topic_id,owner_id,title,authors,year,identifier,created_at) SELECT ?,t.id,?,?,?,?,?,? FROM research_topics t WHERE t.id=? AND "+visible("t","topic")+" AND (SELECT count(*) FROM research_references WHERE owner_id=?)<100 AND (SELECT count(*) FROM research_references WHERE topic_id=t.id)<500").bind(newId,uid,title,authors,year,identifier,now,tid,...viewer(uid),uid).run();
   if(!result.meta.changes)throw new AccessError("议题不可访问或文献数量达到上限。",409);return json({id:newId},201);
  }
  if(body.action==="removeReference"){
   const result=await db.prepare("DELETE FROM research_references WHERE id=? AND owner_id=?").bind(id(body.id),uid).run();
   if(!result.meta.changes)throw notFound();return json({ok:true});
  }
  throw new AccessError("未知操作。",400);
 }catch(e){return fail(e,"知识协作操作未完成。");}
}
