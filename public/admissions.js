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
   '<label>优先城市（按学校主校所在地，专业校区另核）<select name="city">'+option('','不限',plan.city)+[...new Set(data.schools.map(s=>s.city))].map(c=>option(c,c,plan.city)).join('')+'</select></label>'+
   '<label>本轮训练目标<select name="trainingFocus">'+Object.entries({'':'学校推荐',reading:'朗读理解',speech:'即兴表达',personal:'个人陈述','zh-en':'中译英','en-zh':'英译中'}).map(([k,v])=>option(k,v,plan.trainingFocus)).join('')+'</select></label>'+
   '<fieldset class="admissions-schools"><legend>候选院校</legend>'+data.schools.map(s=>'<label><input type="checkbox" name="school" value="'+e(s.id)+'"'+(plan.schoolIds.includes(s.id)?' checked':'')+'>'+e(s.name)+'</label>').join('')+'</fieldset>'+
   '<details class="admissions-schedule"><summary>考试日程（北京时间）</summary>'+
   '<p>有准考证或校方通知后再填写时间。异地出行请填写上一场考点和所需交通时间。</p>'+
   data.schools.map(s=>'<fieldset data-exam="'+e(s.id)+'"><legend>'+e(s.name)+'</legend><div data-slots></div><button class="btn secondary" type="button" data-add-exam>添加一场考试</button></fieldset>').join('')+
   '</details><div class="toolbar"><button type="submit" value="preview" class="btn primary">查看资格与冲突</button><button type="submit" value="save" class="btn secondary">保存方案</button><button type="button" data-delete-plan class="btn secondary"'+(!version?' hidden':'')+'>删除已保存方案</button></div></fieldset>'+
   '<p role="status" aria-live="polite"></p></form><div class="admissions-results"></div>';

  // Private self-assessment; persisted only with explicit plan save.
  const profile=document.createElement('section');
  profile.className='hub-panel';
  const dimensions=[
   ['学业能力','校内排名水平','目标考试常模水平'],
   ['专业偏好','专业方向明确程度','专业取舍一致程度'],
   ['院校平台','院校层次要求','平台优先程度'],
   ['地域偏好','地域限制程度','地域优先程度'],
   ['职业规划','职业目标明确程度','实现路径明确程度'],
   ['风险偏好','录取风险接受程度','选拔风险接受程度'],
   ['费用约束','常规费用预算比','高费用预算比'],
   ['家庭决策','意见冲突程度','家庭决策影响程度'],
   ['备考路径','目标考试能力证据','高考备选优先程度'],
   ['信息完整性','核心字段覆盖程度','条件偏好一致程度']
  ];
  const anchors=[
   [['后40%','前30–60%','前10–30%','前10%'],['后40%','前30–60%','前10–30%','前10%']],
   [['无偏好','宽泛','明确方向','核心学科'],['不优先','条件性','一次明确取舍','多次一致取舍']],
   [['无要求','灵活','有例外','明确底线'],['其他优先','条件选择','一次平台优先','多次一致']],
   [['无限制','软偏好','区域限制','明确排除'],['不重视','条件选择','一次地域优先','多次一致']],
   [['无目标','宽泛','岗位或方向','行业岗位专业关联'],['无路径','初步','读研就业','具体路径']],
   [['确认当前','特定条件冒险','了解风险后接受','放弃可接受录取'],['拒绝选拔风险','看难度和后果','明确条件后接受','失败仍接受']],
   [['≤60%','≤85%','≤100%','超过100%'],['≤60%','≤85%','≤100%','超过100%']],
   [['一致','轻微','明显可协商','明确否决冲突'],['本人决定','建议','共同决定或影响较大','实际否决权']],
   [['可靠证据明显不足','自评有限','达到参考','充分证据达到目标'],['保送优先','按结果','高考主要备选','明确优先高考']],
   [['0–3项','4–5项','6–7项','8–10项'],['同前提矛盾','重要冲突待解','条件已解释','多情景一致']]
  ];
  profile.innerHTML='<h2>十维学生画像 · 自评预览</h2><p>暂定工程规则，不是心理量表或录取概率。点击保存方案时随私人方案保存，主动点击生成追问时，仅发送当前维度、两项等级及上轮反馈；可跳过任何问题。各维度含义不同，不计算总分。</p><div data-profile-question></div><div class="toolbar"><button type="button" data-prev class="btn secondary">上一维</button><button type="button" data-next class="btn primary">下一维</button></div><div data-profile-result aria-live="polite"></div>';
  root.prepend(profile);
  const answers=dimensions.map((_,i)=>[...(plan.profile?.[i]??[null,null])]);let current=0;
  const question=profile.querySelector('[data-profile-question]'),result=profile.querySelector('[data-profile-result]');
  const grades=dimensions.map((_,i)=>[...(plan.evidence?.[i]??['E1','E1'])]);
  const followups=dimensions.map(()=>({question:'',feedback:'初问',busy:false}));
  const draw=()=>{
   const d=dimensions[current];
   question.innerHTML='<h3>'+e((current+1)+' / 10 · '+d[0])+'</h3>'+d.slice(1).map((label,j)=>'<label>'+e(label)+'<select data-indicator="'+j+'">'+option('','未知 / 跳过',answers[current][j]===null?'':String(answers[current][j]))+anchors[current][j].map((a,k)=>option(String(k),a,String(answers[current][j]))).join('')+'</select></label><label>依据（本人标注）<select data-grade="'+j+'">'+['E1','E2','E3'].map((g,k)=>option(g,['E1 自我判断','E2 具体经历或选择','E3 有可核对的记录'][k],grades[current][j])).join('')+'</select></label>').join('');
   const turn=followups[current];
   question.insertAdjacentHTML('beforeend','<p aria-live="polite">'+e(turn.question)+'</p><label>情境回答<select data-feedback>'+['初问','条件明确','仍不确定','条件有冲突'].map(v=>option(v,v,turn.feedback)).join('')+'</select></label><button type="button" class="btn secondary" data-followup '+(turn.busy?'disabled':'')+'>同意发送上述选项并生成 AI 追问</button>');
   profile.querySelector('[data-prev]').disabled=current===0;
   profile.querySelector('[data-next]').disabled=current===9;
   result.innerHTML='<h3>证据覆盖与评分区间</h3><div class="admissions-grid">'+dimensions.map((d,i)=>{
    const known=answers[i].filter(v=>v!==null),lower=known.reduce((sum,v)=>sum+v*100/6,0),upper=lower+(2-known.length)*50;
    return '<article class="admissions-card"><strong>'+e(d[0])+'</strong><p>'+Math.round(lower)+'–'+Math.round(upper)+' / 100 · '+known.length+'/2 项自评</p></article>';
   }).join('')+'</div>';
  };
  question.addEventListener('change',event=>{const el=event.target;
   if(el.hasAttribute('data-feedback')){followups[current].feedback=el.value;return;}
   if(el.hasAttribute('data-grade')){grades[current][Number(el.dataset.grade)]=el.value;clearPreview();return;}
   const j=el.dataset.indicator;if(j===undefined)return;clearPreview();answers[current][Number(j)]=event.target.value===''?null:Number(event.target.value);draw();});
  question.addEventListener('click',async event=>{
   if(!event.target.closest('[data-followup]'))return;
   const index=current,turn=followups[index];
   if(turn.busy)return;
   turn.busy=true;draw();
   try{
    const res=await fetch('/api/admissions/followup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,dimension:index,levels:answers[index],feedback:turn.feedback})});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||'追问暂不可用');
    turn.question=data.question;
   }catch(err){turn.question=err.message;}finally{turn.busy=false;if(current===index)draw();}
  });
  profile.querySelector('[data-prev]').addEventListener('click',()=>{if(current>0){current--;draw();}});
  profile.querySelector('[data-next]').addEventListener('click',()=>{if(current<9){current++;draw();}});
  draw();

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
   const next={year:Number(f.get('year')),language:f.get('language'),qualification:f.get('qualification'),examRegistration:f.get('examRegistration'),schoolIds,exams,city:f.get('city'),trainingFocus:f.get('trainingFocus'),evidence:grades.map(pair=>[...pair]),profile:answers.map(pair=>[...pair])};
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
  return '<section class="hub-panel"><h2>院校匹配与资格核对</h2><p>先按资格状态，再按城市、语种两项偏好的符合数量排序。同档同数并列。</p><p>'+e(paths[analysis.path])+'</p><div class="admissions-grid">'+analysis.results.map(s=>{
   const p=s.policy;
   return '<article class="admissions-card"><h3>'+e(s.name)+'</h3><strong>'+e(statuses[s.status])+'</strong>'+
    '<p>'+e(s.reasons.join(' · ')||'偏好信息不足或未匹配')+'</p>'+(p?'<p>'+(s.historical?'历史参考 · ':'招生简章 · ')+e(p.year)+' 年</p><p>报名 '+e(p.registration)+'</p><p>'+e(p.condition)+'</p><p>专业 '+e(p.eligibleLanguages.join('、'))+'</p><a href="'+e(p.source)+'" target="_blank" rel="noopener noreferrer">查看官方简章 ↗</a>':'<p>'+e(s.referenceYear+' 年资料 · '+s.referenceNote+(s.historicalLanguages?.length?' 历史招生语种：'+s.historicalLanguages.join('、'):'') )+'</p><a href="'+e(s.source)+'">'+e(s.sourceLabel)+'</a>')+
    '<div class="toolbar"><a href="'+e(s.notices)+'" target="_blank" rel="noopener noreferrer">查招生资料 ↗</a>'+(s.hasSchoolHub?'<a href="#school/'+e(s.id)+'">学校训练</a>':'<a href="#oral">通用口试训练</a>')+(s.task?'<a href="#task/'+e(s.id)+'/'+e(s.task.id)+'">专项练习 · '+e(s.task.title)+'</a>':'')+'</div></article>';
  }).join('')+'</div></section>'+(analysis.scores?'<section class="hub-panel"><h2>自报证据质量</h2><p>自评、具体经历、可核对记录分别计 0.5、0.75、1 分，未知为 0。按每维两项取平均。</p>'+analysis.scores.map((s,i)=>'第 '+(i+1)+' 维 '+Math.round(100*s.quality)+'%').join(' · ')+'</section>':'')+'<section class="hub-panel"><h2>日程冲突</h2>'+
  (!analysis.conflicts.length?'<p>至少填写两场考试，才能比较日程。</p>':'<ul>'+analysis.conflicts.map(c=>{
   const a=exams[c.first],b=exams[c.second];
   return '<li>'+e(schoolName(a.schoolId)+' '+a.start.replace('T',' '))+' 与 '+e(schoolName(b.schoolId)+' '+b.start.replace('T',' '))+' · '+e(conflictLabels[c.status])+'</li>';
  }).join('')+'</ul>')+'</section>';
 }
};
