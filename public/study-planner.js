'use strict';
// Own-account private planner; no AI calls or external storage.
const StudyPlanner={
 serial:0,controller:null,root:null,data:null,tab:'tasks',manual:[],selected:new Set(),preview:null,busy:false,
 leave(){this.serial++;this.controller?.abort();this.controller=null;this.root=null;this.data=null;this.busy=false;},
 async request(body,date,signal){
  const r=await fetch('/api/study-plans'+(body?'':'?date='+encodeURIComponent(date)),{credentials:'same-origin',cache:'no-store',signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'操作失败');return d;
 },
 mount(root,date){this.leave();this.root=root;this.tab='tasks';void this.load(date);},
 async load(date){
  const root=this.root;if(!root)return;const run=++this.serial;this.controller?.abort();const ctrl=new AbortController();this.controller=ctrl;this.busy=false;
  root.innerHTML='<div class="today-panel"><p>读取学习计划…</p></div>';
  try{const data=await this.request(null,date,ctrl.signal);if(run!==this.serial||!root.isConnected)return;
   this.data=data;this.manual=data.plan.tasks.filter(t=>t.kind==='manual'&&t.status==='planned'&&t.actualMinutes===null&&!t.note).map(t=>({...t}));if(data.version===null)this.manual=data.preferences.routines.filter(r=>r.days.includes((new Date(data.date+'T00:00:00Z').getUTCDay()+6)%7)).map(r=>({...r,id:'manual-'+r.id}));this.selected=new Set(data.version===null?data.candidates.filter(t=>data.preferences.allowedKinds.includes(t.kind)&&(!t.due||t.due<=data.date)).map(t=>t.id):data.plan.tasks.filter(t=>t.kind!=='manual').map(t=>t.id).filter(id=>data.candidates.some(s=>s.id===id)));
   this.preview=null;this.render();
  }catch(err){if(run!==this.serial||ctrl.signal.aborted||!root.isConnected)return;root.innerHTML='<div class="today-panel"><p class="sp-error">'+escapeHTML(err.message||'读取失败')+'</p><button class="btn secondary" type="button" data-sp-retry>重试</button></div>';root.querySelector('[data-sp-retry]').onclick=()=>this.load(date);}
 },
 e(s){return escapeHTML(String(s??''));},
 option(values,selected){return values.map(v=>'<option value="'+this.e(v)+'"'+(v===selected?' selected':'')+'>'+this.e(v)+'</option>').join('');},
 subjectOptions(selected='其他'){return this.option(['英语','语文','数学','国别','日语','法语','其他语种','研究','其他'],selected);},
 statusLabel(s){return ({planned:'未开始',done:'完成',partial:'部分完成',skipped:'跳过'})[s]||'未知';},
 sourceHref(t){const href=t.href||'';return /^(#(?:mistakes|oral|projects|task\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)|\/reading-notes#note\/[A-Za-z0-9_-]+)$/.test(href)?href:'';},
 stat(s){return '<div class="sp-grid">'+[['任务完成',s.done+' / '+s.total],['完成率',s.completion===null?'—':Math.round(s.completion*100)+'%'],['计划 / 休息',s.plannedMinutes+' / '+s.breakMinutes+' 分'],['实际记录用时',s.actualMinutes===null?'未记录':s.actualMinutes+' 分']].map(([k,v])=>'<div class="sp-stat"><strong>'+this.e(v)+'</strong><small>'+k+'</small></div>').join('')+'</div>';},
 render(){
  const d=this.data,root=this.root;if(!d||!root)return;const e=s=>this.e(s),p=d.plan;
  const dayStats=d.week.find(x=>x.date===d.date)||{done:0,total:0,completion:null,plannedMinutes:0,breakMinutes:0,actualMinutes:null};
  const tracks=[...new Set([...p.tasks,...d.candidates].map(t=>t.track))];
  root.innerHTML='<section class="today-panel study-planner"><header class="sp-heading"><div><p>STUDY WORKSPACE · 双线学习</p><h2>每日任务与复盘</h2></div><div class="sp-inline"><label>日期 <input type="date" data-sp-date value="'+e(d.date)+'"></label><button type="button" class="btn secondary" data-sp-today>今天</button></div></header><div class="sp-week">'+d.week.map((w,i)=>'<button type="button" data-sp-day="'+e(w.date)+'" aria-current="'+(w.date===d.date)+'"><span>'+['一','二','三','四','五','六','日'][i]+'</span><strong>'+e(w.date.slice(5))+'</strong><small>'+(w.saved?w.done+'/'+w.total:'—')+'</small></button>').join('')+'</div>'+this.stat(dayStats)+'<div class="sp-progress" role="progressbar" aria-label="每日完成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round((dayStats.completion??0)*100)+'"><span style="width:'+Math.round((dayStats.completion??0)*100)+'%"></span></div><p class="sp-note">计划用时不是实际用时。完成率仅按计划任务计算，未记录不记为零；不强制补做或延长学习。</p><div class="sp-tabs">'+[['tasks','任务面板'],['week','周完成率'],['settings','长期计划'],['review','待复习与薄弱项'],['reflection','学习记录与复盘']].map(([k,v])=>'<button type="button" class="btn secondary" data-sp-tab="'+k+'" aria-pressed="'+(this.tab===k)+'">'+v+'</button>').join('')+'</div><p role="status" data-sp-message></p><div data-sp-body></div></section>';
  root.querySelector('[data-sp-date]').onchange=ev=>this.load(ev.target.value);
  root.querySelector('[data-sp-today]').onclick=()=>this.load(d.today);
  root.querySelectorAll('[data-sp-day]').forEach(b=>b.onclick=()=>this.load(b.dataset.spDay));
  root.querySelectorAll('[data-sp-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.spTab;this.render();});
  const body=root.querySelector('[data-sp-body]');
  if(this.tab==='tasks'){
   body.innerHTML=this.budgetMarkup()+this.quickAddMarkup()+'<div class="sp-form"><details><summary>高级排程</summary><div class="sp-form"><details><summary>选择来自择校、笔记、错题和研究的任务</summary><div class="sp-sources">'+(d.candidates.length?d.candidates.map(s=>'<label><input type="checkbox" data-sp-source="'+e(s.id)+'" '+(this.selected.has(s.id)?'checked':'')+'><span>'+e(s.title)+'<br><small>'+e(s.sourceLabel)+' · '+e(s.track)+' · '+s.minutes+' 分'+(s.due?' · '+e(s.due):'')+'</small></span></label>').join(''):'<p>没有可安排的关联任务，可添加自定义任务。</p>')+'</div>'+(d.truncated?'<p class="sp-note">候选范围有截断，其他任务请从原模块查看。</p>':'')+'</details><details><summary>自定义任务（添加、编辑、删除）</summary><div data-sp-manual></div><button class="btn secondary" type="button" data-sp-add>添加任务</button></details><div class="sp-inline"><button class="btn primary" type="button" data-sp-preview>预览计划</button><button class="btn secondary" type="button" data-sp-save disabled>确认保存</button></div><div data-sp-preview-box></div></div></details><div class="sp-filters"><select data-sp-subject aria-label="筛选科目"><option value="">全部科目</option>'+this.subjectOptions('')+'</select><select data-sp-track aria-label="筛选主线"><option value="">全部主线</option>'+this.option(tracks,'')+'</select><select data-sp-status aria-label="筛选状态"><option value="">全部状态</option><option value="planned">未开始</option><option value="partial">部分完成</option><option value="done">已完成</option><option value="skipped">已跳过</option></select></div><div class="sp-list" data-sp-tasks></div>'+(d.version?'<button type="button" class="btn secondary" data-sp-delete>删除本日计划与复盘</button>':'')+'</div>';
   this.bindQuickAdd(body);this.manualRender();this.tasksRender();
   const invalidate=()=>{this.preview=null;body.querySelector('[data-sp-save]').disabled=true;body.querySelector('[data-sp-preview-box]').innerHTML='';};
   body.querySelector('[data-sp-budget-form]').onsubmit=ev=>{
    ev.preventDefault();
    const budgetMinutes=ev.target.elements.budgetMinutes.valueAsNumber;
    if(budgetMinutes!==p.budgetMinutes)void this.mutate('set-budget',{budgetMinutes});
   };
   body.querySelectorAll('[data-sp-source]').forEach(b=>b.onchange=()=>{b.checked?this.selected.add(b.dataset.spSource):this.selected.delete(b.dataset.spSource);invalidate();});
   body.querySelector('[data-sp-add]').onclick=()=>{this.collectManual();if(this.manual.length>=40)return;this.manual.push({id:'manual-'+crypto.randomUUID(),title:'',subject:'其他',track:'通用训练',minutes:15,priority:1});this.manualRender();body.querySelectorAll('[data-sp-manual] [name=title]').item(this.manual.length-1)?.focus();invalidate();};
   body.querySelector('[data-sp-manual]').addEventListener('input',invalidate);
   body.querySelector('[data-sp-manual]').addEventListener('change',invalidate);
   body.querySelector('[data-sp-manual]').addEventListener('click',ev=>{if(ev.target.closest('[data-sp-remove]'))invalidate();});
   for(const k of ['subject','track','status'])body.querySelector('[data-sp-'+k+']').onchange=()=>this.tasksRender();
   body.querySelector('[data-sp-preview]').onclick=()=>{this.collectManual();void this.mutate('preview',{budgetMinutes:p.budgetMinutes,selected:[...this.selected],manual:this.manual});};
   body.querySelector('[data-sp-save]').onclick=()=>{if(this.preview)void this.mutate('save',this.preview.input);};
   body.querySelector('[data-sp-delete]')?.addEventListener('click',()=>{if(confirm('删除本日计划、复习反馈及复盘？原始笔记和学习档案不会被删除。'))void this.mutate('delete',{confirm:true});});
  }else if(this.tab==='settings'){
   StudyLongTerm.render(this,body);
  }else if(this.tab==='week'){
   const s=d.weekStats;body.innerHTML='<h3>本周进度</h3>'+this.stat(s)+'<p class="sp-note">有保存记录 '+s.days+' 天 · 有完成记录 '+s.daysWithCompletion+' 天 · 实际用时填写 '+s.reported+'/'+s.recordCount+' 条</p><table class="sp-table"><thead><tr><th>科目</th><th>计划（分）</th><th>已记录实际（分）</th></tr></thead><tbody>'+Object.entries(s.subjects).map(([k,v])=>'<tr><td>'+e(k)+'</td><td>'+v.planned+'</td><td>'+(v.reported?v.actual:'—')+'</td></tr>').join('')+'</tbody></table><h3>备考主线投入</h3><table class="sp-table"><thead><tr><th>主线</th><th>计划（分）</th><th>已记录实际（分）</th></tr></thead><tbody>'+Object.entries(s.tracks).map(([k,v])=>'<tr><td>'+e(k)+'</td><td>'+v.planned+'</td><td>'+(v.reported?v.actual:'—')+'</td></tr>').join('')+'</tbody></table><p class="sp-note">按周内全部已保存计划统计，不以完成率评价个人能力。</p>';
  }else if(this.tab==='review'){
   const review=d.candidates.filter(s=>['note-review','error-review'].includes(s.kind));
   body.innerHTML='<h3>复习队列</h3><p class="sp-note">已到期优先，未来复习可提前查看。复习后的日期建议在任务反馈中确认。</p><div class="sp-list">'+(review.length?review.map(s=>'<div class="sp-task"><strong>'+e(s.title)+'</strong><p>'+e(s.sourceLabel)+' · '+e(s.due||'未安排')+' · '+(s.due&&s.due>d.date?'未来':'可复习')+'</p><a href="'+e(this.sourceHref(s))+'">打开来源</a>'+(d.date===d.today?'<form data-review-reschedule="'+e(s.id)+'" class="sp-form"><label>调整下次复习日期<input type="date" name="due" min="'+e(d.today)+'" required value="'+e(s.due&&s.due>=d.today?s.due:d.today)+'"></label><button class="btn secondary">确认改期</button></form>':'')+'</div>').join(''):'<p>尚无关联的复习任务。</p>')+'</div><div data-sp-report>正在读取真实练习报告…</div><a href="#report">完整学习报告 →</a><h3>复习反馈历史</h3><div class="sp-list">'+(d.reviewHistory.length?d.reviewHistory.map(h=>'<div class="sp-task"><strong>'+e(h.title)+'</strong><p>'+e(h.day)+' · '+e(({again:'再次学习',hard:'困难',good:'已理解'})[h.outcome]||h.outcome)+' · 下次 '+e(h.due)+'</p></div>').join(''):'<p>暂无已确认复习反馈。</p>')+'</div>'+(d.reviewHistoryTruncated?'<p class="sp-note">仅显示最近100条。</p>':'');
   body.querySelectorAll('[data-review-reschedule]').forEach(form=>form.onsubmit=ev=>{ev.preventDefault();const s=d.candidates.find(t=>t.id===form.dataset.reviewReschedule);if(s)void this.mutate('reschedule',{taskId:s.id,due:form.querySelector('[name=due]').value,rescheduleVersion:s.rescheduleVersion??null});});
   const run=this.serial;fetch('/api/learning-report',{cache:'no-store',signal:this.controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(r=>{const target=body.querySelector('[data-sp-report]');if(run!==this.serial||!target?.isConnected)return;target.innerHTML='<h3>优先复习知识点</h3>'+(r.tags.length?r.tags.slice(0,5).map(t=>'<p>'+e(t.subject)+' · '+e(t.tag)+'（'+e(t.uniqueWrong)+' 道不同错题）</p>').join(''):'<p>尚无足够的真实错题证据。</p>')+(r.truncated?'<p class="sp-note">报告数据有截断。</p>':'');}).catch(()=>{const target=body.querySelector('[data-sp-report]');if(run===this.serial&&target?.isConnected)target.textContent='学习报告暂不可用。';});
  }else{
   body.innerHTML='<div class="sp-form sp-reflection"><h3>今天实际做了什么</h3>'+p.tasks.map(t=>'<p>'+e(t.title)+' · '+e(this.statusLabel(t.status))+' · '+(t.actualMinutes===null?'未记录用时':t.actualMinutes+' 分')+(t.note?' · '+e(t.note):'')+'</p>').join('')+'<h3>额外练习</h3>'+p.extra.map(t=>'<div class="sp-task"><strong>'+e(t.title)+'</strong><p>'+e(t.subject)+' · '+(t.actualMinutes===null?'未记录用时':t.actualMinutes+' 分')+' · '+e(t.note)+'</p><button type="button" class="btn secondary" data-sp-extra-remove="'+e(t.id)+'">删除此记录</button></div>').join('')+(d.date<=d.today?'<form data-sp-extra class="sp-form"><label>练习名称<input required name="title" maxlength="200"></label><label>科目<select name="subject">'+this.subjectOptions()+'</select></label><label>主线<input name="track" value="通用训练" required maxlength="80"></label><label>实际用时（分钟，可空）<input name="actualMinutes" type="number" min="0" max="1440"></label><label>真实练习记录<textarea name="note" maxlength="1000"></textarea></label><button class="btn secondary">记录额外练习</button></form><form class="sp-form" data-sp-reflection><h3>每日复盘</h3><label>今天最大的问题<textarea name="challenge" maxlength="2000">'+e(p.reflection.challenge)+'</textarea></label><label>我的判断<textarea name="judgment" maxlength="2000">'+e(p.reflection.judgment)+'</textarea></label><label>明天的改进<textarea name="next" maxlength="2000">'+e(p.reflection.next)+'</textarea></label><button class="btn primary">保存复盘</button></form>':'<p>未来日期不能记录实际学习或复盘。</p>')+'</div>';
   body.querySelector('[data-sp-extra]')?.addEventListener('submit',ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target));void this.mutate('extra',{...f,id:'extra-'+crypto.randomUUID(),actualMinutes:f.actualMinutes===''?null:Number(f.actualMinutes)});});
   body.querySelector('[data-sp-reflection]')?.addEventListener('submit',ev=>{ev.preventDefault();void this.mutate('reflection',Object.fromEntries(new FormData(ev.target)));});
   body.querySelectorAll('[data-sp-extra-remove]').forEach(b=>b.onclick=()=>{if(confirm('删除这条额外练习记录？'))void this.mutate('remove-extra',{id:b.dataset.spExtraRemove});});
  }
 },
 budgetMarkup(){
  const plan=this.data.plan;
  const used=plan.tasks.reduce((total,t)=>total+t.minutes+t.breakBefore,0);
  const over=used-plan.budgetMinutes;
  return `<form class="sp-budget" data-sp-budget-form>
   <label>当天可用时间（分钟）<input type="number" name="budgetMinutes" data-sp-budget min="0" max="180" required value="${plan.budgetMinutes}"></label>
   <button class="btn secondary">保存预算</button>
   ${over>0?`<p class="sp-note">已安排 ${used} 分钟，超出预算 ${over} 分钟。已有任务保留。</p>`:''}
  </form>`;
 },
 quickAddMarkup(){
  return `<form class="sp-quick-add" data-sp-quick>
   <label>新任务<input name="title" maxlength="200" placeholder="例如：做一篇英语阅读" required></label>
   <label>预计用时<select name="minutes">${[5,10,15,20,25].map(n=>`<option value="${n}" ${n===15?'selected':''}>${n} 分钟</option>`).join('')}</select></label>
   <button class="btn primary">添加任务</button>
   <p class="sp-note" data-sp-quick-budget></p>
   <label class="sp-quick-expand" hidden><input type="checkbox" name="expandBudget"><span></span></label>
  </form>`;
 },
 bindQuickAdd(body){
  const plan=this.data.plan;
  const form=body.querySelector('[data-sp-quick]');
  const {title,minutes,expandBudget}=form.elements;
  const used=plan.tasks.reduce((total,t)=>total+t.minutes+t.breakBefore,0);
  const rest=plan.tasks.length?5:0;
  const hint=form.querySelector('[data-sp-quick-budget]');
  const option=expandBudget.closest('label');
  const update=()=>{
   const required=used+rest+Number(minutes.value);
   option.hidden=required<=plan.budgetMinutes||required>180;
   expandBudget.required=!option.hidden;
   expandBudget.checked=false;
   option.querySelector('span').textContent='将当天预算调至 '+required+' 分钟';
   hint.textContent=required>180
    ?'已达到当天的时间上限。请选择更短的时长或其他日期。'
    :'当前剩余 '+Math.max(0,plan.budgetMinutes-used)+' 分钟'+(rest?'，添加任务会预留 5 分钟休息。':'。');
  };
  minutes.onchange=update;
  title.oninput=()=>title.setCustomValidity('');
  form.onsubmit=ev=>{
   ev.preventDefault();
   if(!title.value.trim()){
    title.setCustomValidity('请输入任务名称。');
    title.reportValidity();
    return;
   }
   void this.mutate('add-task',{id:'manual-'+crypto.randomUUID(),title:title.value.trim(),minutes:Number(minutes.value),expandBudget:expandBudget.checked});
  };
  update();
 },
 collectManual(){const root=this.root?.querySelector('[data-sp-manual]');if(!root)return;this.manual=[...root.querySelectorAll('[data-sp-manual-id]')].map(el=>({id:el.dataset.spManualId,title:el.querySelector('[name=title]').value,subject:el.querySelector('[name=subject]').value,track:el.querySelector('[name=track]').value,minutes:Number(el.querySelector('[name=minutes]').value),priority:Number(el.querySelector('[name=priority]').value)}));},
 manualRender(){const root=this.root.querySelector('[data-sp-manual]'),e=s=>this.e(s);root.innerHTML=this.manual.map(t=>'<div class="sp-task" data-sp-manual-id="'+e(t.id)+'"><label>任务名称<input name="title" maxlength="200" value="'+e(t.title)+'"></label><label>科目<select name="subject">'+this.subjectOptions(t.subject)+'</select></label><label>主线<input name="track" maxlength="80" value="'+e(t.track)+'"></label><label>分钟<select name="minutes">'+[5,10,15,20,25].map(n=>'<option '+(n===t.minutes?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>优先级<select name="priority">'+[0,1,2].map(n=>'<option value="'+n+'" '+(n===t.priority?'selected':'')+'>'+['低','普通','优先'][n]+'</option>').join('')+'</select></label><button type="button" class="btn secondary" data-sp-remove="'+e(t.id)+'">移除</button></div>').join('');root.querySelectorAll('[data-sp-remove]').forEach(b=>b.onclick=()=>{this.collectManual();this.manual=this.manual.filter(t=>t.id!==b.dataset.spRemove);this.manualRender();this.preview=null;this.root.querySelector('[data-sp-save]').disabled=true;this.root.querySelector('[data-sp-preview-box]').innerHTML='';});},
 tasksRender(){
  const root=this.root,d=this.data,p=d.plan,e=s=>this.e(s),f=k=>root.querySelector('[data-sp-'+k+']').value,container=root.querySelector('[data-sp-tasks]');
  const tasks=p.tasks.filter(t=>(!f('subject')||t.subject===f('subject'))&&(!f('track')||t.track===f('track'))&&(!f('status')||t.status===f('status')));
  container.innerHTML=tasks.length?tasks.map(t=>{const source=d.candidates.find(s=>s.id===t.id),href=this.sourceHref(source||{href:''}),canReview=!!source&&['note-review','error-review'].includes(t.kind)&&!t.review&&d.date===d.today;
   return '<article class="sp-task" data-sp-task="'+e(t.id)+'"><div class="sp-inline"><h3>'+e(t.title)+'</h3><span class="sp-status">'+e(this.statusLabel(t.status))+'</span>'+(d.date<=d.today?'<label class="sp-inline"><input type="checkbox" data-sp-done '+(t.status==='done'?'checked':'')+'> 完成</label>':'')+'</div><p>'+e(t.subject)+' · '+e(t.track)+' · '+t.minutes+' 分 · '+e(t.sourceLabel)+(t.breakBefore?' · 前置休息 '+t.breakBefore+' 分':'')+'</p>'+(href?'<a href="'+e(href)+'">打开关联任务 →</a>':t.kind!=='manual'?'<p>来源未在当前候选列表，前往原模块核对。</p>':'')+(t.review?'<p>下次复习：'+e(t.review.due)+'</p>':'')+(d.date<=d.today?'<form data-sp-feedback class="sp-form"><label>完成状态<select name="status">'+Object.entries({planned:'未开始',done:'完成',partial:'部分完成',skipped:'跳过'}).map(([k,v])=>'<option value="'+k+'" '+(k===t.status?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label>实际用时（分钟，可空）<input type="number" name="actualMinutes" min="0" max="1440" value="'+e(t.actualMinutes??'')+'"></label><label>学习记录<textarea name="note" maxlength="1000">'+e(t.note)+'</textarea></label><label>关联已保存学习档案（选填）<select name="evidenceId"><option value="">不关联</option>'+(t.evidence&&!d.attempts.some(a=>a.id===t.evidence.id)?'<option value="'+e(t.evidence.id)+'" selected>此前关联的档案（本次列表未包含）</option>':'')+d.attempts.map(a=>'<option value="'+e(a.id)+'" '+(t.evidence?.id===a.id?'selected':'')+'>'+e(a.title)+' · '+e(a.createdAt.slice(0,10))+'</option>').join('')+'</select></label><p class="sp-note">只关联本人已保存的作答或作文档案，不复制或改写成绩。'+(d.attemptsTruncated?'此处仅列最近50份档案。':'')+'</p>'+(canReview?'<label>复习反馈（选填）<select name="outcome"><option value="">未填写</option><option value="again">再次学习</option><option value="hard">困难</option><option value="good">掌握</option><option value="skip">跳过</option></select></label><label>指定下次复习日（可空，默认系统建议）<input type="date" name="reviewDate"></label>':'')+'<button class="btn secondary">保存反馈</button></form>':'')+'</article>';}).join(''):'<p>暂无符合条件的任务。</p>';
  container.querySelectorAll('[data-sp-feedback]').forEach(form=>form.onsubmit=ev=>{ev.preventDefault();const data=Object.fromEntries(new FormData(form));void this.mutate('feedback',{...data,taskId:form.closest('[data-sp-task]').dataset.spTask,actualMinutes:data.actualMinutes===''?null:Number(data.actualMinutes),evidenceId:data.evidenceId||null});});
  container.querySelectorAll('[data-sp-done]').forEach(box=>box.onchange=()=>{const t=p.tasks.find(t=>t.id===box.closest('[data-sp-task]').dataset.spTask);if(t)void this.mutate('feedback',{taskId:t.id,status:box.checked?'done':'planned',actualMinutes:t.actualMinutes,note:t.note});});
 },
 async mutate(action,input){
  if(this.busy||!this.data||!this.root)return;if(action==='preview')this.preview=null;this.busy=true;const run=this.serial,root=this.root,body=root.querySelector('[data-sp-body]'),msg=root.querySelector('[data-sp-message]');msg.textContent='正在提交…';
  msg.className='';
  const buttons=[...body.querySelectorAll('button,input,select,textarea')],states=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
  try{const result=await this.request({action,date:this.data.date,version:this.data.version,...input},null,this.controller.signal);
   if(run!==this.serial||!root.isConnected)return;
   if(action==='preview'){this.preview={input:{...input,token:result.token},plan:result.plan};const p=result.plan,e=s=>this.e(s);body.querySelector('[data-sp-preview-box]').innerHTML='<div class="sp-preview"><strong>预览 · '+p.tasks.length+' 项</strong><p>安排 '+p.tasks.reduce((n,t)=>n+t.minutes,0)+' 分 + 休息 '+p.tasks.reduce((n,t)=>n+t.breakBefore,0)+' 分；暂缓 '+p.deferred.length+' 项</p>'+p.tasks.map(t=>'<p>'+e(t.title)+' · '+t.minutes+' 分</p>').join('')+'</div>';msg.textContent='预览未写入，确认保存后生效。';}
   else{const date=this.data.date;await this.load(date);if(this.data?.date===date&&this.serial===run+1){this.root?.querySelector('[data-sp-message]')?.replaceChildren(action==='add-task'?'已添加任务。':action==='set-budget'?'已保存当天预算。':'已保存。');if(action==='add-task')this.root?.querySelector('[data-sp-quick] [name=title]')?.focus();}}
  }catch(err){if(run===this.serial&&root.isConnected){msg.textContent=err.message||'操作失败';msg.className='sp-error';}}
  finally{if(run===this.serial){this.busy=false;buttons.forEach((b,i)=>b.disabled=states[i]);const save=body.querySelector('[data-sp-save]');if(save)save.disabled=!this.preview;}}
 }
};
