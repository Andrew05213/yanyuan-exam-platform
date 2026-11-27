'use strict';

const Admissions={
 async request(method='GET',data,version){
  const headers={};
  if(data)headers['Content-Type']='application/json';
  if(version)headers['If-Match']=version;
  const response=await fetch('/api/admissions',{method,headers,cache:'no-store',body:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'暂时无法读取择校规划。');
  return result;
 },
 async render(){
  if(!PublicApp.session.authenticated){PublicApp.gate('登录后保存择校规划');return;}
  const screen=document.querySelector('#screen');
  screen.innerHTML='<section class="page-heading"><h1>保送择校</h1></section><div class="admissions-workspace"><p role="status">正在读取方案…</p></div>';
  const workspace=screen.querySelector('.admissions-workspace');
  try{
   const data=await this.request();
   if(workspace.isConnected)this.editor(workspace,data);
  }catch(err){
   if(!workspace.isConnected)return;
   workspace.innerHTML='<p role="alert"></p><button type="button" class="btn secondary">重试</button>';
   workspace.querySelector('p').textContent=err.message;
   workspace.querySelector('button').addEventListener('click',()=>this.render());
  }
 },
 editor(root,data){
  const e=escapeHTML,plan=data.plan||{year:data.defaultYear,language:'',qualification:'pending',examRegistration:'unknown',schoolIds:[],exams:[]};
  let version=data.version;
  const option=(value,label,selected)=>'<option value="'+e(value)+'"'+(selected===value?' selected':'')+'>'+e(label)+'</option>';
  root.innerHTML='<form class="hub-panel"><fieldset class="admissions-fields"><legend>报考条件</legend><div class="admissions-grid">'+
   '<label>招生年份<input required name="year" type="number" min="2020" step="1" value="'+e(plan.year)+'"></label>'+
   '<label>意向专业语种<select name="language">'+option('','未确定',plan.language)+data.languages.map(x=>option(x,x,plan.language)).join('')+'</select></label>'+
   '<label>外国语中学推荐保送资格<select name="qualification">'+option('pending','待确认',plan.qualification)+option('confirmed','已确认',plan.qualification)+option('denied','不具备',plan.qualification)+'</select></label>'+
   '<label>当年普通高考报名条件<select name="examRegistration">'+option('unknown','待确认',plan.examRegistration)+option('yes','符合',plan.examRegistration)+option('no','不符合',plan.examRegistration)+'</select></label></div>'+
   '<fieldset class="admissions-schools"><legend>候选院校</legend>'+data.schools.map(s=>'<label><input type="checkbox" name="school" value="'+e(s.id)+'"'+(plan.schoolIds.includes(s.id)?' checked':'')+'>'+e(s.name)+'</label>').join('')+'</fieldset>'+
   '<details class="admissions-schedule"><summary>考试日程（北京时间）</summary>'+
   '<p>有准考证或校方通知后再填写时间。异地出行请填写上一场考点和所需交通时间。</p>'+
   data.schools.map(s=>'<fieldset data-exam="'+e(s.id)+'"><legend>'+e(s.name)+'</legend><div data-slots></div><button class="btn secondary" type="button" data-add-exam>添加一场考试</button></fieldset>').join('')+
   '</details><div class="toolbar"><button type="submit" value="preview" class="btn primary">查看资格与冲突</button><button type="submit" value="save" class="btn secondary">保存方案</button><button type="button" data-delete-plan class="btn secondary"'+(!version?' hidden':'')+'>删除已保存方案</button></div></fieldset>'+
   '<p role="status" aria-live="polite"></p></form><div class="admissions-results"></div>';
  const form=root.querySelector('form'),inputs=form.querySelector('.admissions-fields'),message=form.querySelector('[role=status]');
  const output=root.querySelector('.admissions-results'),deleteButton=form.querySelector('[data-delete-plan]');
  const display=(analysis,exams)=>{output.innerHTML=this.summary(analysis,exams,data.schools);};
  const showSelected=()=>{
   const selected=new FormData(form).getAll('school');
   for(const item of form.querySelectorAll('[data-exam]')){
    const enabled=selected.includes(item.dataset.exam);
    item.hidden=!enabled;item.disabled=!enabled;
   }
  };
  const addExam=(group,exam={})=>{
   const body=group.querySelector('[data-slots]');
   if(form.querySelectorAll('[data-slot]').length>=12)return;
   const row=document.createElement('div');row.className='admissions-grid admissions-slot';row.dataset.slot='';
   const field=(key,label,type,properties='')=>'<label>'+label+'<input name="'+key+'" type="'+type+'" '+properties+' value="'+e(exam[key]??'')+'"></label>';
   row.innerHTML=field('start','开考','datetime-local','required')+field('end','结束','datetime-local','required')+
    field('location','考点','text','maxlength="80"')+field('from','从何处出发','text','maxlength="80"')+
    field('travelMinutes','交通时间（分钟）','number','min="0" max="10080" step="1"')+
    '<button type="button" class="btn secondary">移除这场考试</button>';
   row.querySelector('button').addEventListener('click',()=>{row.remove();clearPreview();});
   body.append(row);
  };
  const clearPreview=()=>{output.replaceChildren();message.textContent='';};
  for(const group of form.querySelectorAll('[data-exam]')){
   for(const exam of plan.exams.filter(exam=>exam.schoolId===group.dataset.exam))addExam(group,exam);
   group.querySelector('[data-add-exam]').addEventListener('click',()=>{addExam(group);clearPreview();});
  }
  showSelected();
  if(data.analysis)display(data.analysis,plan.exams);
  form.addEventListener('input',clearPreview);
  form.addEventListener('change',showSelected);
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const f=new FormData(form),schoolIds=f.getAll('school');
   if(!schoolIds.length){message.textContent='请至少选择一所院校。';return;}
   const exams=[];
   for(const group of form.querySelectorAll('[data-exam]:not([disabled])'))for(const row of group.querySelectorAll('[data-slot]')){
    const value=key=>row.querySelector('[name='+key+']').value;
    exams.push({schoolId:group.dataset.exam,start:value('start'),end:value('end'),location:value('location'),from:value('from'),
     travelMinutes:value('travelMinutes')===''?null:Number(value('travelMinutes'))});
   }
   const next={year:Number(f.get('year')),language:f.get('language'),qualification:f.get('qualification'),examRegistration:f.get('examRegistration'),schoolIds,exams};
   const save=event.submitter?.value==='save';
   inputs.disabled=true;message.textContent=save?'正在保存…':'正在核对…';
   try{
    const result=await this.request(save?'PUT':'POST',save?{plan:next,version}:next);
    if(!root.isConnected)return;
    if(save){version=result.version;deleteButton.hidden=false;}
    display(result.analysis,next.exams);
    message.textContent=save?'方案已保存。':'已生成核对结果。';
   }catch(err){message.textContent=err.message;}
   finally{inputs.disabled=false;}
  });
  deleteButton.addEventListener('click',async()=>{
   if(!version||!window.confirm('删除已保存的择校方案？'))return;
   inputs.disabled=true;
   try{await this.request('DELETE',null,version);if(root.isConnected)await this.render();}
   catch(err){message.textContent=err.message;}
   finally{inputs.disabled=false;}
  });
 },
 summary(analysis,exams,schools){
  const e=escapeHTML;
  const statuses={eligible:'满足已录入条件，仍需校方确认',conditional:'待确认',excluded:'不满足已录入条件'};
  const paths={gaokao_fallback:'建议按高考路径准备。',parallel_keep_gaokao:'资格待确认，保留高考备考。',conditional_admissions:'继续核对招生条件与报名时间。'};
  const conflictLabels={clear:'按已填信息未见冲突',conflict:'时间重叠或交通时间不足',unknown:'时间、地点或交通信息不足'};
  const schoolName=id=>schools.find(s=>s.id===id)?.name||id;
  return '<section class="hub-panel"><h2>资格核对</h2><p>'+e(paths[analysis.path])+'</p><div class="admissions-grid">'+analysis.results.map(s=>{
   const p=s.policy;
   return '<article class="admissions-card"><h3>'+e(s.name)+'</h3><strong>'+e(statuses[s.status])+'</strong>'+
    (p?'<p>'+(s.historical?'历史参考 · ':'招生简章 · ')+e(p.year)+' 年</p><p>报名 '+e(p.registration)+'</p><p>'+e(p.condition)+'</p><p>专业 '+e(p.eligibleLanguages.join('、'))+'</p><a href="'+e(p.source)+'" target="_blank" rel="noopener noreferrer">查看官方简章 ↗</a>':'')+
    '<div class="toolbar"><a href="'+e(s.notices)+'" target="_blank" rel="noopener noreferrer">查最新公告 ↗</a><a href="#school/'+e(s.id)+'">学校训练</a></div></article>';
  }).join('')+'</div></section><section class="hub-panel"><h2>日程冲突</h2>'+
  (!analysis.conflicts.length?'<p>至少填写两场考试，才能比较日程。</p>':'<ul>'+analysis.conflicts.map(c=>{
   const a=exams[c.first],b=exams[c.second];
   return '<li>'+e(schoolName(a.schoolId)+' '+a.start.replace('T',' '))+' 与 '+e(schoolName(b.schoolId)+' '+b.start.replace('T',' '))+' · '+e(conflictLabels[c.status])+'</li>';
  }).join('')+'</ul>')+'</section>';
 }
};
