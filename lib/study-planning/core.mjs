function dateValue(s){
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error("invalid_date");
 const n=Date.parse(s+"T00:00:00Z");if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw Error("invalid_date");return n;
}

function addDays(s,n){return new Date(dateValue(s)+n*86400000).toISOString().slice(0,10)}

export function planDay(input){
 const {date,budgetMinutes,candidates}=input??{};dateValue(date);
 if(!Number.isSafeInteger(budgetMinutes)||budgetMinutes<0||budgetMinutes>180||!Array.isArray(candidates)||candidates.length>200)throw Error("invalid_plan");
 const kinds=["note-review","error-review","target-training","project","manual"];
 const seen=new Set();const pool=candidates.map(c=>{
  if(!c||typeof c.id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.id)||seen.has(c.id)||!kinds.includes(c.kind)||typeof c.title!=="string"||!c.title.trim()||c.title.length>200||!Number.isSafeInteger(c.minutes)||c.minutes<5||c.minutes>25||c.minutes%5!==0||!Number.isSafeInteger(c.priority)||c.priority<0||c.priority>2||typeof c.sourceId!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.sourceId))throw Error("invalid_candidate");
  if(c.due!==null)dateValue(c.due);
  seen.add(c.id);return {id:c.id,kind:c.kind,title:c.title.trim(),minutes:c.minutes,priority:c.priority,sourceId:c.sourceId,due:c.due};
 });
 const dueRank=c=>c.due!==null&&c.due<=date?0:1;
 const ranked=pool.filter(c=>c.due===null||c.due<=date).sort((a,b)=>dueRank(a)-dueRank(b)||b.priority-a.priority||(a.due??"9999-12-31").localeCompare(b.due??"9999-12-31")||a.id.localeCompare(b.id));
 const tasks=[],deferred=[];let used=0;
 for(const c of ranked){const rest=tasks.length?5:0;if(used+rest+c.minutes<=budgetMinutes){used+=rest+c.minutes;tasks.push({...c,reason:dueRank(c)===0?"due_review_or_deadline":c.priority===2?"user_priority":"available_time",status:"planned",breakBefore:rest});}else deferred.push({id:c.id,reason:"budget"});}
 for(const c of pool.filter(c=>c.due!==null&&c.due>date))deferred.push({id:c.id,reason:"future"});
 return {date,budgetMinutes,scheduledMinutes:tasks.reduce((n,t)=>n+t.minutes,0),breakMinutes:tasks.reduce((n,t)=>n+t.breakBefore,0),freeMinutes:budgetMinutes-used,tasks,deferred,ruleVersion:"HEZHI-STUDY-V1"};
}

export function reviewNext({date,level=0,outcome}={}){
 dateValue(date);
 if(!Number.isInteger(level)||level<0||level>4||!["again","hard","good","skip"].includes(outcome))throw Error("invalid_review");
 if(outcome==="skip")return {level,due:null,changed:false};
 const next=outcome==="again"?0:outcome==="hard"?Math.max(0,level-1):Math.min(4,level+1);
 const delay=outcome==="again"||outcome==="hard"?1:[1,3,7,14,30][next];
 return {level:next,due:addDays(date,delay),changed:true};
}

export function progress(tasks){
 if(!Array.isArray(tasks)||tasks.length>200)throw Error("invalid_tasks");
 const counts={planned:0,done:0,partial:0,skipped:0};
 const seen=new Set();
 for(const t of tasks){if(!t||typeof t.id!=="string"||seen.has(t.id)||!Object.prototype.hasOwnProperty.call(counts,t.status))throw Error("invalid_task");seen.add(t.id);counts[t.status]++;}
 return {...counts,total:tasks.length,completion:tasks.length?counts.done/tasks.length:null};
}
