import {bad,manual,text,safeId,empty,draft,type DayPlan,type Source} from "./workspace";
import {allocateWeek,type Routine} from "./week.mjs";
export const kinds=["note-review","error-review","target-training","project"];
export type Preferences={budgets:number[];allowedKinds:string[];preferredTrack:string;routines:Routine[]};
export const defaults=():Preferences=>({budgets:[60,60,60,60,60,60,0],allowedKinds:[...kinds],preferredTrack:"",routines:[]});
export function preferences(v:any):Preferences{
 if(!v||!Array.isArray(v.budgets)||v.budgets.length!==7||v.budgets.some((n:unknown)=>typeof n!=="number"||!Number.isSafeInteger(n)||n<0||n>180)||!Array.isArray(v.allowedKinds)||v.allowedKinds.some((k:unknown)=>typeof k!=="string"||!kinds.includes(k))||new Set(v.allowedKinds).size!==v.allowedKinds.length||!Array.isArray(v.routines)||v.routines.length>30)throw bad();
 const routines:Routine[]=v.routines.map((r:any)=>{
  if(!r||!safeId(r.id)||r.id.length>80||!Array.isArray(r.days)||!r.days.length||r.days.length>7||r.days.some((n:unknown)=>typeof n!=="number"||!Number.isInteger(n)||n<0||n>6)||new Set(r.days).size!==r.days.length)throw bad();
  const m=manual({...r,id:"manual-"+r.id});
  return {id:r.id,title:m.title,subject:m.subject,track:m.track,minutes:m.minutes,priority:m.priority,days:[...r.days].sort((a,b)=>a-b)};
 });
 if(new Set(routines.map(r=>r.id)).size!==routines.length)throw bad();
 return {budgets:[...v.budgets],allowedKinds:[...v.allowedKinds],preferredTrack:text(v.preferredTrack??"",80),routines};
}
export function weekPlans(dates:string[],p:Preferences,existing:DayPlan[],sources:Source[],now:string){
 const plans=allocateWeek({dates,budgets:p.budgets,existing,sources,routines:p.routines,allowedKinds:p.allowedKinds,preferredTrack:p.preferredTrack},(date,budget,selected,manual,pool)=>date<now?empty(date):draft(empty(date),{budgetMinutes:budget,selected,manual},pool));
 // Do not include prior days, nor change existing plans. No implicit rollover or penalty.
 return plans.filter(p=>p.date>=now);
}
