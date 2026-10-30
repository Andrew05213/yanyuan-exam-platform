(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const cjk=['modern','classical','poem'];
function validate(c,data){
 if(!c||c.schema!=='tiers-v1'||!data.sections[c.subject]||!Array.isArray(c.rows)||!c.rows.length||c.rows.length>30)throw Error('分部分难度配置不完整。');
 if(!Number.isInteger(c.minutes)||c.minutes<5||c.minutes>240)throw Error('限时须为5至240分钟。');
 if(!Array.isArray(c.topics))throw Error('主题配置不完整。');
 for(const row of c.rows){if(!data.sections[c.subject].some(s=>s.id===row.section)||row.tier!=='any'&&!data.tiers[c.subject].some(t=>t.id===row.tier)||!Number.isInteger(row.count)||row.count<0||row.count>100)throw Error('请核对每部分的题型、档位和数量。');}
 if(!c.rows.some(r=>r.count))throw Error('请至少保留一部分题目。');
}
function label(data,subject,tier){return tier==='any'?'混合已标级':data.tiers[subject]?.find(t=>t.id===tier)?.label||tier;}
function available(data,c,row,state={}){
 const used=new Set([...(c.excludeAttempted?state.attemptedIds||[]:[]),...(c.excludeGenerated?state.generatedIds||[]:[])]),materials=new Set(state.generatedMaterials||[]);
 return data.items.filter(x=>x.subject===c.subject&&x.section===row.section&&(!c.fullReadingSets||row.section!=='reading'||x.questions.length===5)&&(row.tier==='any'||x.tier===row.tier)&&(!x.schoolIds||x.schoolIds.includes(c.schoolId))&&(!x.topic||!c.topics.length||c.topics.includes(x.topic))&&(!c.excludeMaterials||!materials.has(x.materialId))&&!x.questions.some(q=>used.has(q.sourceId)));
}
function plan(data,c,state={},rng=Math.random){
 validate(c,data);const chosen=new Map(),used=new Set(),material=new Set();
 const rows=c.rows.map((r,index)=>({...r,index,candidates:available(data,c,r,state)}));
 rows.sort((a,b)=>(a.tier==='any')-(b.tier==='any')||a.candidates.length-b.candidates.length);
 for(const row of rows){const pool=root.HubEngine.shuffle(row.candidates,rng).filter(x=>!x.questions.some(q=>used.has(q.sourceId))&&(!x.materialId||!material.has(x.materialId)));
  if(pool.length<row.count){const sec=data.sections[c.subject].find(s=>s.id===row.section);throw Error(`${sec.label} / ${label(data,c.subject,row.tier)}：需要 ${row.count}${sec.unit}，扣除重复与已分配题后只剩 ${pool.length}${sec.unit}。请调整本行；系统未自动降低难度。`);}
  const selected=pool.slice(0,row.count);chosen.set(row.index,selected);for(const x of selected){for(const q of x.questions)used.add(q.sourceId);if(x.materialId)material.add(x.materialId);}
 }
 return c.rows.flatMap((r,i)=>(chosen.get(i)||[]).map(x=>({...clone(x),requestedTier:r.tier,rowIndex:i})));
}
function preview(data,c,state={}){
 validate(c,data);const stocks=c.rows.map(r=>available(data,c,r,state).length);let error='',selected=[];try{selected=plan(data,c,state,()=>0.5);if(selected.reduce((n,x)=>n+x.questions.length,0)>100)throw Error('完整材料合计超过100小题，请减少组数或篇数。');}catch(e){error=e.message;}
 return {stocks,error,count:selected.reduce((n,x)=>n+x.questions.length,0)};
}
function makePacket(data,c,hub,state={},rng=Math.random){
 const selected=plan(data,c,state,rng);const school=hub.schools.find(s=>s.id===c.schoolId);if(!school||!school.subjects.includes(c.subject))throw Error('当前学校配置不包含该笔试科目。');
 let sequence=0;const blocks=selected.map(u=>{const b=clone(u),map={};for(const q of b.questions){const local=q.sourceNumber||q.id;q.id=++sequence;map[local]=q.id;q.kind=q.kind||'mc';q.difficulty={tier:b.tier,label:label(data,c.subject,b.tier),status:b.classificationStatus,reason:b.reason};if(b.section==='cloze')q.stem='Choose the best expression for blank '+q.id+'.';}
 if(b.section==='cloze'){b.text=b.text.replace(/\[(\d+)\]/g,(s,id)=>map[id]?'['+map[id]+']':s);b.paragraphs=b.text.split(/\n\s*\n/);}
 b.kind=b.section;b.title=(data.sections[c.subject].find(s=>s.id===b.section).label)+' · '+label(data,c.subject,b.tier)+' · '+b.title;return b;});
 if(sequence<1||sequence>100)throw Error('本版每卷须为1至100小题；完整材料不可拆散。');
 const all=blocks.flatMap(b=>b.questions),counts={};for(const b of blocks)counts[b.section]=(counts[b.section]||0)+b.questions.length;
 const pku=c.subject==='英语'&&sequence===50&&counts.mc===20&&counts.cloze===15&&counts.reading===15;
 let n=0;for(const b of blocks)for(const q of b.questions)q.points=pku?{mc:2,cloze:1,reading:3}[b.section]:Math.floor(100/sequence)+(++n<=100%sequence?1:0);
 const packet={schema:2,kind:'written',subject:c.subject,schoolId:c.schoolId,schoolName:school.name+' · '+school.track,title:school.short+' · '+(c.name||c.subject+'分部分模拟卷'),createdAt:new Date().toISOString(),minutes:c.minutes,count:sequence,totalPoints:100,config:clone(c),difficultyVersion:data.version,blocks,note:'各部分独立按已标注档位抽取；混合已标级不代表固定难度。分级为编辑暂定，尚未经群体实测等值。'+(pku?'本卷采用20道词汇语法×2分、15道完形×1分、15道阅读×3分。':'本卷按题量均分折合100分，分值属于训练设置。')+'主观题待实际批改。'};
 root.WorkflowEngine.validatePacket(packet);return packet;
}
function defaults(subject,schoolId,data,profiles){
 const c={schema:'tiers-v1',schoolId,subject,fullReadingSets:subject==='英语'&&schoolId==='pku',name:subject+'分部分训练',minutes:60,topics:[],excludeAttempted:true,excludeGenerated:false,excludeMaterials:false,rows:[]};
 if(subject==='英语'){const p=profiles[schoolId],count={mc:p.mcCount,reading:p.readingCount,cloze:p.clozeCount,fill:p.fillCount,ordering:p.orderCount,translation:p.translationCount,writing:p.writingCount};c.minutes=p.minutes;c.name=p.name;c.topics=schoolId==='pku'?[]:clone(p.topics);if(schoolId==='pku')c.name='北大英语综合训练';c.rows=data.sections[subject].map(s=>({section:s.id,tier:'any',count:count[s.id]||0}));}
 else if(subject==='语文')c.rows=data.sections[subject].map(s=>({section:s.id,tier:'gaokao-plus',count:1}));
 else{let remain=20;c.rows=data.sections[subject].map(s=>{const stock=data.items.filter(x=>x.subject===subject&&x.section===s.id).length;const count=Math.min(s.id==='algebra'?8:4,stock,remain);remain-=count;return {section:s.id,tier:'any',count};});if(remain)c.rows[0].count+=remain;}
 return c;
}
function migrate(c,data,profiles){if(c.schema==='tiers-v1'){validate(c,data);return clone(c);}const n=defaults('英语',c.schoolId,data,profiles);const map={reading:'readingCount',mc:'mcCount',fill:'fillCount',cloze:'clozeCount',ordering:'orderCount',translation:'translationCount',writing:'writingCount'};for(const r of n.rows)if(Number.isInteger(c[map[r.section]]))r.count=c[map[r.section]];for(const f of ['name','minutes','topics','excludeAttempted','excludeGenerated','excludeMaterials'])if(c[f]!==undefined)n[f]=clone(c[f]);return n;}
root.DifficultyEngine={validate,label,available,plan,preview,makePacket,defaults,migrate,clone};
})(typeof window!=='undefined'?window:globalThis);
