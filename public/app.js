'use strict';
let bank,currentView='library',currentPaper=null,showAnswers=false,wrongOnly=false,searchHits=[];
let KEY='yanyuan-v2:guest';
let practice={schema:1,papers:{},attempts:[]};
let storageAvailable=true;
const $=s=>document.querySelector(s);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allQuestions=p=>p.sections.flatMap(s=>s.blocks.flatMap(b=>b.questions));
const allPapers=()=>[...bank.papers,...(bank.archivedPapers||[])];
const names={community:'共享资料',schools:'学校中心',studio:'组卷工作台',oral:'口试训练',saved:'我的学习档案',mistakes:'我的错题库',writing:'作文与主观题',library:'原有三科卷',sources:'原始样卷',blueprint:'原卷题型蓝图',records:'旧版本机练习'};
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
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);el.setAttribute('aria-current',el.dataset.view===view?'page':'false')});
  $('#breadcrumb').innerHTML='备考空间 <i>/</i> '+escapeHTML(names[view]);
  if(['schools','studio','oral','saved','mistakes','writing','community'].includes(view))Hub.render(view);
  else ({library:renderLibrary,sources:renderSources,blueprint:renderBlueprint,records:renderRecords}[view]||renderLibrary)();
  window.scrollTo({top:0,behavior:'instant'});
}
function paperCard(p,index){
  const cls=p.subject==='数学'?'math':p.subject==='英语'?'english':'chinese';
  const answered=Object.keys(getState(p.id).answers).length;
  return `<article class="paper-card ${cls}"><div class="card-cap"></div><div class="card-content"><div class="card-eyebrow"><span>0${index+1} / ${p.en}</span><span class="card-monogram">${p.en[0]}</span></div><h3>${p.subject}</h3><div class="card-subtitle">${p.subtitle}<br>模拟卷 A · ${p.studentPages?p.studentPages+' 页学生卷':'在线练习'}${answered?' · 已答 '+answered+' 题':''}</div><div class="card-metrics"><span><b>${p.count}</b>题</span><span><b>100</b>分</span><span><b>60</b>分钟</span></div></div><div class="card-actions"><button class="btn primary" data-open="${p.id}">${answered?'继续作答':'开始作答'} <span class="arrow">↗</span></button>${p.studentPdf?`<a class="btn secondary" href="${p.studentPdf}" download>下载 PDF</a>`:`<a class="btn secondary" href="sources/chinese-literary-reference.docx" download>参考卷与解析</a>`}</div></article>`;
}
function renderLibrary(){
  $('#screen').innerHTML=`<section class="hero"><div class="hero-copy"><h1>燕园备考<br>三科试卷资料库</h1><p>以样卷为起点，把练习做扎实。<br>语数英模拟卷、逐题解析与原始材料，在这里归档。</p></div><div class="hero-art" aria-hidden="true"><div class="art-ring"></div><div class="paper-art"><span class="art-top">YANYUAN · STUDY ARCHIVE</span><span class="letter">A.</span><span class="art-caption">三科模拟卷</span><span class="art-bottom">95 QUESTIONS / 300 POINTS</span></div><span class="vertical-caption">COLLECT · PRACTISE · REFLECT</span></div></section><div class="stats"><div class="stat"><strong>03</strong><small>科目试卷<br>语文 / 数学 / 英语</small></div><div class="stat"><strong>95</strong><small>原创题目<br>逐题配有解析</small></div><div class="stat"><strong>100</strong><small>每科满分<br>各限时 60 分钟</small></div><div class="stat"><strong>05</strong><small>原始资料入口<br>含语文附图拼接版</small></div></div><div class="section-top"><div><h2>模拟卷 A</h2><p>先独立作答，再用解析找到问题。</p></div><span class="version-pill">EDITION 01</span></div><div class="paper-grid">${bank.papers.map(paperCard).join('')}</div><div class="below-grid"><article class="info-card"><span class="info-icon">↧</span><div><h3>整套打印，分开核对</h3><p>三科学生卷与答案解析独立成册。<br>适合打印、限时完成，再集中订正。</p><a class="text-link" href="downloads/all-student.pdf" download>下载旧版三科学生版 →</a><span style="color:#cbd1d6;margin:0 9px">/</span><a class="text-link" href="downloads/all-answers.pdf" download>旧版答案解析 →</a></div></article><article class="info-card"><span class="info-icon">≋</span><div><h3>题型有依据，材料可回溯</h3><p>保留上传样卷，记录结构与分值。<br>这套模拟卷从哪里出发，随时可以查阅。</p><button class="text-link" data-action="blueprint">查看题型蓝图 →</button></div></article></div><div class="archive-note">语文默认使用文学素养提升版，采用一篇中国、一篇外国作家的真实节选；题型依据上传的“笔试预测题”，难度尚未经实测等值。<br>网站材料随版本保存；在线练习记录保存在本浏览器，可导出备份。</div>`;
}
function renderSources(){
  $('#screen').innerHTML=`<div class="page-heading"><h1>原始样卷</h1><p>保留上传文件原貌，让每一次仿编都有可回溯的起点。</p></div><div class="notice">${bank.sourceNote}</div><div class="source-list">${bank.sources.map(s=>`<article class="source-row"><div class="file-icon">${s.format.startsWith('PNG')?'IMG':'PDF'}</div><div><h3>${s.title}</h3><p>${s.description}</p><span class="file-meta">${s.subject} &nbsp; / &nbsp; ${s.format}</span></div><a class="btn secondary" href="${s.path}" target="_blank" rel="noopener">打开资料 <span class="arrow">↗</span></a></article>`).join('')}</div><div class="archive-note">语文拼接版只调整浏览顺序，不改写、不推测缺失的原文。英语原文件中的手写选项及批注不作为新编卷的答案。</div>`;
}
function renderBlueprint(){
  $('#screen').innerHTML=`<div class="page-heading"><h1>题型蓝图</h1><p>三科均按上传样卷保留 100 分、60 分钟与全选择题形式。本版共 95 题，不额外加入作文、翻译或数学解答题。</p></div><div class="blueprint-grid">${bank.blueprint.map(b=>`<article class="blueprint-card"><h2>${b.subject}</h2><div><h3>上传样卷</h3><p>${b.original}</p></div><div><h3>模拟卷 A</h3><p>${b.mock}</p></div><div><h3>重点能力</h3><p>${b.focus}</p></div><div><h3>难度处理</h3><p>${b.difficulty}</p></div></article>`).join('')}</div><div class="notice" style="margin-top:24px">${bank.calibration}</div><div class="info-card"><span class="info-icon">↗</span><div><h3>选材与核对来源</h3><p>语文现代文选自鲁迅《在酒楼上》与芥川龙之介《鼻子》（鲁迅旧译），均据公有领域版本整理；英文材料为命题原创，古文及古诗保留原有出处。</p>${bank.papers.flatMap(p=>p.sources||[]).map(s=>`<p><a class="text-link" href="${escapeHTML(s.url)}" target="_blank" rel="noopener">${escapeHTML(s.title)} ↗</a></p>`).join('')}</div></div>`;
}
function renderRecords(){
  const attempts=[...practice.attempts].reverse();
  $('#screen').innerHTML=`<div class="page-heading"><h1>本机练习</h1><p>${bank.storageNote}</p></div><div class="toolbar"><button class="btn primary" data-action="export">导出练习记录</button><button class="btn secondary" data-action="import">导入记录备份</button></div>${!storageAvailable?'<div class="notice">当前浏览器未能正常读取或保存记录，请及时导出备份。</div>':''}${attempts.length?`<div class="record-list">${attempts.map(r=>{const p=allPapers().find(p=>p.id===r.paperId);return `<article class="record-row"><div class="record-score">${r.score}<small>/100</small></div><div class="record-detail"><h3>${p.title}</h3><p>${new Date(r.date).toLocaleString('zh-CN',{hour12:false})} · 已答 ${r.answered}/${p.count} · 答对 ${r.correct} · 用时 ${formatDuration(r.elapsed)}</p></div><button class="btn secondary" data-open="${p.id}">返回试卷</button></article>`}).join('')}</div>`:`<div class="empty-state"><div class="empty-mark">◷</div><h2>还没有提交的练习</h2><p>打开一科模拟卷，完成作答后点击“提交并计分”。<br>查看参考答案不会被记为完成练习。</p><button class="btn primary" data-action="library">选择一科开始</button></div>`}`;
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
  const paragraphs=b.poem?`<p class="poem">${escapeHTML(b.text)}</p>`:b.paragraphs.map((para,i)=>`<p>${p.subject==='英语'&&b.title.startsWith('Passage')?'<span style="font:10px Arial;color:#9aa6b0">['+(i+1)+']</span> ':''}${para}</p>`).join('');
  return `<article class="reading ${p.subject==='英语'?'english-text':''}"><h3>${b.title}</h3><div class="reading-source">${b.source||''}${b.sourceUrl?' · <a href="'+escapeHTML(b.sourceUrl)+'" target="_blank" rel="noopener">原文出处 ↗</a>':''}</div>${paragraphs}${b.note?'<div class="reading-note">'+b.note+'</div>':''}</article>`;
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
  $('#screen').innerHTML=`<button class="back-link" data-action="library">← 返回试卷资料库</button><header class="exam-header"><div><h1>${p.title}</h1><div class="meta">${p.count} 道单选 · 100 分 · 60 分钟 · v${p.version}</div></div><div class="pdf-links">${p.studentPdf?`<a class="btn secondary" href="${p.studentPdf}" download>下载学生卷 ↧</a><a class="btn secondary" href="${p.answerPdf}" download>下载答案解析 ↧</a>`:`<a class="btn secondary" href="sources/chinese-literary-reference.docx" download>下载参考卷（含答案） ↧</a>`}</div></header><div class="exam-layout"><div class="exam-body"><div class="exam-intro">${p.intro}</div>${p.archived?`<div class="notice">${escapeHTML(p.archiveNote||'这是旧版语文卷，现代文为 AI 生成。')} <button class="text-link" data-open="chinese-a-literary">打开文学素养提升版 →</button></div>`:''}${p.sections.map(sec=>`<section><h2 class="exam-section-title">${sec.title}</h2><p class="exam-section-desc">${sec.description}</p>${sec.blocks.map(b=>reading(b,p)+b.questions.map(q=>questionHTML(q,p,sec)).join('')).join('')}</section>`).join('')}<div class="archive-note">题目与解析为训练材料。完成作答后可在“本机练习”导出记录，用于备份或提交批改。</div></div><aside class="exam-rail" aria-label="作答工具">${currentScore?`<div class="score-box"><div><strong>${currentScore.score}</strong><small>/ 100</small></div><p>答对 ${currentScore.correct}/${qs.length}<br>未答 ${qs.length-currentScore.answered} 题 · 已保存本机记录</p></div>`:''}<div class="timer-card"><div class="rail-label">60 分钟限时练习</div><div id="timer" class="time-value">60:00</div><button class="btn secondary" data-action="timer" id="timer-button">开始计时</button><div class="progress-text"><span id="progress-label">已答 ${answered}/${qs.length}</span><span id="progress-percent">${Math.round(answered/qs.length*100)}%</span></div><div class="progress-bar"><span id="progress-fill" style="width:${answered/qs.length*100}%"></span></div></div><div class="navigator"><div class="rail-label">题目导航</div><div class="question-nav">${qs.map(q=>navButton(q,s)).join('')}</div><label class="wrong-toggle"><input id="wrong-only" type="checkbox" ${wrongOnly?'checked':''} ${!showAnswers?'disabled':''}>仅看错题与未答</label></div><div class="rail-actions"><button class="btn primary" data-action="submit">提交并计分</button><button class="btn secondary" data-action="answers">${showAnswers?'隐藏答案解析':'查看答案解析'}</button><button class="btn ghost" data-action="reset">重新作答</button></div><div class="rail-help">选项自动保存在本浏览器。<br>离开页面或切到后台时暂停计时。<br>首次作答建议先完成，再查看解析。</div></aside></div>`;
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
Promise.all(['bank.json','schools.json','workflows.json','difficulty.json'].map(path=>fetch(path).then(r=>{if(!r.ok)throw Error('内容加载失败');return r.json()}))).then(async ([data,schools,workflows,difficulty])=>{bank=data;Hub.init(schools);StudyFlow.init(workflows);TierStudio.init(difficulty);await PublicApp.init();init();document.querySelectorAll('.sidebar,.topbar').forEach(el=>el.inert=false)}).catch(e=>{$('#screen').innerHTML='<div class="empty-state"><h2>资料暂时未能载入</h2><p>请刷新页面重试。</p><button class="btn primary" onclick="location.reload()">刷新页面</button></div>'});
