'use strict';

const ResearchProjects={
 async request(query='',body){
  const r=await fetch('/api/research-projects'+query,{cache:'no-store',...(body?{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  }:{})});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||'研究项目暂不可用。');
  return data;
 },
 render(){
  if(!PublicApp.session.authenticated){PublicApp.gate('登录后打开研究项目');return;}
  const screen=document.querySelector('#screen');
  screen.innerHTML='<section class="page-heading"><h1>研究项目</h1></section><section class="project-workspace"></section>';
  this.open(screen.querySelector('.project-workspace'));
 },
 async open(root,id='',offset=0,search=''){
  root.innerHTML='<p role="status">正在读取项目…</p>';
  try{
   const data=await this.request(id?'?id='+encodeURIComponent(id):'?'+new URLSearchParams({offset:String(offset),q:search}));
   if(!root.isConnected)return;
   if(id)this.detail(root,data);
   else this.list(root,data,offset,search);
  }catch(error){
   if(!root.isConnected)return;
   root.innerHTML='<p role="alert"></p><button type="button" class="btn secondary">返回项目列表</button>';
   root.querySelector('p').textContent=error.message;
   root.querySelector('button').onclick=()=>this.open(root);
  }
 },
 list(root,data,offset,search){
  const e=escapeHTML;
  root.innerHTML='<form class="hub-panel" data-create><h2>新建项目</h2><label>项目名称<input name="title" required maxlength="120"></label><div class="toolbar"><button class="btn primary">创建项目</button></div>'+
   '<p role="status"></p></form><section class="hub-panel"><h2>我的项目</h2>'+
   '<form data-project-search><label>搜索项目<input name="q" type="search" maxlength="120" value="'+e(search)+'"></label><button class="btn secondary">搜索</button></form>'+
   (data.collaborationCode?'<p>我的协作编号 <code>'+e(data.collaborationCode)+'</code></p>':'')+
   (data.projects.length?'<ul class="project-list">'+data.projects.map(p=>'<li><button class="text-button" type="button" data-project="'+e(p.id)+'">'+e(p.title)+'</button><span>'+
    (p.role==='invited'?'待接受邀请':p.role==='collaborator'?'协作项目':p.status==='archived'?'已归档':'进行中')+'</span></li>').join('')+'</ul>':'<p>暂无项目。</p>')+
   '<div class="toolbar">'+(offset?'<button class="btn secondary" type="button" data-offset="'+Math.max(0,offset-50)+'">上一页</button>':'')+
   (data.next===null?'':'<button class="btn secondary" type="button" data-offset="'+data.next+'">下一页</button>')+'</div></section>';
  for(const button of root.querySelectorAll('[data-project]'))button.onclick=()=>this.open(root,button.dataset.project);
  for(const button of root.querySelectorAll('[data-offset]'))button.onclick=()=>this.open(root,'',Number(button.dataset.offset),search);
  root.querySelector('[data-project-search]').onsubmit=event=>{event.preventDefault();void this.open(root,'',0,new FormData(event.currentTarget).get('q'));};
  const form=root.querySelector('[data-create]');
  form.onsubmit=async event=>{
   event.preventDefault();
   const button=form.querySelector('button');button.disabled=true;
   try{
    const result=await this.request('',{action:'create',title:new FormData(form).get('title')});
    if(root.isConnected)await this.open(root,result.id);
   }catch(error){form.querySelector('[role=status]').textContent=error.message;}
   finally{button.disabled=false;}
  };
 },
 detail(root,{project:p,notes}){
  const e=escapeHTML;
  const button=(action,label,props='')=>'<button type="button" class="btn secondary" data-action="'+action+'" '+props+'>'+label+'</button>';
  const owner=p.role==='owner';
  const active=p.status==='active';
  const editor=owner&&active?'<form data-action="update" class="hub-panel"><label>项目名称<input name="title" maxlength="120" required value="'+e(p.title)+'"></label><label>研究问题<textarea name="question" maxlength="1000" rows="2">'+e(p.question)+'</textarea></label><label>项目简介<textarea name="description" maxlength="4000" rows="4">'+e(p.description)+'</textarea></label><div class="toolbar"><button class="btn primary">保存项目信息</button></div></form>':
   '<section class="hub-panel"><h2>'+e(p.title)+'</h2>'+(p.role==='invited'?'<p>接受后可查看项目与里程碑。</p>':'<p>'+e(p.question||'')+'</p><p>'+e(p.description||'')+'</p>')+'</section>';
  const linked=new Set((p.links||[]).map(n=>n.id));
  root.innerHTML='<div class="toolbar"><button type="button" class="btn secondary" data-back>返回项目列表</button>'+
   (owner?button(active?'archive':'restore',active?'归档':'恢复项目')+button('delete','删除项目'):p.role==='collaborator'?button('leave','退出协作'):'')+'</div>'+
   editor+'<p role="status" aria-live="polite"></p>'+
   (p.role==='invited'?'<div class="toolbar">'+button('respond','接受邀请','data-accept="true"')+button('respond','拒绝邀请')+'</div>':
    '<section class="hub-panel"><h2>里程碑</h2><ul class="project-list">'+p.milestones.map(m=>'<li>'+e(m.title)+' <span>'+(m.done?'已完成':'待完成')+'</span>'+
     (owner&&active?button('milestone-toggle',m.done?'标为待完成':'标为完成','data-key="'+e(m.id)+'" data-done="'+!m.done+'"'):'')+'</li>').join('')+'</ul>'+
     (owner&&active?'<form data-action="milestone-add"><label>新里程碑<input name="title" required maxlength="120"></label><button class="btn secondary">添加里程碑</button></form>':'')+'</section>'+
    '<section class="hub-panel"><h2>我的关联笔记</h2><ul class="project-list">'+p.links.map(n=>'<li>'+(n.folder==='active'?'<a href="/reading-notes#note/'+encodeURIComponent(n.id)+'">'+e(n.title)+'</a>':e(n.title)+' · '+e({archived:'已归档',trash:'回收站',missing:'不可用'}[n.folder]))+
     (active?button('unlink','解除关联','data-key="'+e(n.id)+'"'):'')+'</li>').join('')+'</ul>'+
     (active?'<form data-action="link"><label>选择我的笔记<select name="noteId" required><option value="">请选择</option>'+notes.filter(n=>!linked.has(n.id)).map(n=>'<option value="'+e(n.id)+'">'+e(n.title)+'</option>').join('')+'</select></label><button class="btn secondary">关联笔记</button></form>':'')+'</section>'+
    (owner?'<section class="hub-panel"><h2>协作者</h2><ul class="project-list">'+p.members.map((m,i)=>'<li>协作者 '+(i+1)+' <span>'+e({active:'已接受',pending:'待接受',revoked:'已撤销',declined:'已拒绝'}[m.state])+'</span>'+
       (active&&['pending','active'].includes(m.state)?button('revoke','撤销','data-key="'+e(m.id)+'"'):'')+'</li>').join('')+'</ul>'+
      (active?'<form data-action="invite"><label>对方的协作编号<input name="code" required maxlength="36" autocomplete="off"></label><button class="btn secondary">发出邀请</button></form>':'')+'</section>':''));
  root.querySelector('[data-back]').onclick=()=>this.open(root);
  let busy=false;
  const submit=async (action,values)=>{
   if(busy)return;
   if(action==='delete'&&!window.confirm('删除这份项目记录？已关联的原笔记会保留。'))return;
   const message=root.querySelector('[role=status]');
   const controls=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];
   busy=true;controls.forEach(control=>control.disabled=true);
   try{
    await this.request('',{...values,action,id:p.id,revision:p.revision,...(action==='delete'?{confirm:true}:{})});
    if(root.isConnected)await this.open(root,['delete','leave'].includes(action)||action==='respond'&&!values.accept?'':p.id);
   }catch(error){message.textContent=error.message;}
   finally{busy=false;controls.forEach(control=>control.disabled=false);}
  };
  for(const form of root.querySelectorAll('form[data-action]'))form.onsubmit=event=>{
   event.preventDefault();void submit(form.dataset.action,Object.fromEntries(new FormData(form)));
  };
  for(const btn of root.querySelectorAll('button[data-action]'))btn.onclick=()=>void submit(btn.dataset.action,
   {accept:btn.dataset.accept==='true',done:btn.dataset.done==='true',noteId:btn.dataset.key,milestoneId:btn.dataset.key,memberId:btn.dataset.key});
 }
};
