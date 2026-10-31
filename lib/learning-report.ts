type RecordRow={id:string;kind:string;updatedAt:string;createdAt?:string;payload:any};
export function buildLearningReport(records:RecordRow[]){
 const wrong=new Map<string,{tag:string;subject:string;observations:number;lastSeen:string;source:string}>(),answered=new Set<string>();
 const errorSets=new Map<string,any>();let objectiveObservations=0,correctObservations=0;
 const key=(q:any,p:any)=>JSON.stringify([p.subject||'英语',q.sourceId||q.id,q.stem||'',q.answer||'']);
 const note=(q:any,p:any,time:string,source:string)=>{const k=key(q,p),old=wrong.get(k);wrong.set(k,{tag:String(q.tag||'未标注知识点').slice(0,120),subject:String(p.subject||'英语'),observations:(old?.observations||0)+1,lastSeen:time>=(old?.lastSeen||'')?time:old!.lastSeen,source});};
 for(const r of records){const p=r.payload||{};const rawTime=r.kind==='error-set'?p.reportedAt:p.completedAt;const occurred=typeof rawTime==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(rawTime)?rawTime:r.createdAt||r.updatedAt;
  if(r.kind==='error-set'&&Array.isArray(p.entries)){
   errorSets.set(r.id,p);for(const e of p.entries){if(!e?.question||!['A','B','C','D'].includes(e.correct)||!['A','B','C','D'].includes(e.selected)||e.selected===e.correct)continue;note(e.question,p.packet||{},occurred,r.id);}
  }
  if(r.kind==='written-attempt'&&p.packet&&p.answers&&typeof p.answers==='object'){
   for(const b of Array.isArray(p.packet.blocks)?p.packet.blocks:[])for(const q of Array.isArray(b?.questions)?b.questions:[]){if(!q)continue;const answer=p.answers[q.id];if((q.kind&&q.kind!=='mc')||!['A','B','C','D'].includes(q.answer)||!['A','B','C','D'].includes(answer))continue;objectiveObservations++;answered.add(key(q,p.packet));if(answer===q.answer)correctObservations++;else note(q,p.packet,occurred,r.id);}
  }
 }
 const tags=new Map<string,{tag:string;subject:string;uniqueWrong:number;observations:number;lastSeen:string}>();
 for(const w of wrong.values()){const k=w.subject+'|'+w.tag,t=tags.get(k)||{tag:w.tag,subject:w.subject,uniqueWrong:0,observations:0,lastSeen:''};t.uniqueWrong++;t.observations+=w.observations;if(w.lastSeen>t.lastSeen)t.lastSeen=w.lastSeen;tags.set(k,t);}
 // Only the latest saved review per error set is used, rather than adding repeated reviews together.
 const latestReviews=new Map<string,RecordRow>();for(const r of records)if(r.kind==='review-attempt'&&errorSets.has(r.payload?.parentId)){const old=latestReviews.get(r.payload.parentId);if(!old||r.updatedAt>old.updatedAt)latestReviews.set(r.payload.parentId,r);}
 let reviewAnswered=0,reviewCorrect=0;for(const [id,r] of latestReviews){const p=errorSets.get(id);for(const e of p.entries){if(!e||!['A','B','C','D'].includes(e.correct))continue;const a=r.payload.answers?.[e.qid];if(!['A','B','C','D'].includes(a))continue;reviewAnswered++;if(a===e.correct)reviewCorrect++;}}
 return {uniqueWrong:wrong.size,repeatWrong:[...wrong.values()].filter(w=>w.observations>1).length,objectiveObservations,correctObservations,uniqueAnswered:answered.size,reviewAnswered,reviewCorrect,reviewedSets:latestReviews.size,tags:[...tags.values()].sort((a,b)=>b.uniqueWrong-a.uniqueWrong||b.observations-a.observations).slice(0,30),evidence:'已保存的选择题作答与手动错题记录；手动错题不计算整卷正确率，未作答题不计为答错。重复记录可能来自同一次练习，不等同于多次独立失败。'};
}
