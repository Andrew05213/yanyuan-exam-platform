import {requireResearchCommunity} from "../../../../lib/research-access";
import {getChatGPTUser} from "../../../chatgpt-auth";
import {storage} from "../../../../db/store";
import {isAdmin,adminPrincipal} from "../../../../lib/admin-access";
import {AccessError,fail,privateHeaders,readLimitedText,sameOrigin} from "../../../../lib/user-access";
import {visible,viewer,publicationVisible,publicationViewer,referenceVisible,paragraphs,type TargetKind} from "../../../../lib/research-community";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const notFound=()=>new AccessError("内容不存在、已撤回或不可访问。",404);
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
function id(value:unknown){if(typeof value!=="string"||!uuid.test(value))throw new AccessError("编号无效。",400);return value;}
function number(value:unknown,max=100000){if(typeof value!=="number"||!Number.isInteger(value)||value<0||value>max)throw new AccessError("版本或段落编号无效。",400);return value;}
function text(value:unknown,max:number){if(typeof value!=="string"||!value.trim()||value.length>max)throw new AccessError("请检查文字及长度。",400);return value.trim();}
function kind(value:unknown):TargetKind{if(value!=="topic"&&value!=="publication"&&value!=="annotation"&&value!=="reply"&&value!=="reference")throw new AccessError("对象类型无效。",400);return value;}
type Pub={id:string;ownerId:string;revision:number;content:string;title:string};
type Target={id:string;ownerId:string;revision:number;body:string};
type Thread={id:string;ownerId:string;revision:number;paragraphIndex:number;quote:string;body:string;createdAt:string};
type Reply={id:string;ownerId:string;body:string;createdAt:string};
const alias=(value:string)=>"研究者-"+value.slice(0,8);
const tableFor={topic:"research_topics",publication:"research_publications",annotation:"research_annotations",reply:"research_replies",reference:"research_references"} as const;
async function publication(db:ReturnType<typeof storage>,pid:string,user:string){
 const row=await db.prepare("SELECT id,owner_id AS ownerId,revision,content,title FROM research_publications p WHERE id=? AND "+publicationVisible("p")).bind(pid,...publicationViewer(user)).first<Pub>();
 if(!row)throw notFound();return row;
}
async function target(db:ReturnType<typeof storage>,k:TargetKind,targetId:string,user:string):Promise<Target>{
 let row:Target|null;
 if(k==="topic")row=await db.prepare("SELECT id,owner_id AS ownerId,0 AS revision,title||char(10)||description AS body FROM research_topics t WHERE id=? AND "+visible("t","topic")).bind(targetId,...viewer(user)).first<Target>();
 else if(k==="publication"){
  const p=await publication(db,targetId,user);row={id:p.id,ownerId:p.ownerId,revision:p.revision,body:p.title+"\n"+p.content};
 }else if(k==="annotation")row=await db.prepare("SELECT a.id,a.owner_id AS ownerId,a.revision,a.body FROM research_annotations a JOIN research_publications p ON p.id=a.publication_id AND p.revision=a.revision WHERE a.id=? AND "+visible("a","annotation")+" AND "+publicationVisible("p")).bind(targetId,...viewer(user),...publicationViewer(user)).first<Target>();
 else if(k==="reference")row=await db.prepare("SELECT r.id,r.owner_id AS ownerId,0 AS revision,r.title||char(10)||r.authors||char(10)||r.year||char(10)||r.identifier AS body FROM research_references r WHERE r.id=? AND "+referenceVisible("r")).bind(targetId,...publicationViewer(user)).first<Target>();
 else row=await db.prepare("SELECT r.id,r.owner_id AS ownerId,a.revision,r.body FROM research_replies r JOIN research_annotations a ON a.id=r.annotation_id JOIN research_publications p ON p.id=a.publication_id AND p.revision=a.revision WHERE r.id=? AND "+visible("r","reply")+" AND "+visible("a","annotation")+" AND "+publicationVisible("p")).bind(targetId,...viewer(user),...viewer(user),...publicationViewer(user)).first<Target>();
 if(!row)throw notFound();return row;
}
async function listThreads(db:ReturnType<typeof storage>,p:Pub,user:string,history:boolean,offset:number){
 if(history&&p.ownerId!==user)throw notFound();
 const rows=await db.prepare("SELECT a.id,a.owner_id AS ownerId,a.revision,a.paragraph_index AS paragraphIndex,a.quote,a.body,a.created_at AS createdAt FROM research_annotations a JOIN research_publications p ON p.id=a.publication_id WHERE a.publication_id=? AND a.revision"+(history?"<":"=")+"? AND "+visible("a","annotation")+" AND "+publicationVisible("p")+" ORDER BY a.created_at,a.id LIMIT 21 OFFSET ?").bind(p.id,p.revision,...viewer(user),...publicationViewer(user),offset).all<Thread>();
 const threads=await Promise.all(rows.results.slice(0,20).map(async a=>{
  const replies=await db.prepare("SELECT r.id,r.owner_id AS ownerId,r.body,r.created_at AS createdAt FROM research_replies r JOIN research_annotations a ON a.id=r.annotation_id JOIN research_publications p ON p.id=a.publication_id WHERE r.annotation_id=? AND "+visible("r","reply")+" AND "+visible("a","annotation")+" AND "+publicationVisible("p")+" ORDER BY r.created_at,r.id LIMIT 20").bind(a.id,...viewer(user),...viewer(user),...publicationViewer(user)).all<Reply>();
  const {ownerId,...safe}=a;
  return {...safe,authorAlias:alias(a.id),mine:ownerId===user,replies:replies.results.map(r=>{const {ownerId,...data}=r;return {...data,mine:ownerId===user,authorAlias:"笔记作者"};})};
 }));
 // A concurrent republish/withdraw must not turn an old revision into a current thread response.
 const fresh=await publication(db,p.id,user);
 if(fresh.revision!==p.revision)throw new AccessError("公开版本已更新，请重新打开笔记。",409);
 return {revision:p.revision,threads,nextOffset:rows.results.length>20?offset+20:null,history};
}
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)throw new AccessError("请先登录。",401);
  requireResearchCommunity(user.userId);
  const uid=user.userId,db=storage(),params=new URL(request.url).searchParams;
  if(params.has("capabilities"))return json({admin:isAdmin(request)});
  if(params.has("blocks")){
   const rows=await db.prepare("SELECT id,label,created_at AS createdAt FROM research_blocks WHERE blocker_id=? ORDER BY created_at DESC LIMIT 200").bind(uid).all();return json({blocks:rows.results});
  }
  if(params.has("admin")){
   adminPrincipal(request);
   const status=params.get("status")==="handled"?"handled":"pending";
   const offset=number(Number(params.get("offset")??"0"),10000);
   const rows=await db.prepare("SELECT id,target_kind AS targetKind,target_id AS targetId,target_revision AS targetRevision,category,snapshot,status,created_at AS createdAt,resolved_at AS resolvedAt FROM research_reports WHERE status"+(status==="handled"?"<>":"=")+"'pending' ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?").bind(offset).all();
   return json({reports:rows.results.slice(0,20),nextOffset:rows.results.length>20?offset+20:null});
  }
  const p=await publication(db,id(params.get("publication")),uid);
  const revision=number(Number(params.get("revision")??"-1"));
  if(revision!==p.revision)throw new AccessError("公开版本已更新，请重新打开笔记。",409);
  return json(await listThreads(db,p,uid,params.get("history")==="1",number(Number(params.get("offset")??"0"),10000)));
 }catch(error){return fail(error,"批注或管理数据暂不可用。");}
}
export async function POST(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)throw new AccessError("请先登录。",401);
  requireResearchCommunity(user.userId);
  sameOrigin(request);
  let body:Record<string,unknown>;
  try{body=JSON.parse(await readLimitedText(request,16000));}catch(error){if(error instanceof AccessError)throw error;throw new AccessError("提交格式无效。",400);}
  if(!body||typeof body!=="object"||Array.isArray(body))throw new AccessError("提交格式无效。",400);
  const uid=user.userId,db=storage(),now=new Date().toISOString(),newId=crypto.randomUUID(),day=new Date(Date.now()-86400000).toISOString();
  if(body.action==="annotate"){
   const pid=id(body.publicationId),rev=number(body.revision),index=number(body.paragraphIndex),content=text(body.body,2000);
   const p=await publication(db,pid,uid);if(p.revision!==rev)throw new AccessError("版本已更新，请重新阅读。",409);
   const paragraph=paragraphs(p.content)[index];if(!paragraph)throw new AccessError("段落不存在。",400);
   const result=await db.prepare("INSERT INTO research_annotations(id,publication_id,owner_id,revision,paragraph_index,quote,body,created_at) SELECT ?,p.id,?,p.revision,?,?,?,? FROM research_publications p WHERE p.id=? AND p.revision=? AND "+publicationVisible("p")+" AND (SELECT count(*) FROM research_annotations WHERE publication_id=p.id AND revision=p.revision)<100 AND (SELECT count(*) FROM research_annotations WHERE owner_id=? AND created_at>=?)<30").bind(newId,uid,index,paragraph.slice(0,500),content,now,pid,rev,...publicationViewer(uid),uid,day).run();
   if(!result.meta.changes)throw new AccessError("版本或权限已变化，或已达批注数量限制。",409);return json({id:newId},201);
  }
  if(body.action==="reply"){
   const aid=id(body.annotationId),rev=number(body.revision),content=text(body.body,2000);
   const result=await db.prepare("INSERT INTO research_replies(id,annotation_id,owner_id,body,created_at) SELECT ?,a.id,?,?,? FROM research_annotations a JOIN research_publications p ON p.id=a.publication_id AND p.revision=a.revision WHERE a.id=? AND a.revision=? AND p.owner_id=? AND "+visible("a","annotation")+" AND "+publicationVisible("p")+" AND (SELECT count(*) FROM research_replies WHERE annotation_id=a.id)<20 AND (SELECT count(*) FROM research_replies WHERE owner_id=? AND created_at>=?)<50").bind(newId,uid,content,now,aid,rev,uid,...viewer(uid),...publicationViewer(uid),uid,day).run();
   if(!result.meta.changes)throw new AccessError("仅笔记作者可回复当前可见版本，或已达回复上限。",403);return json({id:newId},201);
  }
  if(body.action==="deleteAnnotation"||body.action==="deleteReply"){
   const table=body.action==="deleteAnnotation"?"research_annotations":"research_replies";
   const result=await db.prepare("DELETE FROM "+table+" WHERE id=? AND owner_id=?").bind(id(body.id),uid).run();
   if(!result.meta.changes)throw notFound();return json({ok:true});
  }
  if(body.action==="report"||body.action==="block"){
   const k=kind(body.targetKind),targetId=id(body.targetId),row=await target(db,k,targetId,uid);
   if(row.ownerId===uid)throw new AccessError("不能举报或屏蔽自己。",400);
   if(body.action==="report"){
    const category=body.category;
    if(category!=="harassment"&&category!=="privacy"&&category!=="spam"&&category!=="other")throw new AccessError("请选择举报原因。",400);
    if(number(body.revision)!==row.revision)throw new AccessError("内容版本已变化，请重新查看。",409);
    const result=await db.prepare("INSERT INTO research_reports(id,reporter_id,target_kind,target_id,target_revision,category,snapshot,created_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM research_reports WHERE reporter_id=? AND created_at>=?)<20 ON CONFLICT(reporter_id,target_kind,target_id,target_revision) DO NOTHING").bind(newId,uid,k,targetId,row.revision,category,row.body.slice(0,2000),now,uid,day).run();
    if(!result.meta.changes)throw new AccessError("已举报此内容，或今日举报次数已达上限。",409);return json({ok:true},201);
   }
   const result=await db.prepare("INSERT INTO research_blocks(id,blocker_id,blocked_id,label,created_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM research_blocks WHERE blocker_id=?)<200 ON CONFLICT(blocker_id,blocked_id) DO NOTHING").bind(newId,uid,row.ownerId,alias(targetId),now,uid).run();
   if(!result.meta.changes)throw new AccessError("已屏蔽该研究者，或屏蔽列表已满。",409);return json({ok:true},201);
  }
  if(body.action==="unblock"){
   const result=await db.prepare("DELETE FROM research_blocks WHERE id=? AND blocker_id=?").bind(id(body.id),uid).run();if(!result.meta.changes)throw notFound();return json({ok:true});
  }
  if(body.action==="moderate"){
   adminPrincipal(request);
   const reportId=id(body.id),decision=body.decision;
   if(decision!=="hide"&&decision!=="dismiss"&&decision!=="restore")throw new AccessError("处理方式无效。",400);
   const report=await db.prepare("SELECT target_kind AS targetKind,target_id AS targetId,target_revision AS targetRevision,status FROM research_reports WHERE id=?").bind(reportId).first<{targetKind:TargetKind;targetId:string;targetRevision:number;status:string}>();
   if(!report)throw notFound();
   const k=kind(report.targetKind);
   if(decision==="dismiss"){
    const result=await db.prepare("UPDATE research_reports SET status='dismissed',resolved_by=?,resolved_at=? WHERE id=? AND status='pending'").bind(uid,now,reportId).run();if(!result.meta.changes)throw new AccessError("举报已被处理。",409);return json({ok:true});
   }
   if(decision==="restore"){
    const results=await db.batch([
     db.prepare("DELETE FROM research_hidden WHERE report_id=? AND EXISTS(SELECT 1 FROM research_reports WHERE id=? AND status='hidden')").bind(reportId,reportId),
     db.prepare("UPDATE research_reports SET status='restored',resolved_by=?,resolved_at=? WHERE id=? AND status='hidden' AND NOT EXISTS(SELECT 1 FROM research_hidden WHERE report_id=?)").bind(uid,now,reportId,reportId)
    ]);
    if(!results[0].meta.changes)throw new AccessError("该隐藏记录已不存在。",409);return json({ok:true});
   }
   const exists="EXISTS(SELECT 1 FROM "+tableFor[k]+" WHERE id=?"+(k==="publication"?" AND revision=?":"")+")";
   const args=k==="publication"?[report.targetId,report.targetRevision]:[report.targetId];
   const results=await db.batch([
    db.prepare("INSERT INTO research_hidden(target_kind,target_id,report_id,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM research_reports WHERE id=? AND status='pending') AND "+exists+" ON CONFLICT(target_kind,target_id) DO NOTHING").bind(k,report.targetId,reportId,now,reportId,...args),
    db.prepare("UPDATE research_reports SET status='hidden',resolved_by=?,resolved_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM research_hidden WHERE report_id=?)").bind(uid,now,reportId,reportId)
   ]);
   if(!results[0].meta.changes)throw new AccessError("对象已变化、已隐藏或已被处理；请核对后关闭举报。",409);return json({ok:true});
  }
  throw new AccessError("未知操作。",400);
 }catch(error){return fail(error,"批注或管理操作未完成，请重试。");}
}
