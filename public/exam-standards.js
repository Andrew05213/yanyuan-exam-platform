(function(root){
'use strict';
const kindLabel={mc:'单选',multiple:'多选',indefinite:'不定项选择','choice-unspecified':'选择形式待确认',mixed:'单选与多选'};
function total(subject){return subject.sections.reduce((n,s)=>n+s.count,0);}
function validate(data){
 if(data.schema!==1||!data.schools)throw Error('考试标准格式错误');
 for(const [id,school] of Object.entries(data.schools)){
  if(school.schoolId!==id||school.evidence?.kind!=='user-reported')throw Error('缺少学校或考试来源');
  for(const subject of Object.values(school.subjects)){
   if(total(subject)!==subject.totalQuestions)throw Error('考试标准题数不一致');
   if(new Set(subject.sections.map(s=>s.id)).size!==subject.sections.length)throw Error('部分编号重复');
   for(const s of subject.sections){
    if(!Number.isInteger(s.count)||s.count<1||!kindLabel[s.questionKind])throw Error('题型或题量无效');
    if(s.composition&&s.composition.reduce((n,q)=>n+q.count,0)!==s.count)throw Error('混合题型题数错误');
    if(s.questionsPerPassage&&s.questionsPerPassage*s.passageCount!==s.count)throw Error('篇数与题数不一致');
   }
  }
 }
 return data;
}
// Deliberately requires explicit exam-section and source-paper calibration tags.
// Generic reading groups and old fifteen-blank clozes cannot stand in for these sections.
function eligible(unit,schoolId,subject,section){
 const qs=unit.questions||[];
 if(unit.subject!==subject||!unit.examCalibration||unit.examCalibration.schoolId!==schoolId||unit.examCalibration.sectionId!==section.id||unit.examCalibration.reviewed!==true)return false;
 if(section.questionKind==='choice-unspecified')return false;
 if(section.passageType&&unit.passageType!==section.passageType)return false;
 if(section.optionCount&&qs.some(q=>q.options?.length!==section.optionCount))return false;
 if(section.composition)return qs.length===section.count&&section.composition.every(c=>qs.filter(q=>q.kind===c.kind).length===c.count);
 if(qs.some(q=>q.kind!==section.questionKind))return false;
 return qs.length===(section.questionsPerPassage||(section.passageCount?section.count:1));
}
const UI={
 data:null,
 init(data){
  validate(data);this.data=data;
  const renderSchool=Hub.renderSchool.bind(Hub);
  Hub.renderSchool=s=>{renderSchool(s);if(data.schools[s.id]){this.banner(s.id);const b=document.querySelector('[data-hub="school-studio"]');if(b)b.textContent='专项练习 ↗';}};
  const render=TierStudio.render.bind(TierStudio);
  TierStudio.render=()=>{render();if(data.schools[Hub.school]){this.banner(Hub.school);const p=document.querySelector('#tier-preset option[value="default"]');if(p)p.textContent='专项训练默认配置（非整卷标准）';const button=document.querySelector('#tier-preview-button');if(button)button.textContent='核对专项训练与库存 ↗';}};
  const route=Hub.route.bind(Hub);
  Hub.route=hash=>{if(hash.startsWith('exam-standard/')){const id=hash.slice(14);if(!data.schools[id])return false;Hub.page('schools','考试标准');this.render(id);return true;}return route(hash);};
 },
 banner(id){const e=Hub.e;(document.querySelector('.school-masthead')||document.querySelector('#screen .page-heading')).insertAdjacentHTML('afterend','<div class="notice no-print"><b>'+e(this.data.schools[id].schoolName)+'个人提供的题型记录</b> · 用户提供，待样卷校准。当前通用组卷仅用于专项训练。 <a class="text-link" href="#exam-standard/'+e(id)+'">查看各科结构与缺口 →</a></div>');},
 render(id){
  const s=this.data.schools[id],e=Hub.e,items=TierStudio.data.items;
  const content=Object.entries(s.subjects).map(([name,subject])=>'<section class="hub-panel flow-space"><h2>'+e(name)+' · '+subject.totalQuestions+'题</h2><p class="hub-form-note">考试时长：'+(subject.minutes===null?'待补充':subject.minutes+'分钟')+' · 总分：'+(subject.totalPoints===null?'待补充':subject.totalPoints)+'。'+e(subject.difficulty?.label||s.difficulty.label)+'</p><div class="flow-config-table"><table><thead><tr><th>部分</th><th>材料与题量</th><th>形式</th><th>对应题型库存</th></tr></thead><tbody>'+subject.sections.map(section=>{
   const stock=items.filter(u=>eligible(u,id,name,section)).length,need=section.passageCount||section.count;
   const composition=section.composition?.map(c=>c.count+'道'+kindLabel[c.kind]).join('＋')||kindLabel[section.questionKind];
   return '<tr><td>'+e(section.title)+'</td><td>'+ (section.passageCount?section.passageCount+'篇 · ':'')+section.count+'题'+(section.questionsPerPassage?'（每篇'+section.questionsPerPassage+'题）':'')+'</td><td>'+e(composition)+(section.optionCount?' · '+section.optionCount+'选项':'')+'</td><td>'+stock+' / '+need+(stock<need?' · 待补齐':'')+'</td></tr>';
  }).join('')+'</tbody></table></div><p class="hub-form-note">'+subject.pending.map(e).join('<br>')+'</p></section>').join('');
  document.querySelector('#screen').innerHTML='<a class="back-link" href="#school/'+e(id)+'">← 返回学校专区</a><div class="page-heading"><h1>'+e(s.schoolName)+' · 题型记录</h1><p>来源：'+e(s.evidence.label)+' · '+e(s.updated)+' · 第'+s.revision+'版。考试年份待补充。</p></div><div class="notice">'+s.corrections.map(e).join('<br>')+'<br>现有题目须逐组核对材料、题型、题量与难度后才能计入整卷库存；暂不提供不符合该记录的整卷。</div>'+content;
 }
};
root.ExamStandardEngine={validate,total,eligible,kindLabel};root.ExamStandards=UI;
})(typeof window!=='undefined'?window:globalThis);

