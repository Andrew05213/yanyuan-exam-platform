'use strict';
// Summary only: never read note bodies, archive payloads, local drafts or model data.
const Today={
 controller:null,serial:0,
 leave(){this.serial++;this.controller?.abort();this.controller=null;},
 render(){
  this.leave();const serial=this.serial,controller=new AbortController();this.controller=controller;
  const screen=document.querySelector('#screen');
  screen.innerHTML='<section class="today-heading"><div><p class="today-kicker">和知 AI · LEARNING & RESEARCH</p><h1>今日学习</h1><p>把备考、阅读与研究放在同一个学习入口。</p></div><a class="btn secondary" href="/literature#community">进入研究社区</a></section><section class="today-shortcuts" aria-label="快捷学习入口"><a href="#schools"><small>01 / 备考</small><strong>学校中心</strong><span>按目标高校选择训练</span></a><a href="#studio"><small>02 / 笔试</small><strong>组卷工作台</strong><span>生成专项练习</span></a><a href="#oral"><small>03 / 表达</small><strong>口试训练</strong><span>阅读、口译与演讲</span></a><a href="/literature#notes"><small>04 / 阅读</small><strong>多语种笔记</strong><span>记录、复习与研究</span></a><a href="#mistakes"><small>05 / 复习</small><strong>错题库</strong><span>回看与重做</span></a><a href="/literature#community"><small>06 / 协作</small><strong>研究社区与 AI</strong><span>议题、共享文献与分析</span></a></section><section id="today-personal" class="today-personal" aria-live="polite"><p class="today-loading">正在读取你的学习记录…</p></section>';
  const target=screen.querySelector('#today-personal');
  if(!PublicApp.session.authenticated){target.innerHTML='<div class="today-panel"><h2>个人学习记录</h2><p>登录后查看到期复习、最近笔记和学习档案。上方公开训练入口仍可使用。</p></div>';return;}
  fetch('/api/today',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   if(serial!==this.serial||controller.signal.aborted||currentView!=='today'||!target.isConnected)return;
   target.innerHTML=this.summary(data);
  }).catch(()=>{
   if(serial!==this.serial||controller.signal.aborted||currentView!=='today'||!target.isConnected)return;
   target.innerHTML='<div class="today-panel"><h2>学习记录暂不可用</h2><p>未能读取个人记录，不会显示虚构的统计。</p><button type="button" id="today-retry" class="btn secondary">重新读取</button></div>';
   target.querySelector('#today-retry').addEventListener('click',()=>this.render());
  });
 },
 summary(data){
  const e=escapeHTML,num=n=>Number.isSafeInteger(n)&&n>=0?String(n):'—';
  const date=x=>typeof x==='string'?e(x.slice(0,10)):'';
  const noteLink=n=>'<a class="today-record" href="/literature#note/'+encodeURIComponent(n.id)+'"><strong>'+e(n.title)+'</strong><small>'+date(n.reviewOn||n.updatedAt)+'</small></a>';
  const kinds={packet:'训练卷',essay:'作文', 'oral-attempt':'口试记录','written-attempt':'笔试记录','review-attempt':'重做记录','error-set':'错题组'};
  const records=data.recentRecords.map(r=>'<a class="today-record" href="#saved"><strong>'+e(r.title)+'</strong><small>'+e(kinds[r.kind]||'学习档案')+' · '+date(r.updatedAt)+'</small></a>').join('');
  return '<div class="today-section-heading"><div><h2>我的学习记录</h2><p>'+e(data.today)+' · 北京时间统计（已保存的数据）</p></div></div><div class="today-metrics">'+[['到期笔记',data.dueCount],['累计错题组',data.errorSets],['今日更新笔记',data.notesUpdatedToday],['今日更新档案',data.recordsUpdatedToday]].map(([label,n])=>'<div><strong>'+num(n)+'</strong><span>'+label+'</span></div>').join('')+'</div><div class="today-columns"><article class="today-panel"><div class="today-panel-head"><h3>到期复习</h3><a href="/literature#review">全部复习</a></div>'+(data.due.length?data.due.map(noteLink).join(''):'<p>没有已设置日期且到期的笔记。</p>')+(data.dueCount>data.due.length?'<p>还有更多到期笔记，请打开全部复习。</p>':'')+'</article><article class="today-panel"><div class="today-panel-head"><h3>最近笔记</h3><a href="/literature#notes">笔记库</a></div>'+(data.recentNotes.length?data.recentNotes.map(noteLink).join(''):'<p>暂无已保存的正文笔记。</p>')+'</article><article class="today-panel"><div class="today-panel-head"><h3>最近学习档案</h3><a href="#saved">全部档案</a></div>'+(records||'<p>暂无已保存的学习档案。</p>')+'</article></div><p class="today-footnote">今日更新仅指记录保存或修改，不等同于完成任务数。累计错题组不是未掌握题目数量。</p>';
 }
};
