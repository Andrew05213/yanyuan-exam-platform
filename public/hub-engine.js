(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle=(items,rng=Math.random)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const sample=(items,n,rng)=>{if(items.length<n)throw Error(`当前条件下只有 ${items.length} 项，请减少题量或放宽筛选。`);return shuffle(items,rng).slice(0,n);};
  function writtenUnits(bank,hub){
    const units=[];
    for(const paper of bank.papers)for(const section of paper.sections)for(const block of section.blocks){
      const type=paper.subject==='数学'?'math':paper.subject==='语文'?'chinese':section.id==='en-mc'?'grammar':section.id==='en-cloze'?'cloze':'reading';
      const qs=block.questions.map(q=>({...clone(q),sourceId:paper.id+':'+q.id,level:paper.subject==='语文'?'进阶':q.id<=5?'基础':q.id>=16&&type==='math'?'挑战':'进阶'}));
      const base={subject:paper.subject,type,title:block.title||section.title,text:block.text||'',paragraphs:clone(block.paragraphs||[]),source:block.source||'',sourceUrl:block.sourceUrl||'',note:block.note||'',poem:!!block.poem};
      if(!block.text){for(const q of qs)units.push({...base,id:q.sourceId,questions:[q]});}
      else units.push({...base,id:paper.id+':block:'+section.id+':'+block.title,questions:qs});
    }
    for(const q of hub.writtenExtra)units.push({id:'extra:'+q.id,subject:q.subject,type:q.subject==='数学'?'math':'grammar',title:q.tag,text:'',paragraphs:[],source:q.source,questions:[{...clone(q),sourceId:'extra:'+q.id,stemHtml:esc(q.stem),optionsHtml:q.options.map(esc),analysisHtml:esc(q.analysis)}]});
    return units;
  }
  function pool(units,subject,scope,level){
    return units.filter(u=>u.subject===subject && (subject!=='英语'||scope==='mixed'||u.type===scope)).map(u=>({...u,questions:u.questions.filter(q=>level==='all'||subject==='语文'||q.level===level)})).filter(u=>u.questions.length && (!u.text || u.questions.length===units.find(v=>v.id===u.id).questions.length));
  }
  function makeWritten({bank,hub,schoolId,subject,scope='mixed',level='all',count=20,minutes=30,rng=Math.random}){
    const school=hub.schools.find(s=>s.id===schoolId);
    if(!school||!school.subjects.includes(subject))throw Error('此学校当前模板不包含该笔试科目。');
    if(!Number.isSafeInteger(count)||count<1||count>100||!Number.isFinite(minutes)||minutes<1||minutes>240)throw Error('题量或限时无效。');
    const units=writtenUnits(bank,hub);let chosen=[];
    if(subject==='语文'){
      chosen=pool(units,subject,'chinese','all');
      if(count!==chosen.reduce((n,u)=>n+u.questions.length,0))throw Error('语文当前为25题作家选文整卷，保留完整文本与配套题。');
    }else if(subject==='数学')chosen=sample(pool(units,subject,'math',level),count,rng);
    else if(scope==='mixed'){
      if(count<10)throw Error('英语综合卷至少10题，保留完整阅读篇章。');
      const readings=pool(units,subject,'reading',level);
      if(!readings.length)throw Error('该层级暂无完整阅读篇章，请选择全部层级或进阶。');
      const reading=sample(readings,1,rng)[0];
      chosen=[...sample(pool(units,subject,'grammar',level),count-reading.questions.length,rng),reading];
    }else if(scope==='grammar')chosen=sample(pool(units,subject,scope,level),count,rng);
    else{
      const candidates=shuffle(pool(units,subject,scope,level),rng);
      // Whole-passage subset selection: never detach cloze/reading questions
      // from their source text or silently return fewer than requested.
      const possible=new Map([[0,[]]]);
      for(const unit of candidates)for(const [n,selected] of [...possible].sort((a,b)=>b[0]-a[0])){
        const next=n+unit.questions.length;
        if(next<=count&&!possible.has(next))possible.set(next,[...selected,unit]);
      }
      if(!possible.has(count))throw Error('当前完整篇章无法组成所选题量；阅读请选5/10/15题，完形请选15题。');
      chosen=possible.get(count);
    }
    let sequence=0;
    const blocks=clone(chosen).map(u=>({...u,questions:u.questions.map(q=>({...q,id:++sequence,points:Math.floor(100/count)+(sequence<=100%count?1:0)}))}));
    if(sequence!==count)throw Error('组卷题量核对失败，请重新选择。');
    return {schema:1,kind:'written',schoolId,schoolName:school.name+' · '+school.track,subject,scope,level,count,minutes,totalPoints:100,blocks,createdAt:new Date().toISOString(),title:school.short+' · '+subject+'专项模拟卷',note:'非官方训练卷；科目参照2026公开要求，题量、分值与限时为本站训练设置。通用题库组卷，尚不声称与该校真题等值。'};
  }
  function makeOral({hub,schoolId,type='session',level='all',count=3,rng=Math.random}){
    const school=hub.schools.find(s=>s.id===schoolId);if(!school)throw Error('请选择学校。');
    const candidates=hub.oralItems.filter(q=>q.schoolIds.includes(schoolId)&&(level==='all'||q.level===level));
    let items=[];
    if(type==='session'){
      const usedPairs=new Set();
      for(const category of school.oralRecipe){
        const compatible=candidates.filter(q=>q.type===category&&!usedPairs.has(q.id.replace(/^(zh-en|en-zh)-/,'')));
        if(!compatible.length)throw Error(`当前层级缺少“${hub.types[category]}”，无法组成整场；请选择全部层级或专项抽题。`);
        const q=sample(compatible,1,rng)[0];items.push(q);usedPairs.add(q.id.replace(/^(zh-en|en-zh)-/,''));
      }
    }else{
      if(!Number.isSafeInteger(count)||count<1||count>20)throw Error('抽题数量无效。');
      items=sample(candidates.filter(q=>q.type===type),count,rng);
    }
    return {schema:1,kind:'oral',schoolId,schoolName:school.name+' · '+school.track,items:clone(items),count:items.length,createdAt:new Date().toISOString(),title:school.short+' · '+(type==='session'?'口试组合训练':hub.types[type]+'专项'),note:'训练顺序与时长为本站配置；不等同学校正式口试流程。材料出处、用户提供的题型及原创训练均有标记。'};
  }
  function grade(packet,answers){
    if(packet.kind!=='written')throw Error('仅客观题可自动核分。');
    const qs=packet.blocks.flatMap(b=>b.questions);let correct=0,score=0,answered=0;
    for(const q of qs){if('ABCD'.includes(answers[q.id]||'?')&&answers[q.id]?.length===1)answered++;if(answers[q.id]===q.answer){correct++;score+=q.points;}}
    return {score,correct,answered,total:qs.length};
  }
  root.HubEngine={clone,shuffle,sample,writtenUnits,pool,makeWritten,makeOral,grade};
})(typeof window!=='undefined'?window:globalThis);
