import {storage} from "../../../db/store";
import {AccessError,principal,privateHeaders,readLimitedText,sameOrigin,fail} from "../../../lib/user-access";
import {admissionPlan,assessAdmissions} from "../../../lib/admissions/plan";
import {bad,stale,today,day,shift,weekStart,safeId,empty,draft,feedback,extra,reflection,stats,type Source,type DayPlan} from "../../../lib/study-planning/workspace";
export const dynamic="force-dynamic";
const reply=(data:unknown)=>Response.json(data,{headers:privateHeaders});
type Row={day:string;version:string;payload:string};
type Db=ReturnType<typeof storage>;
const read=(r:Row)=>JSON.parse(r.payload) as DayPlan;
const readDay=(db:Db,uid:string,date:string)=>db.prepare("SELECT day,version,payload FROM study_day_plans WHERE user_id=? AND day=?").bind(uid,date).first<Row>();
const dateInput=(v:unknown)=>{const d=day(v);if(d>shift(today(),90))throw bad();return d;};
async function candidateId(kind:string,sourceId:string){
 const raw=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(kind+":"+sourceId));
 return kind+"-"+Array.from(new Uint8Array(raw)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function sources(db:Db,uid:string,date:string):Promise<{items:Source[];truncated:boolean}>{
 // Strict owner scope for new planner, no legacy-owner fallback or shared project body.
 const [notes,errors,admissions,projects,reviews]=await Promise.all([
  db.prepare("SELECT id,title,review_on AS due FROM entries WHERE user_id=? AND folder='active' AND length(trim(content))>0 AND review_on IS NOT NULL AND review_on<>'' ORDER BY review_on,id LIMIT 61").bind(uid).all<{id:string;title:string;due:string}>(),
  db.prepare("SELECT id,title FROM archive_records WHERE owner_id=? AND kind='error-set' ORDER BY updated_at DESC,id LIMIT 41").bind(uid).all<{id:string;title:string}>(),
  db.prepare("SELECT payload FROM admissions_plans WHERE user_id=?").bind(uid).first<{payload:string}>(),
  db.prepare("SELECT p.id AS projectId,json_extract(p.payload,'$.title') AS projectTitle,json_extract(m.value,'$.id') AS milestoneId,json_extract(m.value,'$.title') AS title FROM research_projects p,json_each(p.payload,'$.milestones') m WHERE p.owner_id=? AND p.status='active' AND json_extract(m.value,'$.done')=0 ORDER BY p.updated_at DESC,p.id,m.key LIMIT 31").bind(uid).all<{projectId:string;projectTitle:string;milestoneId:string;title:string}>(),
  db.prepare("SELECT json_extract(t.value,'$.id') AS id,json_extract(t.value,'$.review.level') AS level,json_extract(t.value,'$.review.due') AS due FROM study_day_plans p,json_each(p.payload,'$.tasks') t WHERE p.user_id=? AND p.day<=? AND p.day>=? AND json_extract(t.value,'$.review.due') IS NOT NULL ORDER BY p.day DESC LIMIT 2001").bind(uid,date,shift(date,-366)).all<{id:string;level:number;due:string}>(),
 ]);
 const reviewMap=new Map<string,{level:number;due:string}>();for(const r of reviews.results)if(!reviewMap.has(r.id))reviewMap.set(r.id,r);
 const out:Source[]=[];
 async function add(kind:Source["kind"],sourceId:string,title:string,due:string|null,subject:string,track:string,href:string,sourceLabel:string,priority:number,minutes:number){
  if(!safeId(sourceId))return;
  const id=await candidateId(kind,sourceId),saved=reviewMap.get(id);
  // Keep source metadata current, private and short. Invalid historical dates are omitted.
  if(due!==null)try{day(due);}catch{return;}
  out.push({id,kind,sourceId,title:title.trim().slice(0,200)||"未命名任务",due:saved?.due??due,subject,track:track.slice(0,80),href,sourceLabel,priority,minutes,level:saved?.level??0});
 }
 for(const n of notes.results.slice(0,60))await add("note-review",n.id,n.title,n.due,"研究","阅读研究","/reading-notes#note/"+encodeURIComponent(n.id),"到期笔记",2,15);
 for(const e of errors.results.slice(0,40))await add("error-review",e.id,e.title,date,"其他","通用训练","#mistakes","已保存错题组",1,20);
 if(admissions){
  const plan=admissionPlan(JSON.parse(admissions.payload)),a=assessAdmissions(plan);
  for(const s of a.results.filter(x=>x.status!=="excluded").slice(0,10)){
   if(s.task)await add("target-training",s.id+"_"+s.task.id,s.name+" · "+s.task.title,null,"英语",s.name,"#task/"+encodeURIComponent(s.id)+"/"+encodeURIComponent(s.task.id),"择校关联训练（非录取判断）",s.firstChoice?2:1,25);
   else await add("target-training",s.id,s.name+" · 通用口试练习",null,"英语",s.name,"#oral","择校关联训练（通用）",s.firstChoice?2:1,25);
  }
 }
 for(const p of projects.results.slice(0,30))await add("project",p.projectId+"_"+p.milestoneId,p.title,null,"研究",p.projectTitle,"#projects","本人研究里程碑",1,25);
 return {items:out,truncated:notes.results.length>60||errors.results.length>40||projects.results.length>30||reviews.results.length>2000};
}
async function persist(db:Db,uid:string,plan:DayPlan,version:unknown){
 if(version!==null&&(typeof version!=="string"||!version||version.length>64))throw bad();
 const next=crypto.randomUUID(),payload=JSON.stringify(plan),stamp=new Date().toISOString();
 if(new TextEncoder().encode(payload).length>250000)throw bad();
 const stmt=version===null?db.prepare("INSERT INTO study_day_plans(user_id,day,version,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,day) DO NOTHING").bind(uid,plan.date,next,payload,stamp):db.prepare("UPDATE study_day_plans SET version=?,payload=?,updated_at=? WHERE user_id=? AND day=? AND version=?").bind(next,payload,stamp,uid,plan.date,version);
 if(!(await stmt.run()).meta.changes)throw stale();return reply({plan,version:next});
}
function error(e:unknown){return fail(e instanceof SyntaxError?bad():e,"学习计划暂不可用，请稍后重试。");}
export async function GET(request:Request){
 try{
  const {id}=principal(request),db=storage(),date=dateInput(new URL(request.url).searchParams.get("date")??today()),start=weekStart(date);
  const [row,week,pool,attempts]=await Promise.all([readDay(db,id,date),db.prepare("SELECT day,version,payload FROM study_day_plans WHERE user_id=? AND day>=? AND day<=? ORDER BY day").bind(id,start,shift(start,6)).all<Row>(),sources(db,id,date),db.prepare("SELECT id,kind,title,created_at AS createdAt FROM archive_records WHERE owner_id=? AND kind IN (\'written-attempt\',\'oral-attempt\',\'review-attempt\',\'essay\') ORDER BY created_at DESC,id LIMIT 51").bind(id).all<{id:string;kind:string;title:string;createdAt:string}>()]);
  return reply({today:today(),date,version:row?.version??null,plan:row?read(row):empty(date),candidates:pool.items,truncated:pool.truncated,attempts:attempts.results.slice(0,50),attemptsTruncated:attempts.results.length>50,week:Array.from({length:7},(_,i)=>{const d=shift(start,i),r=week.results.find(x=>x.day===d);return {date:d,saved:!!r,...stats(r?[read(r)]:[])};}),weekStats:stats(week.results.map(read))});
 }catch(e){return error(e);}
}
export async function POST(request:Request){
 try{
  const {id}=principal(request);sameOrigin(request);const b=JSON.parse(await readLimitedText(request,60000)),date=dateInput(b?.date),db=storage(),row=await readDay(db,id,date);
  if((row?.version??null)!==b.version)throw stale();
  const plan=row?read(row):empty(date);
  if(b.action==="preview"||b.action==="save"){
   const pool=await sources(db,id,date),next=draft(plan,b,pool.items);
   return b.action==="preview"?reply({plan:next,version:row?.version??null}):await persist(db,id,next,b.version);
  }
  let next:DayPlan;
  switch(b.action){
   case "feedback":{
    if(!row)throw bad();const pool=await sources(db,id,date);next=feedback(plan,b,pool.items.find(s=>s.id===b.taskId));
    // Only an owned, actual saved attempt may be associated. This remains manual completion.
    if(b.evidenceId===null){next.tasks=next.tasks.map(t=>{if(t.id!==b.taskId)return t;const {evidence,...rest}=t;return rest;});}else if(b.evidenceId!==undefined){if(!safeId(b.evidenceId))throw bad();const record=await db.prepare("SELECT id,kind FROM archive_records WHERE id=? AND owner_id=? AND kind IN ('written-attempt','oral-attempt','review-attempt','essay')").bind(b.evidenceId,id).first<{id:string;kind:string}>();if(!record)throw new AccessError("学习档案不存在或不可访问。",404);next.tasks=next.tasks.map(t=>t.id===b.taskId?{...t,evidence:record}:t);}
    break;
   }
   case "extra":next=extra(plan,b);break;
   case "reflection":next=reflection(plan,b);break;
   case "remove-extra":if(!row||!safeId(b.id)||!plan.extra.some(t=>t.id===b.id))throw bad();next={...plan,extra:plan.extra.filter(t=>t.id!==b.id)};break;
   case "delete":{if(!row||b.confirm!==true)throw bad();const r=await db.prepare("DELETE FROM study_day_plans WHERE user_id=? AND day=? AND version=?").bind(id,date,b.version).run();if(!r.meta.changes)throw stale();return reply({ok:true});}
   default:throw bad();
  }
  return await persist(db,id,next,b.version);
 }catch(e){return error(e);}
}
