(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const ranks={'基础':1,'进阶':2,'挑战':3};
 const fields=['readingCount','mcCount','fillCount','clozeCount','orderCount','translationCount','writingCount'];
 const fieldLabels={readingCount:'阅读篇数',mcCount:'语言知识选择题',fillCount:'语法填空题',clozeCount:'完形篇数',orderCount:'排序篇数',translationCount:'翻译段数',writingCount:'作文篇数',minutes:'限时',level:'训练层级',topics:'材料主题',excludeAttempted:'排除已练题',excludeGenerated:'排除已生成题',excludeMaterials:'排除已生成篇章'};
 const normalize=value=>String(value||'').trim().replace(/[‘’]/g,"'").replace(/\s+/g,' ').replace(/[.!?。！？，,;；]+$/g,'').toLowerCase();
 const shuffle=(a,rng=Math.random)=>root.HubEngine.shuffle(a,rng);
 const choose=(items,n,label,rng)=>{if(items.length<n)throw Error(`${label}需要 ${n} 项，当前条件只剩 ${items.length} 项。请减少题量、调整主题/层级，或明确允许重复。`);return shuffle(items,rng).slice(0,n);};
 const countWords=s=>(String(s||'').match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g)||[]).length;
 function validateConfig(c){
  if(!c||!ranks[c.level]||!Array.isArray(c.topics)||!c.topics.length)throw Error('请选择训练层级与至少一个材料主题。');
  for(const field of fields)if(!Number.isInteger(c[field])||c[field]<0||c[field]>({readingCount:6,mcCount:50,fillCount:30,clozeCount:3,orderCount:2,translationCount:2,writingCount:1}[field]))throw Error(`${fieldLabels[field]}超出可用范围。`);
  if(fields.every(f=>c[f]===0))throw Error('至少保留一种题型。');
  if(!Number.isInteger(c.minutes)||c.minutes<5||c.minutes>240)throw Error('限时请设为5至240分钟。');
 }
 function parseAdjustment(text,input){
  const c=clone(input),applied=[];let rest=String(text||'').trim();
  const take=(re,apply)=>{rest=rest.replace(re,(match,...args)=>{apply(...args);applied.push(match);return ' ';});};
  const num=x=>({一:1,二:2,两:2,三:3,四:4,五:5,六:6}[x]??Number(x));
  for(const [re,field] of [[/阅读\s*(\d+|[一二两三四五六])\s*篇/g,'readingCount'],[/选择(?:题)?\s*(\d+)\s*题/g,'mcCount'],[/语法填空\s*(\d+)\s*(?:题|个)/g,'fillCount'],[/完形(?:填空)?\s*(\d+|[一二两三])\s*篇/g,'clozeCount'],[/排序\s*(\d+|[一二两])\s*篇/g,'orderCount'],[/翻译\s*(\d+|[一二两])\s*段/g,'translationCount'],[/作文\s*(\d+|[一二])\s*篇/g,'writingCount'],[/(\d+)\s*分钟/g,'minutes']])take(re,x=>c[field]=num(x));
  for(const [name,field] of [['完形(?:填空)?','clozeCount'],['语法填空','fillCount'],['选择题','mcCount'],['排序','orderCount'],['翻译','translationCount'],['作文','writingCount']])take(new RegExp('(?:不要|去掉|取消)'+name,'g'),()=>c[field]=0);
  take(/(?:难一点|难度提高|提高难度|挑战)/g,()=>c.level='挑战');take(/(?:简单一点|基础)/g,()=>c.level='基础');take(/进阶/g,()=>c.level='进阶');
  take(/(?:多一点|多点|增加一点)阅读/g,()=>c.readingCount=Math.min(6,c.readingCount+1));
  take(/(?:少一点|少点)选择题/g,()=>c.mcCount=Math.max(0,c.mcCount-5));
  take(/(?:不重复|避免重复|排除已练(?:过的)?题)/g,()=>c.excludeAttempted=true);
  take(/(?:排除已生成(?:的)?题)/g,()=>c.excludeGenerated=true);
  take(/(?:允许重复|可以重复)/g,()=>{c.excludeAttempted=false;c.excludeGenerated=false;c.excludeMaterials=false;});
  const topicWords={文学:'literature',细读:'literature',论证:'argument',哲学:'argument',科学:'science',科技:'science',工程:'science',社会:'society',公共议题:'society',教育:'education',学习:'education',文化:'culture',翻译材料:'culture'};
  const mentioned=[];
  for(const [word,id] of Object.entries(topicWords))take(new RegExp('(?:侧重|偏重|多选|主题选|多一点)?'+word,'g'),()=>mentioned.push(id));
  if(mentioned.length)c.topics=[...new Set(mentioned)];
  rest=rest.replace(/(?:请|帮我|给我|这次|本次|试卷|调整为|改为|设为|保留|增加|控制在|限时|时间|压缩到|到|以及|并且|然后|一点|一些|只要|和|与|的)/g,' ').replace(/[\s,，。;；、：:]+/g,' ').trim();
  return {config:c,applied,unhandled:rest};
 }
 function eligible(item,c,used,materials){
  const level=typeof item.level==='string'?ranks[item.level]:2;
  if(c.level==='基础'&&level>1)return false;
  if(c.level==='挑战'&&level<2)return false;
  if(item.topic&&!c.topics.includes(item.topic))return false;
  if(c.excludeMaterials&&item.materialId&&materials.has(item.materialId))return false;
  return !(item.questions||[item]).some(q=>used.has(q.sourceId));
 }
 function pools({bank,hub,data,config,state={}}){
  const used=new Set([...(config.excludeAttempted?state.attemptedIds||[]:[]),...(config.excludeGenerated?state.generatedIds||[]:[])]),materials=new Set(state.generatedMaterials||[]);
  const pass=x=>eligible(x,config,used,materials);
  const mc=root.HubEngine.writtenUnits(bank,hub).filter(u=>u.subject==='英语'&&u.type==='grammar').flatMap(u=>u.questions.map(q=>({...q,kind:'mc'}))).filter(pass);
  return {reading:data.readings.filter(pass),mc,fill:data.fills.filter(pass),cloze:data.clozes.filter(pass),order:data.orders.filter(pass),translation:data.translations.filter(x=>x.schoolIds.includes(config.schoolId)&&pass(x)),writing:data.writings.filter(x=>x.schoolIds.includes(config.schoolId)&&pass(x))};
 }
 function preview(args){validateConfig(args.config);const p=pools(args);return {available:{readingCount:p.reading.length,mcCount:p.mc.length,fillCount:p.fill.length,clozeCount:p.cloze.length,orderCount:p.order.length,translationCount:p.translation.length,writingCount:p.writing.length},config:clone(args.config)};}
 function distributePoints(blocks){
  const qs=blocks.flatMap(b=>b.questions);if(!qs.length||qs.length>100)throw Error('本版单卷须为1至100小题，请减少题量。');
  const weights={reading:30,mc:20,fill:20,cloze:15,ordering:10,translation:15,writing:25};
  const kinds={};for(const b of blocks)kinds[b.kind]=(kinds[b.kind]||0)+b.questions.length;
  const totalWeight=Object.keys(kinds).reduce((n,k)=>n+(weights[k]||10),0),remaining=100-qs.length;
  const remainders=[];let assigned=0;
  for(const b of blocks)for(const q of b.questions){const extra=remaining*(weights[b.kind]||10)/totalWeight/kinds[b.kind];q.points=1+Math.floor(extra);assigned+=q.points;remainders.push({q,fraction:extra-Math.floor(extra)});}
  remainders.sort((a,b)=>b.fraction-a.fraction);for(let i=0;i<100-assigned;i++)remainders[i].q.points++;
 }
 function makePacket(args){
  const {bank,hub,data,config:c,rng=Math.random}=args;validateConfig(c);const s=hub.schools.find(s=>s.id===c.schoolId);if(!s)throw Error('学校不存在。');const p=pools(args);let blocks=[];
  const ranked=a=>{const shuffled=shuffle(a,rng);return c.level==='挑战'?shuffled.sort((a,b)=>(ranks[b.level]||2)-(ranks[a.level]||2)):shuffled;};
  // Whole reading/cloze units are selected intact. No shortfall is hidden.
  if(p.reading.length<c.readingCount)choose(p.reading,c.readingCount,'阅读篇章',rng);
  blocks.push(...ranked(p.reading).slice(0,c.readingCount).map(b=>({...clone(b),kind:'reading'})));
  if(c.mcCount)blocks.push({kind:'mc',title:'Language knowledge',questions:clone(choose(p.mc,c.mcCount,'语言知识选择题',rng))});
  if(c.fillCount){let selected=[];const families=new Set();for(const item of shuffle(p.fill,rng))if(!families.has(item.family)){selected.push(item);families.add(item.family);if(selected.length===c.fillCount)break;}if(selected.length<c.fillCount)selected=choose(p.fill,c.fillCount,'语法填空',rng);blocks.push({kind:'fill',title:'Grammar in context',questions:clone(selected)});}
  blocks.push(...choose(p.cloze,c.clozeCount,'完形篇章',rng).map(b=>({...clone(b),kind:'cloze'})));
  blocks.push(...choose(p.order,c.orderCount,'语篇排序',rng).map(b=>({...clone(b),kind:'ordering'})));
  blocks.push(...choose(p.translation,c.translationCount,'翻译材料',rng).map(b=>({...clone(b),kind:'translation'})));
  blocks.push(...choose(p.writing,c.writingCount,'作文题',rng).map(b=>({...clone(b),kind:'writing'})));
  let number=0;
  for(const b of blocks){
    const mapping={};
    for(const q of b.questions){const local=q.sourceNumber||q.id;q.id=++number;if(b.kind==='cloze'){mapping[local]=q.id;q.stem='Choose the best expression for blank '+q.id+'.';q.stemHtml=root.HubEngine?undefined:q.stem;}q.kind=q.kind||'mc';}
    if(b.kind==='cloze')b.text=b.text.replace(/\[(\d+)\]/g,(match,n)=>mapping[n]?'['+mapping[n]+']':match);
    if(b.text&&(b.kind==='cloze'||!b.paragraphs?.length))b.paragraphs=b.text.split(/\n\s*\n/);
  }
  distributePoints(blocks);
  const packet={schema:2,kind:'written',subject:'英语',schoolId:c.schoolId,schoolName:s.name+' · '+s.track,title:s.short+' · '+(c.name||data.profiles[c.schoolId].name),createdAt:new Date().toISOString(),minutes:c.minutes,count:number,totalPoints:100,config:clone(c),blocks,note:'学校专项训练配置；具体题型比例、分值、时长和层级为本站训练设置。真实作家材料与原创训练分别署名。主观题单列待批改，不自动推算语义分。'};
  validatePacket(packet);return packet;
 }
 function validatePacket(p){
  if(!p||p.schema!==2||p.kind!=='written'||!Array.isArray(p.blocks)||!Number.isInteger(p.count)||p.count<1||p.count>100||typeof p.title!=='string'||!Number.isFinite(p.minutes)||p.minutes<5||p.minutes>240)throw Error('专项训练卷格式不完整。');
  const qs=p.blocks.flatMap(b=>b.questions||[]);if(qs.length!==p.count||qs.reduce((s,q)=>s+q.points,0)!==100||new Set(qs.map(q=>q.sourceId)).size!==qs.length)throw Error('题量、分值或题目编号重复。');
  for(const [i,q] of qs.entries()){if(q.id!==i+1||!Number.isInteger(q.points)||q.points<1||typeof q.sourceId!=='string'||typeof q.stem!=='string')throw Error('题目结构有误。');if(q.kind==='mc'&&(!Array.isArray(q.options)||q.options.length!==4||!'ABCD'.includes(q.answer)||q.answer.length!==1))throw Error('选择题选项或答案有误。');if(['fill','order'].includes(q.kind)&&(!Array.isArray(q.accepted)||!q.accepted.length))throw Error('缺少填空或排序参考形式。');if(!['mc','fill','order','writing','translation'].includes(q.kind))throw Error('不支持的题型。');}
 }
 function grade(p,answers,manual={}){
  let objectiveScore=0,objectiveMax=0,subjectiveScore=0,subjectiveMax=0,pending=0,answered=0,correct=0;
  const details=[];
  for(const q of p.blocks.flatMap(b=>b.questions)){
    const answer=String(answers[q.id]||'');if(answer.trim())answered++;
    if(q.kind==='writing'||q.kind==='translation'){subjectiveMax+=q.points;const value=manual[q.id];if(value===''||value==null){pending++;details.push({id:q.id,status:'待批改'});}else{if(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>q.points)throw Error('主观题得分超出本题范围。');subjectiveScore+=Number(value);details.push({id:q.id,status:'已人工评分',score:Number(value)});}continue;}
    objectiveMax+=q.points;const good=q.kind==='mc'?answer===q.answer:q.accepted.some(a=>normalize(a)===normalize(answer));if(good){objectiveScore+=q.points;correct++;}details.push({id:q.id,status:good?'正确':answer?'待订正':'未答',score:good?q.points:0});
  }
  return {objectiveScore,objectiveMax,subjectiveScore,subjectiveMax,pendingSubjective:pending,total:pending?null:objectiveScore+subjectiveScore,answered,correct,count:p.count,details};
 }
 function parseErrors(text,packet){
  const qs=new Map(packet.blocks.flatMap(b=>b.questions).map(q=>[q.id,q]));let remaining=String(text||'');const selected=new Map();
  remaining=remaining.replace(/(?:第\s*)?(\d{1,3})\s*(?:题\s*)?[:：.\-]?\s*([A-Da-d])/g,(match,n,a)=>{n=Number(n);a=a.toUpperCase();if(selected.has(n)&&selected.get(n)!==a)throw Error(`第 ${n} 题出现了不同选项，请保留一个。`);selected.set(n,a);return ' ';});
  if(remaining.replace(/[\s,，、;；。]+/g,'').length)throw Error('请使用“3B、8D、12A”格式；不支持的片段：'+remaining.trim());
  if(!selected.size)throw Error('请先输入至少一题，如3B。');
  const entries=[],consistent=[];
  for(const [id,a] of [...selected].sort((a,b)=>a[0]-b[0])){const question=qs.get(id);if(!question)throw Error(`试卷中没有第 ${id} 题。`);if(question.kind&&question.kind!=='mc')throw Error(`第 ${id} 题是${{fill:'填空',order:'排序',writing:'作文',translation:'翻译'}[question.kind]||'其他'}题，请在试卷页录入作答或进入主观题档案。`);if(a===question.answer){consistent.push(id);continue;}const block=packet.blocks.find(b=>b.questions.some(q=>q.id===id));entries.push({qid:id,sourceId:question.sourceId||packet.id+':'+id,question:clone(question),selected:a,correct:question.answer,context:block?.text?{title:block.title,text:block.text,source:block.source,sourceUrl:block.sourceUrl,paragraphs:block.paragraphs}:null});}
  return {entries,consistent,reported:selected.size,unreported:packet.count-selected.size};
 }
 function feedback(entry,data){
  const q=entry.question,tag=q.tag||'知识点';const method=data.methods[tag]||Object.entries(data.methods).find(([k])=>k!=='default'&&tag.includes(k))?.[1]||data.methods.default;
  const selected=q.options['ABCD'.indexOf(entry.selected)],correct=q.options['ABCD'.indexOf(entry.correct)];
  return {selected,correct,rule:q.analysis,optionAnalysis:`所填 ${entry.selected} 项为“${selected}”；参考答案 ${entry.correct} 项为“${correct}”。请结合下方定位或规则比较两者。${/all |always|never|every |only /i.test(selected)?'该选项含范围或绝对性表述，须核对原文是否支持；不能仅因出现这些词就判错。':''}`,method,learningPoints:q.learningPoints?.length?q.learningPoints:[tag,q.stem]};
 }
 function variant(entry,rng=Math.random){
  const q=entry.question,tag=q.tag||'';const n=2+Math.floor(rng()*7);
  let stem,options,answer,analysis;
  if(/复数/.test(tag)){stem=`复数 z 满足 (1+i)z=${n}，则 |z|² 为多少？`;const correct=n*n/2;options=[String(correct),String(n*n),String(n/2),String(n+1)];if(new Set(options).size<4)options[3]=String(n*n+3);answer='A';analysis=`由模的平方，2|z|²=${n*n}，故|z|²=${correct}。`;}
  else if(/数列|递推/.test(tag)){stem=`数列 a₁=1，aₖ₊₁=2aₖ+1，则 a${n} 等于多少？`;const v=2**n-1;options=[String(v+1),String(v-1),String(v),String(2**(n+1)-1)];answer='C';analysis=`令bₖ=aₖ+1，则bₖ₊₁=2bₖ且b₁=2，故aₖ=2ᵏ−1，所求为${v}。`;}
  else if(/倒装/.test(tag)){stem='Only after the evidence had been compared ____ the editor publish the correction.';options=['had','did','was','has'];answer='B';analysis='Only+状语前置，主句部分倒装；publish为原形且语境过去，使用did。';}
  else if(/虚拟语气/.test(tag)){stem='Had the committee considered the costs, it ____ a different plan.';options=['chooses','will choose','would choose','would have chosen'];answer='D';analysis='Had ... considered为过去反事实条件句倒装；主句would have done。';}
  else if(/非谓语|动词搭配/.test(tag)){stem='The editor avoided ____ a conclusion before checking the original documents.';options=['drawing','to draw','draw','drawn'];answer='A';analysis='avoid后接动名词，avoided drawing a conclusion。';}
  else if(/定语从句/.test(tag)){stem='The archive contains five letters, none of ____ has a date.';options=['them','that','which','what'];answer='C';analysis='逗号后为非限制性定语从句，none of which作主语。';}
  else return null;
  return q.kind&&q.kind!=='mc'?null:{sourceId:'variant:'+entry.sourceId+':'+n,kind:'mc',stem,options,answer,analysis,tag,level:q.level||'进阶',points:100,source:'规则编制的同知识点训练变式；非官方真题'};
 }
 root.WorkflowEngine={fields,fieldLabels,normalize,countWords,parseAdjustment,validateConfig,pools,preview,makePacket,validatePacket,grade,parseErrors,feedback,variant,clone};
})(typeof window!=='undefined'?window:globalThis);
