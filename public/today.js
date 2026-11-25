'use strict';
// Summary only: never read note bodies, archive payloads, local drafts or model data.
const Today={
 controller:null,serial:0,
 leave(){this.serial++;this.controller?.abort();this.controller=null;},
 render(){
  this.leave();const serial=this.serial,controller=new AbortController();this.controller=controller;
  const screen=document.querySelector('#screen');
  screen.innerHTML=`<header class="today-heading"><h1>今日学习</h1></header>
   <section class="today-shortcuts" aria-label="快捷学习入口">
    <a href="#schools"><strong>学校中心</strong></a>
    <a href="#studio"><strong>组卷工作台</strong></a>
    <a href="#oral"><strong>口试训练</strong></a>
    <a href="/reading-notes"><strong>日本读书笔记</strong></a>
    <a href="#mistakes"><strong>错题库</strong></a>
    <a href="/literature"><strong>文学研习</strong></a>
   </section>
   <section id="today-personal" class="today-personal" aria-live="polite">
    <p class="today-loading">正在读取你的学习记录…</p>
   </section>`;
  const target=screen.querySelector('#today-personal');
  if(!PublicApp.session.authenticated){target.innerHTML='<div class="today-panel"><h2>个人学习记录</h2><p>登录后查看到期复习、最近笔记和学习档案。</p></div>';return;}
  fetch('/api/today',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   if(serial!==this.serial||controller.signal.aborted||currentView!=='today'||!target.isConnected)return;
   target.innerHTML=this.summary(data);
  }).catch(()=>{
   if(serial!==this.serial||controller.signal.aborted||currentView!=='today'||!target.isConnected)return;
   target.innerHTML='<div class="today-panel"><h2>学习记录暂不可用</h2><p>请重新读取个人记录。</p><button type="button" id="today-retry" class="btn secondary">重新读取</button></div>';
   target.querySelector('#today-retry').addEventListener('click',()=>this.render());
  });
 },
 summary(data){
  const e=escapeHTML,num=n=>Number.isSafeInteger(n)&&n>=0?String(n):'—';
  const date=x=>typeof x==='string'?e(x.slice(0,10)):'';
  const noteLink=(n,stamp)=>'<a class="today-record" href="/reading-notes#note/'+encodeURIComponent(n.id)+'"><strong>'+e(n.title)+'</strong><small>'+date(stamp)+'</small></a>';
  const kinds={packet:'训练卷',essay:'作文', 'oral-attempt':'口试记录','written-attempt':'笔试记录','review-attempt':'重做记录','error-set':'错题组'};
  const records=data.recentRecords.map(r=>'<a class="today-record" href="#saved"><strong>'+e(r.title)+'</strong><small>'+e(kinds[r.kind]||'学习档案')+' · '+date(r.updatedAt)+'</small></a>').join('');
  return '<div class="today-section-heading"><div><h2>我的学习记录</h2><p>'+e(data.today)+' · 北京时间统计（已保存的数据）</p></div></div><div class="today-metrics">'+[['到期笔记',data.dueCount],['累计错题组',data.errorSets],['今日更新笔记',data.notesUpdatedToday],['今日更新档案',data.recordsUpdatedToday]].map(([label,n])=>'<div><strong>'+num(n)+'</strong><span>'+label+'</span></div>').join('')+'</div><div class="today-columns"><article class="today-panel"><div class="today-panel-head"><h3>到期复习</h3><a href="/reading-notes">全部复习</a></div>'+(data.due.length?data.due.map(n=>noteLink(n,n.reviewOn)).join(''):'<p>没有已设置日期且到期的笔记。</p>')+(data.dueCount>data.due.length?'<p>还有更多到期笔记，请打开全部复习。</p>':'')+'</article><article class="today-panel"><div class="today-panel-head"><h3>最近笔记</h3><a href="/reading-notes">笔记库</a></div>'+(data.recentNotes.length?data.recentNotes.map(n=>noteLink(n,n.updatedAt)).join(''):'<p>暂无已保存的正文笔记。</p>')+'</article><article class="today-panel"><div class="today-panel-head"><h3>最近学习档案</h3><a href="#saved">全部档案</a></div>'+(records||'<p>暂无已保存的学习档案。</p>')+'</article></div>';
 }
};
