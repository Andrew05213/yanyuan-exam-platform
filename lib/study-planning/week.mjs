export function allocateWeek({dates,budgets,existing,sources,routines,allowedKinds,preferredTrack},make){
 if(!Array.isArray(dates)||dates.length!==7||!Array.isArray(budgets)||budgets.length!==7||new Set(dates).size!==7||!Array.isArray(existing)||!Array.isArray(sources)||!Array.isArray(routines)||!Array.isArray(allowedKinds))throw Error("invalid_week");
 const reserved=new Set(existing.flatMap(p=>p.tasks.filter(t=>t.kind!=="manual"&&t.status!=="skipped").map(t=>t.id)));
 const days=[];
 for(let i=0;i<7;i++){
  const date=dates[i];if(existing.some(p=>p.date===date))continue;
  const weekday=(new Date(date+"T00:00:00Z").getUTCDay()+6)%7;
  const pool=sources.filter(s=>allowedKinds.includes(s.kind)&&!reserved.has(s.id)&&(s.due===null||s.due<=date)).map(s=>({...s,priority:s.track===preferredTrack?2:s.priority}));
  const selected=pool.map(s=>s.id),manual=routines.filter(r=>r.days.includes(weekday)).map(r=>({...r,id:"manual-"+r.id}));
  const plan=make(date,budgets[weekday],selected,manual,pool);
  for(const t of plan.tasks)if(t.kind!=="manual")reserved.add(t.id);
  days.push(plan);
 }
 return days;
}
