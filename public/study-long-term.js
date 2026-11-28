'use strict';
// Long-term preferences are explicit, account-scoped; no automatic plan writes.
const StudyLongTerm={
 render(parent,body){
  const d=parent.data,e=s=>parent.e(s),p=JSON.parse(JSON.stringify(d.preferences)),names=['一','二','三','四','五','六','日'],kinds=[['note-review','笔记复习'],['error-review','错题复习'],['target-training','目标校训练'],['project','研究里程碑']];
  body.innerHTML='<section class="sp-form"><h3>长期学习设置</h3><p class="sp-note">设定每周可用时间（含休息），可设0为休息日。保存偏好不自动增加任务、不改动已有日计划。</p><form data-long-form class="sp-form"><div class="sp-grid">'+names.map((n,i)=>'<label>周'+n+'<input type="number" min="0" max="180" required data-long-budget="'+i+'" value="'+p.budgets[i]+'"></label>').join('')+'</div><fieldset><legend>候选来源</legend>'+kinds.map(([k,v])=>'<label class="sp-inline"><input type="checkbox" data-long-kind="'+k+'" '+(p.allowedKinds.includes(k)?'checked':'')+'>'+v+'</label>').join('')+'</fieldset><label>优先主线（可空，填写与任务主线相同名称）<input maxlength="80" data-long-track value="'+e(p.preferredTrack)+'"></label><details open><summary>每周重复任务模板</summary><div data-long-routines class="sp-list"></div><button type="button" class="btn secondary" data-long-add>添加模板</button></details><button class="btn primary">保存长期设置</button></form><section class="sp-task"><h3>整周计划</h3><p>根据当前已保存偏好、实际到期记录及可用时间生成所选日期所在周。仅创建今天及未来的空白日，已有计划和学习记录不变。</p><button type="button" class="btn secondary" data-long-preview>预览本周</button><div data-long-result></div><button type="button" class="btn primary" data-long-save disabled>确认创建本周计划</button></section><p data-long-message role="status"></p></section>';
  const form=body.querySelector('[data-long-form]'),list=body.querySelector('[data-long-routines]'),message=body.querySelector('[data-long-message]'),save=body.querySelector('[data-long-save]');
  let token=null,busy=false,dirty=false;
  function collect(){
   p.budgets=[...form.querySelectorAll('[data-long-budget]')].map(x=>Number(x.value));p.allowedKinds=[...form.querySelectorAll('[data-long-kind]:checked')].map(x=>x.dataset.longKind);p.preferredTrack=form.querySelector('[data-long-track]').value;
   p.routines=[...list.querySelectorAll('[data-routine]')].map(el=>({id:el.dataset.routine,title:el.querySelector('[name=title]').value,subject:el.querySelector('[name=subject]').value,track:el.querySelector('[name=track]').value,minutes:Number(el.querySelector('[name=minutes]').value),priority:Number(el.querySelector('[name=priority]').value),days:[...el.querySelectorAll('[data-routine-day]:checked')].map(x=>Number(x.dataset.routineDay))}));
  }
  function invalidate(){dirty=true;token=null;save.disabled=true;body.querySelector('[data-long-result]').textContent='设置有未保存修改。请先保存。';}
  function draw(){list.innerHTML=p.routines.map(r=>'<article class="sp-task" data-routine="'+e(r.id)+'"><label>任务<input required name="title" maxlength="200" value="'+e(r.title)+'"></label><label>科目<select name="subject">'+parent.subjectOptions(r.subject)+'</select></label><label>主线<input required maxlength="80" name="track" value="'+e(r.track)+'"></label><label>计划分钟<select name="minutes">'+[5,10,15,20,25].map(n=>'<option '+(n===r.minutes?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>优先级<select name="priority">'+[0,1,2].map(n=>'<option value="'+n+'" '+(n===r.priority?'selected':'')+'>'+['低','普通','优先'][n]+'</option>').join('')+'</select></label><div class="sp-inline">'+names.map((n,i)=>'<label class="sp-inline"><input type="checkbox" data-routine-day="'+i+'" '+(r.days.includes(i)?'checked':'')+'>'+n+'</label>').join('')+'</div><button type="button" class="btn secondary" data-routine-remove="'+e(r.id)+'">移除模板</button></article>').join('');list.querySelectorAll('[data-routine-remove]').forEach(b=>b.onclick=()=>{collect();p.routines=p.routines.filter(r=>r.id!==b.dataset.routineRemove);draw();invalidate();});}
  draw();
  form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
  body.querySelector('[data-long-add]').onclick=()=>{collect();if(p.routines.length>=30)return;p.routines.push({id:crypto.randomUUID(),title:'',subject:'其他',track:'通用训练',minutes:15,priority:1,days:[0,1,2,3,4]});draw();invalidate();};
  async function run(action,input){
   if(busy||parent.busy||!body.isConnected)return;busy=true;parent.busy=true;const serial=parent.serial,controls=[...body.querySelectorAll('button,input,select')],old=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);message.textContent='正在处理…';
   try{
    const result=await parent.request({date:d.date,action,preferencesVersion:d.preferencesVersion,...input},null,parent.controller.signal);
    if(serial!==parent.serial||!body.isConnected)return;
    if(action==='week-preview'){token=result.token;body.querySelector('[data-long-result]').innerHTML='<div class="sp-list">'+result.plans.map(p=>'<article class="sp-task"><strong>'+e(p.date)+' · '+p.tasks.length+' 项 · '+p.budgetMinutes+' 分预算</strong>'+p.tasks.map(t=>'<p>'+e(t.title)+' · '+t.minutes+' 分'+(t.breakBefore?'（休息 '+t.breakBefore+' 分）':'')+'</p>').join('')+(p.tasks.length?'':'<p>无安排 / 休息日</p>')+'<p>暂缓 '+p.deferred.length+' 项</p></article>').join('')+'</div><p class="sp-note">保留或跳过 '+result.skipped.length+' 天。'+(result.truncated?'候选来源存在截断。':'')+'</p>';message.textContent='预览未写入。';}
    else{await parent.load(d.date);parent.root?.querySelector('[data-sp-message]')?.replaceChildren(action==='week-save'?'整周计划已创建。':'长期设置已保存。');}
   }catch(err){if(serial===parent.serial&&body.isConnected){message.textContent=err.message||'未完成';message.className='sp-error';token=null;}}
   finally{if(serial===parent.serial){parent.busy=false;busy=false;controls.forEach((x,i)=>x.disabled=old[i]);save.disabled=!token||dirty;}}
  }
  form.onsubmit=ev=>{ev.preventDefault();collect();void run('preferences',{preferences:p});};
  body.querySelector('[data-long-preview]').onclick=()=>{if(dirty){message.textContent='请先保存修改后的长期设置。';return;}token=null;void run('week-preview',{});};
  save.onclick=()=>{if(token&&!dirty)void run('week-save',{token});};
 }
};
