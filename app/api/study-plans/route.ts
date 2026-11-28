import {storage} from "../../../db/store";
import {AccessError,principal,privateHeaders,readLimitedText,sameOrigin,fail} from "../../../lib/user-access";
import {admissionPlan,assessAdmissions} from "../../../lib/admissions/plan";
import {bad,stale,today,day,shift,weekStart,safeId,empty,draft,feedback,extra,reflection,stats,type Source,type DayPlan} from "../../../lib/study-planning/workspace";
import {preferences,defaults,weekPlans} from "../../../lib/study-planning/preferences";
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
 const [notes,errors,admissions,projects,reviews,overrides]=await Promise.all([
  db.prepare("SELECT id,title,review_on AS due FROM entries WHERE user_id=? AND folder='active' AND length(trim(content))>0 AND review_on IS NOT NULL AND review_on<>'' ORDER BY review_on,id LIMIT 61").bind(uid).all<{id:string;title:string;due:string}>(),
  db.prepare("SELECT id,title FROM archive_records WHERE owner_id=? AND kind='error-set' ORDER BY updated_at DESC,id LIMIT 41").bind(uid).all<{id:string;title:string}>(),
  db.prepare("SELECT payload FROM admissions_plans WHERE user_id=?").bind(uid).first<{payload:string}>(),
  db.prepare("SELECT p.id AS projectId,json_extract(p.payload,'$.title') AS projectTitle,json_extract(m.value,'$.id') AS milestoneId,json_extract(m.value,'$.title') AS title FROM research_projects p,json_each(p.payload,'$.milestones') m WHERE p.owner_id=? AND p.status='active' AND json_extract(m.value,'$.done')=0 ORDER BY p.updated_at DESC,p.id,m.key LIMIT 31").bind(uid).all<{projectId:string;projectTitle:string;milestoneId:string;title:string}>(),
  db.prepare("SELECT e.task_id AS id,e.level,e.due,e.occurred_at AS at FROM study_review_events e WHERE e.user_id=? AND e.day<=? AND e.day=(SELECT max(r.day) FROM study_review_events r WHERE r.user_id=e.user_id AND r.task_id=e.task_id AND r.day<=?) ORDER BY e.day DESC,e.task_id LIMIT 2001").bind(uid,date,date).all<{id:string;level:number;due:string;at:string}>(),
  db.prepare("SELECT task_id AS id,due,version,updated_at AS at FROM study_review_reschedules WHERE user_id=? AND day<=? ORDER BY updated_at DESC LIMIT 2001").bind(uid,date).all<{id:string;due:string;version:string;at:string}>(),
 ]);
 const reviewMap=new Map(reviews.results.map(r=>[r.id,r])),overrideMap=new Map(overrides.results.map(r=>[r.id,r]));
 const out:Source[]=[];
 async function add(kind:Source["kind"],sourceId:string,title:string,due:string|null,subject:string,track:string,href:string,sourceLabel:string,priority:number,minutes:number){
  if(!safeId(sourceId))return;
  const id=await candidateId(kind,sourceId),saved=reviewMap.get(id),override=overrideMap.get(id);
  // Keep source metadata current, private and short. Invalid historical dates are omitted.
  if(due!==null)try{day(due);}catch{return;}
  out.push({id,kind,sourceId,title:title.trim().slice(0,200)||"未命名任务",due:override&&(!saved||override.at>=saved.at)?override.due:saved?.due??due,subject,track:track.slice(0,80),href,sourceLabel,priority,minutes,level:saved?.level??0,rescheduleVersion:override?.version??null});
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
 return {items:out,truncated:notes.results.length>60||errors.results.length>40||projects.results.length>30||reviews.results.length>2000||overrides.results.length>2000};
}
async function reschedule(db:Db,uid:string,date:string,b:any){
 if(date!==today()||!safeId(b.taskId))throw bad();
 const due=day(b.due);if(due<date||due>shift(date,365))throw bad();
 const pool=await sources(db,uid,date),source=pool.items.find(t=>t.id===b.taskId&&["note-review","error-review"].includes(t.kind));
 if(!source)throw new AccessError("复习来源不可用。",404);
 const expected=b.rescheduleVersion;
 if(expected!==source.rescheduleVersion)throw stale();
 const version=crypto.randomUUID(),stamp=new Date().toISOString();
 const q=expected===null?db.prepare("INSERT INTO study_review_reschedules(user_id,task_id,day,due,version,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,task_id) DO NOTHING").bind(uid,source.id,date,due,version,stamp):db.prepare("UPDATE study_review_reschedules SET day=?,due=?,version=?,updated_at=? WHERE user_id=? AND task_id=? AND version=?").bind(date,due,version,stamp,uid,source.id,expected);
 if(!(await q.run()).meta.changes)throw stale();
 return reply({ok:true,due,rescheduleVersion:version});
}
async function prefRow(db:Db,uid:string){return db.prepare("SELECT payload,version FROM study_plan_preferences WHERE user_id=?").bind(uid).first<{payload:string;version:string}>();}
async function savePreferences(db:Db,uid:string,b:any){
 const p=preferences(b.preferences),expected=b.preferencesVersion;
 if(expected!==null&&(typeof expected!=="string"||!expected||expected.length>64))throw bad();
 const version=crypto.randomUUID(),stamp=new Date().toISOString(),payload=JSON.stringify(p);
 const stmt=expected===null?db.prepare("INSERT INTO study_plan_preferences(user_id,version,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING").bind(uid,version,payload,stamp):db.prepare("UPDATE study_plan_preferences SET version=?,payload=?,updated_at=? WHERE user_id=? AND version=?").bind(version,payload,stamp,uid,expected);
 if(!(await stmt.run()).meta.changes)throw stale();
 return reply({preferences:p,preferencesVersion:version});
}
async function tokenFor(value:unknown){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function weekAction(db:Db,uid:string,date:string,b:any){
 const start=weekStart(date),dates=Array.from({length:7},(_,i)=>shift(start,i)),now=today();
 if(dates[6]<now||dates[6]>shift(now,90))throw bad();
 const [setting,rows,pool]=await Promise.all([prefRow(db,uid),db.prepare("SELECT day,version,payload FROM study_day_plans WHERE user_id=? AND day>=? AND day<=? ORDER BY day").bind(uid,start,dates[6]).all<Row>(),sources(db,uid,now)]);
 const p=setting?preferences(JSON.parse(setting.payload)):defaults(),version=setting?.version??null;
 if(b.preferencesVersion!==version)throw stale();
 const plans=weekPlans(dates,p,rows.results.map(read),pool.items,now);
 const token=await tokenFor({uid,start,version,existing:rows.results.map(r=>[r.day,r.version]),plans});
 if(b.action==="week-preview")return reply({plans,token,skipped:dates.filter(d=>d<now||rows.results.some(r=>r.day===d)),truncated:pool.truncated});
 if(b.token!==token)throw new AccessError("候选或已有计划已经变化，请重新预览整周。",409);
 if(!plans.length)return reply({saved:0});
 const payload=JSON.stringify(plans.map(plan=>({day:plan.date,version:crypto.randomUUID(),payload:JSON.stringify(plan)})));
 // One SQLite statement, all-or-nothing. Guard against concurrent plan creation and settings edits.
 const sql="INSERT INTO study_day_plans(user_id,day,version,payload,updated_at) SELECT ?,json_extract(j.value,'$.day'),json_extract(j.value,'$.version'),json_extract(j.value,'$.payload'),? FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM study_day_plans d JOIN json_each(?) k ON d.day=json_extract(k.value,'$.day') WHERE d.user_id=?) AND (SELECT version FROM study_plan_preferences WHERE user_id=?) IS ?";
 const r=await db.prepare(sql).bind(uid,new Date().toISOString(),payload,payload,uid,uid,version).run();
 if(r.meta.changes!==plans.length)throw stale();
 return reply({saved:plans.length});
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
  const [row,week,pool,attempts,setting,history]=await Promise.all([readDay(db,id,date),db.prepare("SELECT day,version,payload FROM study_day_plans WHERE user_id=? AND day>=? AND day<=? ORDER BY day").bind(id,start,shift(start,6)).all<Row>(),sources(db,id,date),db.prepare("SELECT id,kind,title,created_at AS createdAt FROM archive_records WHERE owner_id=? AND kind IN (\'written-attempt\',\'oral-attempt\',\'review-attempt\',\'essay\') ORDER BY created_at DESC,id LIMIT 51").bind(id).all<{id:string;kind:string;title:string;createdAt:string}>(),prefRow(db,id),db.prepare("SELECT day,task_id AS taskId,kind,outcome,level,due,occurred_at AS occurredAt FROM study_review_events WHERE user_id=? ORDER BY day DESC,task_id LIMIT 101").bind(id).all<{day:string;taskId:string;kind:string;outcome:string;level:number;due:string;occurredAt:string}>()]);
  const pref=setting?preferences(JSON.parse(setting.payload)):defaults();const blank=empty(date);blank.budgetMinutes=pref.budgets[(new Date(date+"T00:00:00Z").getUTCDay()+6)%7];
  const visibleHistory=history.results.slice(0,100).map(h=>({...h,title:pool.items.find(c=>c.id===h.taskId)?.title??"已不可用或未列出的复习来源"}));
  return reply({today:today(),date,version:row?.version??null,preferences:pref,preferencesVersion:setting?.version??null,reviewHistory:visibleHistory,reviewHistoryTruncated:history.results.length>100,plan:row?read(row):blank,candidates:pool.items,truncated:pool.truncated,attempts:attempts.results.slice(0,50),attemptsTruncated:attempts.results.length>50,week:Array.from({length:7},(_,i)=>{const d=shift(start,i),r=week.results.find(x=>x.day===d);return {date:d,saved:!!r,...stats(r?[read(r)]:[])};}),weekStats:stats(week.results.map(read))});
 }catch(e){return error(e);}
}
export async function POST(request:Request){
 try{
  const {id}=principal(request);sameOrigin(request);const b=JSON.parse(await readLimitedText(request,60000)),date=dateInput(b?.date),db=storage();
  if(b.action==="preferences")return await savePreferences(db,id,b);
  if(b.action==="reschedule")return await reschedule(db,id,date,b);
  if(b.action==="week-preview"||b.action==="week-save")return await weekAction(db,id,date,b);
  const row=await readDay(db,id,date);
  if((row?.version??null)!==b.version)throw stale();
  const plan=row?read(row):empty(date);
  if(b.action==="preview"||b.action==="save"){
   const pool=await sources(db,id,date),next=draft(plan,b,pool.items);
   const token=await tokenFor({uid:id,version:b.version,plan:next});
   if(b.action==="preview")return reply({plan:next,version:row?.version??null,token});
   if(b.token!==undefined&&b.token!==token)throw stale();return await persist(db,id,next,b.version);
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
