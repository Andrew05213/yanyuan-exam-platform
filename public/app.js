'use strict';
let bank,currentView='library',currentPaper=null,showAnswers=false,wrongOnly=false,searchHits=[];
let KEY='yanyuan-v2:guest';
let practice={schema:1,papers:{},attempts:[]};
let storageAvailable=true;
const $=s=>document.querySelector(s);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allQuestions=p=>p.sections.flatMap(s=>s.blocks.flatMap(b=>b.questions));
const allPapers=()=>[...bank.papers,...(bank.archivedPapers||[])];
const names={community:'共享题库',schools:'学校中心',studio:'组卷工作台',oral:'口试训练',saved:'学习档案',mistakes:'错题库',writing:'作文与翻译',library:'三科模拟卷',sources:'原始样卷',blueprint:'题型蓝图',records:'旧版本机记录'};
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(practice))}catch(e){storageAvailable=false;toast('当前浏览器无法保存，请导出练习记录备份。')}}
function getState(id){if(!practice.papers[id])practice.papers[id]={answers:{},elapsed:0,startAt:null};return practice.papers[id]}
function elapsed(s){return s.elapsed+(s.startAt?(Date.now()-s.startAt)/1000:0)}
function pause(s){if(s.startAt){s.elapsed=elapsed(s);s.startAt=null}}
function pauseAll(){Object.values(practice.papers).forEach(pause);persist()}
function cleanBackup(raw){
  if(!raw||raw.schema!==1||typeof raw.papers!=='object'||!Array.isArray(raw.attempts))throw Error('不支持的记录格式');
  const out={schema:1,papers:{},attempts:[]};
  for(const p of allPapers()){
    const st=raw.papers[p.id];if(!st)continue;
    out.papers[p.id]={answers:{},elapsed:Number.isFinite(st.elapsed)?Math.max(0,Math.min(st.elapsed,360000)):0,startAt:null};
    const valid=new Set(allQuestions(p).map(q=>String(q.id)));
    if(st.answers&&typeof st.answers==='object')for(const [id,a] of Object.entries(st.answers))if(valid.has(id)&&['A','B','C','D'].includes(a))out.papers[p.id].answers[id]=a;
  }
  for(const r of raw.attempts.slice(-1000)){
    const p=allPapers().find(p=>p.id===r.paperId);if(!p||typeof r.date!=='string'||isNaN(Date.parse(r.date))||!r.answers)continue;
    const qs=allQuestions(p),answers={};for(const q of qs)if(['A','B','C','D'].includes(r.answers[q.id]))answers[q.id]=r.answers[q.id];
    const score=qs.reduce((a,q)=>a+(answers[q.id]===q.answer?q.points:0),0),correct=qs.filter(q=>answers[q.id]===q.answer).length;
    out.attempts.push({paperId:p.id,date:r.date,answers,score,correct,answered:Object.keys(answers).length,elapsed:Number.isFinite(r.elapsed)?Math.max(0,Math.min(r.elapsed,360000)):0});
  }
  return out;
}
function init(){
  try{const saved=localStorage.getItem(KEY);if(saved)practice=cleanBackup(JSON.parse(saved))}catch(e){storageAvailable=false}
  // Stop the timer at the last persisted checkpoint after a browser was closed.
  for(const s of Object.values(practice.papers))s.startAt=null;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  $('#search').addEventListener('input',search);
  $('#search').addEventListener('keydown',e=>{if(e.key==='Escape')$('#search-results').hidden=true;if(e.key==='Enter'&&searchHits[0])openHit(0)});
  document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))$('#search-results').hidden=true});
  $('#screen').addEventListener('click',handleAction);
  $('#screen').addEventListener('change',e=>{
    const input=e.target;if(input.matches('input[data-question]'))answer(input.dataset.question,input.value);
    if(input.id==='wrong-only'){wrongOnly=input.checked;renderPaper()}
  });
  $('#search-results').addEventListener('click',e=>{const hit=e.target.closest('[data-hit]');if(hit)openHit(Number(hit.dataset.hit))});
  $('#import-file').addEventListener('change',importBackup);
  window.addEventListener('hashchange',route);
  window.addEventListener('pagehide',()=>{for(const s of Object.values(practice.papers))pause(s);persist()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&currentPaper){const s=getState(currentPaper.id);if(s.startAt){pause(s);persist();updateLive()}}});
  setInterval(()=>{if(currentPaper){const s=getState(currentPaper.id);if(s.startAt){if(elapsed(s)>=3600){pause(s);s.elapsed=3600;persist();toast('60 分钟计时结束，可提交核对。')}updateLive();if(Math.floor(elapsed(s))%5===0){const snap=structuredClone(practice);const t=snap.papers[currentPaper.id];t.elapsed=elapsed(s);t.startAt=null;try{localStorage.setItem(KEY,JSON.stringify(snap))}catch(e){storageAvailable=false}}}}},1000);
  route();
}
function route(){
  const hash=location.hash.slice(1);
  if(typeof Hub!=='undefined'&&Hub.route(hash))return;
  if(hash.startsWith('paper/')){const id=hash.slice(6);if(allPapers().some(p=>p.id===id)){openPaper(id);return}}
  navigate(names[hash]?hash:'schools',false);
}
function navigate(view,setHash=true){
  if(typeof Hub!=='undefined')Hub.leave();
  if(currentPaper)pauseAll();currentPaper=null;currentView=view;showAnswers=false;wrongOnly=false;
  if(setHash&&location.hash!=='#'+view){history.pushState(null,'','#'+view)}
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===(['report','feedback'].includes(view)?'saved':view));el.setAttribute('aria-current',el.dataset.view===view?'page':'false')});
  setBreadcrumb(['report','feedback'].includes(view)?'saved':view,names[view]);
  if(['schools','studio','oral','saved','mistakes','writing','community','standards','report','feedback'].includes(view))Hub.render(view);
  else ({library:renderLibrary,sources:renderSources,blueprint:renderBlueprint,records:renderRecords}[view]||renderLibrary)();
  window.scrollTo({top:0,behavior:'instant'});
}
function paperCard(p,index){
  const cls=p.subject==='数学'?'math':p.subject==='英语'?'english':'chinese';
  const answered=Object.keys(getState(p.id).answers).length;
  return `<article class="paper-card ${cls}"><span class="paper-number">${String(index+1).padStart(2,'0')}</span><div class="paper-card-head"><span class="card-eyebrow">${escapeHTML(p.en)}</span><span class="version-pill">v${escapeHTML(p.version)}</span></div><div class="paper-card-body"><h2>${escapeHTML(p.subject)}<span>模拟卷 A</span></h2><p class="card-subtitle">${escapeHTML(p.subtitle)}</p><div class="card-metrics"><span><b>${p.count}</b> 题</span><span><b>100</b> 分</span><span><b>60</b> 分钟</span>${answered?`<span class="is-progress">已答 ${answered} 题</span>`:''}</div></div><div class="card-actions"><button class="btn primary" data-open="${escapeHTML(p.id)}">${answered?'继续作答':'开始作答'}</button>${p.studentPdf?`<a class="btn secondary" href="${escapeHTML(p.studentPdf)}" download>下载 PDF</a>`:`<a class="btn secondary" href="sources/chinese-literary-reference.docx" download>参考卷与解析</a>`}</div></article>`;
}
function renderLibrary(){
  $('#screen').innerHTML=`<div class="page-heading page-heading--split"><div><h1>三科模拟卷</h1><p>按 100 分、60 分钟完成自测；每题附参考答案与解析。</p></div><div class="page-actions"><a class="btn secondary" href="downloads/all-student.pdf" download>三科学生卷</a><a class="btn secondary" href="downloads/all-answers.pdf" download>答案解析</a></div></div><div class="library-strip"><span><strong>03</strong>科目</span><span><strong>95</strong>题</span><span><strong>100</strong>分 / 科</span><span><strong>60</strong>分钟 / 科</span><button class="link-button" data-action="blueprint">查看题型蓝图</button></div><div class="paper-grid">${bank.papers.map(paperCard).join('')}</div><div class="below-grid"><article class="info-card"><span class="info-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 9V4h10v5M6 18H4v-6h16v6h-2M8 14h8v7H8z"/></svg></span><div><h3>整套打印</h3><p>学生卷与答案解析独立成册，便于限时完成后集中订正。</p><a class="text-link" href="downloads/all-student.pdf" download>下载旧版三科学生卷</a><a class="text-link" href="downloads/all-answers.pdf" download>下载旧版答案解析</a></div></article><article class="info-card"><span class="info-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z"/></svg></span><div><h3>原始依据</h3><p>上传样卷与题型结构均保留版本记录，可随时回溯。</p><a class="text-link" href="#sources">查看原始样卷</a><a class="text-link" href="#blueprint">查看题型蓝图</a></div></article></div><details class="help-note"><summary>版本与记录说明</summary><p>语文默认使用文学素养提升版，采用一篇中国、一篇外国作家的真实节选；题型依据上传的“笔试预测题”，难度尚未经实测等值。</p><p>在线练习记录保存在本浏览器，可随时导出备份。</p></details>`;
}
function renderSources(){
  $('#screen').innerHTML=`<div class="page-heading"><h1>原始样卷</h1><p>保留上传文件原貌，仿编与题型设置都可回溯。</p></div><div class="notice">${bank.sourceNote}</div><div class="source-list">${bank.sources.map((s,i)=>`<article class="source-row"><span class="source-index">${String(i+1).padStart(2,'0')}</span><div class="source-copy"><div class="file-meta">${escapeHTML(s.subject)} · ${escapeHTML(s.format)}</div><h2>${escapeHTML(s.title)}</h2><p>${escapeHTML(s.description)}</p></div><a class="btn secondary" href="${escapeHTML(s.path)}" target="_blank" rel="noopener">打开资料</a></article>`).join('')}</div><div class="archive-note">语文拼接版只调整浏览顺序，不改写、不推测缺失的原文；英语原文件中的手写选项及批注不作为新编卷的答案。</div>`;
}
function renderBlueprint(){
  $('#screen').innerHTML=`<div class="page-heading"><h1>题型蓝图</h1><p>三科均按上传样卷保留 100 分、60 分钟与全选择题形式，本版共 95 题。</p></div><div class="blueprint-grid">${bank.blueprint.map((b,i)=>`<article class="blueprint-card"><div class="blueprint-head"><span class="paper-number">${String(i+1).padStart(2,'0')}</span><h2>${escapeHTML(b.subject)}</h2></div><dl><div><dt>上传样卷</dt><dd>${escapeHTML(b.original)}</dd></div><div><dt>模拟卷 A</dt><dd>${escapeHTML(b.mock)}</dd></div><div><dt>重点能力</dt><dd>${escapeHTML(b.focus)}</dd></div><div><dt>难度处理</dt><dd>${escapeHTML(b.difficulty)}</dd></div></dl></article>`).join('')}</div><div class="notice">${escapeHTML(bank.calibration)}</div><details class="help-note"><summary>选材与核对来源</summary><p>语文现代文选自鲁迅《在酒楼上》与芥川龙之介《鼻子》（鲁迅旧译），均据公有领域版本整理；英文材料为命题原创，古文及古诗保留原有出处。</p>${bank.papers.flatMap(p=>p.sources||[]).map(s=>`<p><a class="text-link" href="${escapeHTML(s.url)}" target="_blank" rel="noopener">${escapeHTML(s.title)}</a></p>`).join('')}</details>`;
}
function renderRecords(){
  const attempts=[...practice.attempts].reverse();
  $('#screen').innerHTML=`<div class="page-heading page-heading--split"><div><h1>旧版练习</h1><p>${escapeHTML(bank.storageNote)}</p></div><div class="page-actions"><button class="btn primary" data-action="export">导出记录</button><button class="btn secondary" data-action="import">导入备份</button></div></div>${!storageAvailable?'<div class="notice">当前浏览器未能正常读取或保存记录，请及时导出备份。</div>':''}<div class="record-panel">${attempts.length?`<div class="record-list">${attempts.map((r,i)=>{const p=allPapers().find(p=>p.id===r.paperId);return `<article class="record-row"><span class="record-index">${String(i+1).padStart(2,'0')}</span><div class="record-score">${r.score}<small>/100</small></div><div class="record-detail"><h3>${escapeHTML(p.title)}</h3><p>${new Date(r.date).toLocaleString('zh-CN',{hour12:false})} · 已答 ${r.answered}/${p.count} · 答对 ${r.correct} · 用时 ${formatDuration(r.elapsed)}</p></div><button class="btn secondary" data-open="${escapeHTML(p.id)}">返回试卷</button></article>`}).join('')}</div>`:`<div class="empty-state"><span class="empty-mark">◷</span><h2>还没有提交的练习</h2><p>完成一科模拟卷后提交计分，记录会显示在这里。</p><button class="btn primary" data-action="library">选择一科开始</button></div>`}</div>`;
}
function openPaper(id,question){
  if(typeof Hub!=='undefined')Hub.leave();
  if(currentPaper&&currentPaper.id!==id)pauseAll();
  const p=allPapers().find(p=>p.id===id);if(!p)return;
  const changed=currentPaper?.id!==id;
  currentPaper=p;currentView='paper';if(changed){showAnswers=false;wrongOnly=false}
  history.replaceState(null,'','#paper/'+id);
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view==='library');el.setAttribute('aria-current','false')});
  $('#breadcrumb').innerHTML='试卷资料库 <i>/</i> '+p.title;
  renderPaper();
  if(question){requestAnimationFrame(()=>document.getElementById('q-'+id+'-'+question)?.scrollIntoView({behavior:'instant',block:'start'}))}else if(changed)window.scrollTo({top:0,behavior:'instant'});
}
function reading(b,p){
  if(!b.text)return '';
  const paragraphs=b.poem?`<p class="poem">${escapeHTML(b.text)}</p>`:b.paragraphs.map((para,i)=>`<p>${p.subject==='英语'&&b.title.startsWith('Passage')?`<span class="paragraph-no">${i+1}</span> `:''}${para}</p>`).join('');
  return `<article class="reading ${p.subject==='英语'?'english-text':''}"><div class="reading-head"><h3>${b.title}</h3><div class="reading-source">${b.source||''}${b.sourceUrl?' · <a href="'+escapeHTML(b.sourceUrl)+'" target="_blank" rel="noopener">原文出处</a>':''}</div></div><div class="reading-body">${paragraphs}</div>${b.note?'<div class="reading-note">'+b.note+'</div>':''}</article>`;
}
function questionHTML(q,p,sec){
  const state=getState(p.id),selected=state.answers[q.id];
  if(wrongOnly&&selected===q.answer)return '';
  const compact=p.subject==='数学'||sec.id==='en-mc'||sec.id==='en-cloze';
  return `<article id="q-${p.id}-${q.id}" class="question ${showAnswers?'review':''}"><div class="question-head"><span class="question-num">${q.id}</span><div class="question-stem ${p.subject==='英语'?'en':''}">${sec.id==='en-cloze'?'Blank '+q.id:q.stemHtml}</div><span class="question-points">${q.points} 分</span></div><div class="options ${compact?'compact':''}" role="radiogroup" aria-label="第 ${q.id} 题">${q.optionsHtml.map((o,i)=>{const letter='ABCD'[i];return `<label class="option ${p.subject==='英语'?'en':''} ${showAnswers&&letter===q.answer?'correct':''} ${showAnswers&&selected===letter&&letter!==q.answer?'wrong':''}"><input type="radio" name="${p.id}-${q.id}" data-question="${q.id}" value="${letter}" ${selected===letter?'checked':''}><span class="option-letter">${letter}</span><span class="option-content">${o}</span></label>`}).join('')}</div>${showAnswers?`<details class="analysis" ${selected&&selected!==q.answer?'open':''}><summary>正确答案 ${q.answer} · ${q.tag}</summary><p>${q.analysisHtml}</p></details>`:''}</article>`;
}
function renderPaper(){
  const p=currentPaper,s=getState(p.id),qs=allQuestions(p),answered=Object.keys(s.answers).length;
  const currentScore=s.submitted;
  $('#screen').innerHTML=`<button class="back-link" data-action="library">← 三科模拟卷</button><header class="exam-header"><div><span class="eyebrow">${escapeHTML(p.subject)} · 模拟卷 A</span><h1>${escapeHTML(p.title)}</h1><div class="meta">${p.count} 道单选题 · 100 分 · 60 分钟 · v${escapeHTML(p.version)}</div></div><div class="pdf-links">${p.studentPdf?`<a class="btn secondary" href="${escapeHTML(p.studentPdf)}" download>下载学生卷</a><a class="btn secondary" href="${escapeHTML(p.answerPdf)}" download>下载答案解析</a>`:`<a class="btn secondary" href="sources/chinese-literary-reference.docx" download>下载参考卷（含答案）</a>`}</div></header><div class="exam-layout"><div class="exam-body"><details class="exam-brief" open><summary>本卷说明</summary><p>${escapeHTML(p.intro)}</p></details>${p.archived?`<div class="notice">${escapeHTML(p.archiveNote||'这是旧版语文卷，现代文为 AI 生成。')} <button class="text-link" data-open="chinese-a-literary">打开文学素养提升版</button></div>`:''}${p.sections.map(sec=>`<section class="exam-section"><div class="exam-section-head"><h2 class="exam-section-title">${sec.title}</h2><p class="exam-section-desc">${sec.description}</p></div>${sec.blocks.map(b=>reading(b,p)+b.questions.map(q=>questionHTML(q,p,sec)).join('')).join('')}</section>`).join('')}<p class="archive-note">题目与解析为训练材料；作答记录保存在本浏览器，可导出备份。</p></div><aside class="exam-rail" aria-label="作答工具">${currentScore?`<div class="score-box"><span class="rail-label">上次提交</span><div><strong>${currentScore.score}</strong><small>/ 100</small></div><p>答对 ${currentScore.correct}/${qs.length} · 未答 ${qs.length-currentScore.answered} 题</p></div>`:''}<div class="timer-card"><div class="timer-head"><span class="rail-label">限时练习</span><span class="rail-note">60:00</span></div><div id="timer" class="time-value">60:00</div><button class="btn secondary" data-action="timer" id="timer-button">开始计时</button><div class="progress-text"><span id="progress-label">已答 ${answered}/${qs.length}</span><span id="progress-percent">${Math.round(answered/qs.length*100)}%</span></div><div class="progress-bar" aria-hidden="true"><span id="progress-fill" style="width:${answered/qs.length*100}%"></span></div></div><div class="navigator"><div class="rail-label">题目导航</div><div class="question-nav">${qs.map(q=>navButton(q,s)).join('')}</div><label class="wrong-toggle"><input id="wrong-only" type="checkbox" ${wrongOnly?'checked':''} ${!showAnswers?'disabled':''}>仅看错题与未答</label></div><div class="rail-actions"><button class="btn primary" data-action="submit">提交并计分</button><button class="btn secondary" data-action="answers">${showAnswers?'隐藏答案解析':'查看答案解析'}</button><button class="btn ghost" data-action="reset">重新作答</button></div><p class="rail-help">离开页面时自动暂停计时。</p></aside></div>`;
  updateLive();
}
function navButton(q,s){const a=s.answers[q.id];return `<button class="q-nav ${a?'answered':''} ${showAnswers&&a?(a===q.answer?'good':'bad'):''}" data-jump="${q.id}" aria-label="跳到第 ${q.id} 题${a?'，已选 '+a:''}">${q.id}</button>`}
function formatDuration(seconds){const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function updateLive(){
  if(!currentPaper)return;const s=getState(currentPaper.id),rem=Math.max(0,3600-elapsed(s));
  if($('#timer')){$('#timer').textContent=formatDuration(rem);$('#timer').classList.toggle('ended',rem===0)}
  if($('#timer-button'))$('#timer-button').textContent=s.startAt?'暂停计时':s.elapsed?'继续计时':'开始计时';
  const n=Object.keys(s.answers).length,N=currentPaper.count;
  if($('#progress-label'))$('#progress-label').textContent=`已答 ${n}/${N}`;
  if($('#progress-percent'))$('#progress-percent').textContent=Math.round(n/N*100)+'%';
  if($('#progress-fill'))$('#progress-fill').style.width=n/N*100+'%';
}
function answer(id,letter){
  const s=getState(currentPaper.id);s.answers[id]=letter;if(s.submitted){delete s.submitted;toast('选项已修改，可再次提交核对。')}
  persist();updateLive();
  const q=allQuestions(currentPaper).find(q=>q.id===Number(id));
  const card=document.getElementById('q-'+currentPaper.id+'-'+id);
  if(showAnswers){card.querySelectorAll('.option').forEach((el,i)=>{el.classList.toggle('correct','ABCD'[i]===q.answer);el.classList.toggle('wrong','ABCD'[i]===letter&&letter!==q.answer)})}
  const nav=document.querySelector('[data-jump="'+id+'"]');if(nav){const holder=document.createElement('div');holder.innerHTML=navButton(q,s);nav.replaceWith(holder.firstChild)}
  const scoreBox=document.querySelector('.score-box');if(scoreBox)scoreBox.remove();
}
function submit(){
  const p=currentPaper,s=getState(p.id),qs=allQuestions(p);if(!Object.keys(s.answers).length){toast('请先完成至少一道题，再提交计分。');return}
  pause(s);
  const answered=Object.keys(s.answers).length,correct=qs.filter(q=>s.answers[q.id]===q.answer).length,score=qs.reduce((sum,q)=>sum+(s.answers[q.id]===q.answer?q.points:0),0);
  const record={paperId:p.id,date:new Date().toISOString(),answers:{...s.answers},score,correct,answered,elapsed:s.elapsed};
  // Repeated submission without changing any answer does not create a duplicate.
  const last=practice.attempts[practice.attempts.length-1];
  if(!last||last.paperId!==p.id||JSON.stringify(last.answers)!==JSON.stringify(record.answers))practice.attempts.push(record);
  s.submitted={score,correct,answered};persist();showAnswers=true;renderPaper();window.scrollTo({top:0,behavior:'smooth'});toast(`得分 ${score}/100，未答 ${qs.length-answered} 题按 0 分计。`);
}
async function reset(){
  const dialog=$('#confirm-dialog');dialog.showModal();
  const result=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));
  if(result!=='confirm')return;
  practice.papers[currentPaper.id]={answers:{},elapsed:0,startAt:null};persist();showAnswers=false;wrongOnly=false;renderPaper();window.scrollTo({top:0,behavior:'smooth'});toast('已开始新的练习，历史提交记录保留。');
}
function exportBackup(){
  // Save the actual elapsed time, never the live timestamp that would keep running on another device.
  const copy=structuredClone(practice);for(const [id,s] of Object.entries(copy.papers)){s.elapsed=elapsed(practice.papers[id]);s.startAt=null}
  const blob=new Blob([JSON.stringify(copy,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='燕园备考_练习记录_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出当前选项、用时与提交记录。');
}
async function importBackup(e){
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw Error('文件过大');
    const incoming=cleanBackup(JSON.parse(await file.text()));
    // Merge: retain existing work, fill blank answers, and deduplicate past submissions.
    pauseAll();
    for(const p of allPapers()){const n=incoming.papers[p.id];if(!n)continue;const s=getState(p.id);s.answers={...n.answers,...s.answers};s.elapsed=Math.max(s.elapsed,n.elapsed);delete s.submitted}
    const seen=new Set(practice.attempts.map(r=>r.paperId+'|'+r.date+'|'+JSON.stringify(r.answers)));
    for(const r of incoming.attempts){const id=r.paperId+'|'+r.date+'|'+JSON.stringify(r.answers);if(!seen.has(id)){practice.attempts.push(r);seen.add(id)}}
    practice.attempts.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));persist();if(currentPaper)renderPaper();else renderRecords();toast('已合并备份；当前已有的选项与记录保留。');
  }catch(err){toast('导入失败：请使用本资料库导出的有效 JSON 备份。')}finally{e.target.value=''}
}
function search(){
  const query=$('#search').value.trim().toLocaleLowerCase();const box=$('#search-results');searchHits=[];
  if(!query){box.hidden=true;return}
  for(const p of bank.papers){
    if((p.title+' '+p.subtitle+' '+p.en).toLocaleLowerCase().includes(query))searchHits.push({paper:p.id,title:p.title,description:p.subtitle});
    for(const q of allQuestions(p))if((q.tag+' '+q.stem+' '+q.options.join(' ')).toLocaleLowerCase().includes(query))searchHits.push({paper:p.id,question:q.id,title:p.subject+' · 第 '+q.id+' 题 · '+q.tag,description:q.stem.replace(/\$/g,'').slice(0,90)});
  }
  if(typeof Hub!=='undefined'){
    for(const s of Hub.data.schools)if((s.name+s.short+s.track+s.region).toLocaleLowerCase().includes(query))searchHits.push({href:'school/'+s.id,title:s.name+' · '+s.track,description:s.focus.join(' / ')});
    for(const q of Hub.data.oralItems)if((q.title+' '+q.prompt+' '+Hub.data.types[q.type]).toLocaleLowerCase().includes(query))searchHits.push({href:'task/'+q.schoolIds[0]+'/'+q.id,title:Hub.data.types[q.type]+' · '+q.title,description:q.prompt.slice(0,90)});
  }
  searchHits=searchHits.slice(0,9);box.hidden=false;
  box.innerHTML=searchHits.length?searchHits.map((h,i)=>`<button class="search-result" data-hit="${i}"><small>${escapeHTML(h.title)}</small>${escapeHTML(h.description)}</button>`).join(''):'<div class="search-empty">没有匹配结果，试试“复数”“断句”或“语法”。</div>';
}
function openHit(i){const h=searchHits[i];if(!h)return;$('#search-results').hidden=true;$('#search').value='';if(h.href){location.hash=h.href;return;}showAnswers=false;wrongOnly=false;openPaper(h.paper,h.question)}
function handleAction(e){
  const open=e.target.closest('[data-open]');if(open){openPaper(open.dataset.open);return}
  const jump=e.target.closest('[data-jump]');if(jump){document.getElementById('q-'+currentPaper.id+'-'+jump.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'});return}
  const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
  if(names[action]){navigate(action);return}
  if(action==='timer'){const s=getState(currentPaper.id);if(s.startAt)pause(s);else if(elapsed(s)<3600)s.startAt=Date.now();else{toast('计时已结束。重新作答可重置计时。');return}persist();updateLive()}
  if(action==='answers'){showAnswers=!showAnswers;if(!showAnswers)wrongOnly=false;renderPaper()}
  if(action==='submit')submit();if(action==='reset')reset();if(action==='export')exportBackup();if(action==='import')$('#import-file').click();
}
function setBreadcrumb(view,title){
  const parent=names[view]||title;
  $('#breadcrumb').innerHTML='<a href="#schools">备考空间</a><i aria-hidden="true">/</i>'+(title!==parent?'<a href="#'+escapeHTML(view)+'">'+escapeHTML(parent)+'</a><i aria-hidden="true">/</i>':'')+'<span aria-current="page">'+escapeHTML(title)+'</span>';
}
function setupNavigation(){
  const toggle=$('#nav-toggle'),close=$('#nav-close'),nav=$('#primary-nav'),backdrop=$('#nav-backdrop');
  if(!toggle||!nav||!backdrop)return;
  const media=window.matchMedia('(max-width: 900px)');
  const resources=$('#resource-nav'),resourceSummary=resources?.querySelector('summary');
  let open=false;
  const render=()=>{
    const mobile=media.matches;
    nav.classList.toggle('is-open',mobile&&open);
    nav.inert=mobile&&!open;
    if(mobile)nav.setAttribute('aria-hidden',String(!open));else nav.removeAttribute('aria-hidden');
    toggle.setAttribute('aria-expanded',String(mobile&&open));
    toggle.setAttribute('aria-label',mobile&&open?'关闭导航':'打开导航');
    backdrop.hidden=!(mobile&&open);
    document.body.classList.toggle('nav-open',mobile&&open);
  };
  const setOpen=(value,restoreFocus=true)=>{
    open=value;if(resources)resources.open=!!(value&&resources.querySelector('[aria-current="page"]'));render();
    if(open)requestAnimationFrame(()=>(nav.querySelector('[data-view][aria-current="page"]')||nav.querySelector('.nav-item'))?.focus());
    else if(restoreFocus)toggle.focus();
  };
  toggle.addEventListener('click',()=>setOpen(!open));
  close?.addEventListener('click',()=>setOpen(false));
  backdrop.addEventListener('click',()=>setOpen(false,false));
  nav.addEventListener('click',event=>{if(!event.target.closest('[data-view]'))return;if(media.matches)setOpen(false);else if(resources?.open){const nested=resources.contains(event.target);resources.open=false;if(nested)resourceSummary?.focus();}});
  document.addEventListener('click',event=>{if(resources&&!resources.contains(event.target)&&!toggle.contains(event.target))resources.open=false;});
  document.addEventListener('focusin',event=>{if(resources&&!resources.contains(event.target))resources.open=false;});
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(resources?.open){resources.open=false;resourceSummary?.focus();event.preventDefault();}else if(open)setOpen(false);});
  const onMediaChange=()=>{open=false;if(resources)resources.open=false;render();};
  if(media.addEventListener)media.addEventListener('change',onMediaChange);
  else if(media.addListener)media.addListener(onMediaChange);
  render();
}
async function boot(){
  try{
    const [data,schools,workflows,difficulty,standards]=await Promise.all(['bank.json','schools.json','workflows.json','difficulty.json','exam-standards.json'].map(path=>fetch(path).then(r=>{if(!r.ok)throw Error('内容加载失败');return r.json()})));
    bank=data;Hub.init(schools);StudyFlow.init(workflows);TierStudio.init(difficulty);await PublicApp.init();ExamStandards.init(standards);SchoolTracks.init();QualityUI.init();init();
    document.querySelectorAll('.topbar').forEach(el=>el.inert=false);setupNavigation();
  }catch(e){
    document.querySelectorAll('.topbar').forEach(el=>el.inert=false);setupNavigation();
    $('#screen').innerHTML='<div class="empty-state"><span class="empty-mark">!</span><h2>资料暂时未能载入</h2><p>请刷新页面重试。</p><a class="btn primary" href="">刷新页面</a></div>';
  }
}
boot();
