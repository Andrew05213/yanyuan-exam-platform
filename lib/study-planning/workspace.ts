import {AccessError} from "../user-access";
import {planDay,progress,reviewNext,type Candidate,type Scheduled,type Status} from "./core.mjs";
export const subjects=["英语","语文","数学","国别","日语","法语","其他语种","研究","其他"];
export const bad=()=>new AccessError("请检查学习计划字段。",400);
export const stale=()=>new AccessError("计划在另一处更新，请重新读取后再提交。",409);
export const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
export function day(value:unknown):string{
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<"2020-01-01"||value>"2100-12-31")throw bad();
 const d=Date.parse(value+"T00:00:00Z");if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,10)!==value)throw bad();return value;
}
export const shift=(value:string,n:number)=>new Date(Date.parse(day(value)+"T00:00:00Z")+86400000*n).toISOString().slice(0,10);
export const weekStart=(d:string)=>shift(d,-((new Date(day(d)+"T00:00:00Z").getUTCDay()+6)%7));
export const safeId=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export function text(v:unknown,max:number,required=false):string{if(typeof v!=="string"||v.length>max||(required&&!v.trim()))throw bad();return v.trim();}
export function minutes(v:unknown,nullable=false):number|null{
 if(nullable&&v===null)return null;
 if(typeof v!=="number"||!Number.isSafeInteger(v)||v<0||v>1440)throw bad();return v;
}
export type Source=Candidate&{subject:string;track:string;href:string;sourceLabel:string;level:number;rescheduleVersion?:string|null};
export type Task=Scheduled&{subject:string;track:string;href:string;sourceLabel:string;level:number;actualMinutes:number|null;note:string;review?:{outcome:string;level:number;due:string;at:string};evidence?:{id:string;kind:string}};
export type Extra={id:string;title:string;subject:string;track:string;actualMinutes:number|null;note:string};
export type Reflection={challenge:string;judgment:string;next:string};
export type DayPlan={date:string;budgetMinutes:number;tasks:Task[];deferred:{id:string;reason:string}[];extra:Extra[];reflection:Reflection;ruleVersion:string};
export const empty=(date:string):DayPlan=>({date,budgetMinutes:60,tasks:[],deferred:[],extra:[],reflection:{challenge:"",judgment:"",next:""},ruleVersion:"HEZHI-STUDY-V1"});
const subject=(v:unknown)=>{if(typeof v!=="string"||!subjects.includes(v))throw bad();return v;};
export function manual(v:any):Source{
 if(!v||typeof v!=="object"||!safeId(v.id)||!v.id.startsWith("manual-")||!Number.isSafeInteger(v.minutes)||v.minutes<5||v.minutes>25||v.minutes%5!==0||!Number.isInteger(v.priority)||v.priority<0||v.priority>2)throw bad();
 return {id:v.id,kind:"manual",sourceId:v.id,title:text(v.title,200,true),minutes:v.minutes,priority:v.priority,due:null,subject:subject(v.subject),track:text(v.track,80,true),href:"",sourceLabel:"自定义任务",level:0};
}
export function draft(current:DayPlan,body:any,sources:Source[]):DayPlan{
 const budget=body?.budgetMinutes;
 if(!Number.isSafeInteger(budget)||budget<0||budget>180||!Array.isArray(body?.selected)||body.selected.length>160||body.selected.some((id:unknown)=>!safeId(id))||new Set(body.selected).size!==body.selected.length||!Array.isArray(body?.manual)||body.manual.length>40)throw bad();
 const manuals:Source[]=body.manual.map(manual);
 if(new Set(manuals.map(t=>t.id)).size!==manuals.length)throw bad();
 const locked=current.tasks.filter(t=>t.status!=="planned"||t.actualMinutes!==null||!!t.note||!!t.evidence||!!t.review);
 const ids=new Set(locked.map(t=>t.id)),map=new Map(sources.map(s=>[s.id,s]));
 const selected:Source[]=body.selected.map((id:string)=>{const s=map.get(id);if(!s)throw new AccessError("有任务来源已不可用，请刷新候选。",409);return s;});
 const pool=[...selected,...manuals].filter(t=>!ids.has(t.id));
 const used=locked.reduce((n,t)=>n+t.minutes,0)+Math.max(0,locked.length-1)*5;
 if(used>budget)throw new AccessError("已记录的任务不能被缩减；可保留原预算或删除整日计划。",409);
 // Keep completed/partially recorded tasks. Reserve a break before the next planned task.
 const free=budget-used,remaining=Math.max(0,free-(locked.length?5:0));
 let computed:ReturnType<typeof planDay>;
 try{computed=planDay({date:current.date,budgetMinutes:remaining,candidates:pool});}catch{throw bad();}
 const byId=new Map(pool.map(t=>[t.id,t]));
 const tasks:Task[]=[...locked.map((t,i)=>({...t,breakBefore:i?5:0})),...computed.tasks.map((t,i)=>({...byId.get(t.id)!,...t,breakBefore:i||locked.length?5:0,actualMinutes:null,note:""}))];
 return {...current,budgetMinutes:budget,tasks,deferred:computed.deferred,ruleVersion:computed.ruleVersion};
}
export function feedback(plan:DayPlan,b:any,source:Source|undefined):DayPlan{
 if(!safeId(b?.taskId)||!["planned","done","partial","skipped"].includes(b?.status)||plan.date>today())throw bad();
 const old=plan.tasks.find(t=>t.id===b.taskId);if(!old)throw bad();
 const status=b.status as Status,actualMinutes=minutes(b.actualMinutes,true),note=text(b.note??"",1000);
 // A review event can be recorded only once per date/source; corrections of task status preserve the historical review.
 let review=old.review;
 if(b.outcome!==undefined&&b.outcome!==""){
  if(!source||!["note-review","error-review"].includes(old.kind)||plan.date!==today()||old.review||status==="planned"||status==="skipped"||!["again","hard","good","skip"].includes(b.outcome))throw bad();
  const r=reviewNext({date:plan.date,level:source.level,outcome:b.outcome});
  if(r.changed&&r.due){const due=b.reviewDate?day(b.reviewDate):r.due;if(due<=plan.date||due>shift(plan.date,365))throw bad();review={outcome:b.outcome,level:r.level,due,at:new Date().toISOString()};}
 }
 return {...plan,tasks:plan.tasks.map(t=>t.id===old.id?{...t,status,actualMinutes,note,...(review?{review}:{})}:t)};
}
export function extra(plan:DayPlan,b:any):DayPlan{
 if(plan.date>today()||plan.extra.length>=40||!safeId(b?.id)||!b.id.startsWith("extra-")||plan.extra.some(x=>x.id===b.id))throw bad();
 const value={id:b.id,title:text(b.title,200,true),subject:subject(b.subject),track:text(b.track,80,true),actualMinutes:minutes(b.actualMinutes,true),note:text(b.note??"",1000)};
 return {...plan,extra:[...plan.extra,value]};
}
export function reflection(plan:DayPlan,b:any):DayPlan{
 if(plan.date>today())throw bad();
 return {...plan,reflection:{challenge:text(b?.challenge,2000),judgment:text(b?.judgment,2000),next:text(b?.next,2000)}};
}
export function stats(plans:DayPlan[]){
 const totals=plans.map(p=>progress(p.tasks));const count=(key:"planned"|"done"|"partial"|"skipped"|"total")=>totals.reduce((n,t)=>n+t[key],0);const total=count("total"),done=count("done");const counts={planned:count("planned"),done,partial:count("partial"),skipped:count("skipped"),total,completion:total?done/total:null};
 const bySubject:Record<string,{planned:number;actual:number;reported:number}>=Object.create(null),byTrack:Record<string,{planned:number;actual:number;reported:number}>=Object.create(null);
 let actual=0,reported=0,plannedMinutes=0,recordCount=0,breakMinutes=0;
 for(const p of plans){
  breakMinutes+=p.tasks.reduce((n,t)=>n+t.breakBefore,0);
  for(const t of p.tasks){plannedMinutes+=t.minutes;const s=bySubject[t.subject]??={planned:0,actual:0,reported:0},track=byTrack[t.track]??={planned:0,actual:0,reported:0};s.planned+=t.minutes;track.planned+=t.minutes;recordCount++;if(t.actualMinutes!==null){s.actual+=t.actualMinutes;s.reported++;track.actual+=t.actualMinutes;track.reported++;actual+=t.actualMinutes;reported++;}}
  for(const t of p.extra){const s=bySubject[t.subject]??={planned:0,actual:0,reported:0},track=byTrack[t.track]??={planned:0,actual:0,reported:0};recordCount++;if(t.actualMinutes!==null){s.actual+=t.actualMinutes;s.reported++;track.actual+=t.actualMinutes;track.reported++;actual+=t.actualMinutes;reported++;}}
 }
 return {...counts,actualMinutes:reported?actual:null,reported,recordCount,plannedMinutes,breakMinutes,days:plans.length,daysWithCompletion:plans.filter(p=>p.tasks.some(t=>t.status==="done")).length,subjects:bySubject,tracks:byTrack};
}
