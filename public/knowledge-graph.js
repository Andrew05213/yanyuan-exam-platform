'use strict';
const KnowledgeGraph={
 serial:0,controller:null,root:null,data:null,busy:false,query:null,zoom:1,
 kinds:{resource:'资料',author:'署名',era:'时代',topic:'主题标签',note:'笔记',project:'研究项目',weakness:'历史错题知识点',concept:'自定义概念'},
 relations:{related_to:'相关',supports:'支持',contrasts:'对照或反驳',cites:'引用',defines:'定义',authored_by:'署名',classified_in:'时代分类',has_theme:'资料主题',note_on:'笔记对应资料',tagged_with:'笔记标签',project_note:'项目关联笔记',observed_wrong_tag:'实际错题标签'},
 manual:['related_to','supports','contrasts','cites','defines'],
 colors:{resource:'#426D9B',author:'#8769A7',era:'#8A7650',topic:'#B28C45',note:'#42957E',project:'#B76C4F',weakness:'#6D8197',concept:'#244A75'},
 e(v){return escapeHTML(String(v??''));},
 leave(){this.serial++;this.controller?.abort();this.controller=null;this.root=null;this.data=null;this.busy=false;this.query=null;},
 render(){
  this.leave();
  if(!PublicApp.session.authenticated){PublicApp.gate('登录后打开私人知识图谱');return;}
  const screen=document.querySelector('#screen');
  screen.innerHTML='<section class="page-heading"><h1>知识图谱</h1><p>PRIVATE KNOWLEDGE GRAPH · 本人资料、笔记与研究关系</p></section><section class="kg-workspace"></section>';
  this.root=screen.querySelector('.kg-workspace');this.query={q:'',kind:'',offset:0,focus:'',relation:'',edgeOffset:0,suggestionOffset:0};this.zoom=1;void this.load();
 },
 async request(body,signal){
  const r=await fetch('/api/knowledge-graph'+(body?'':'?'+new URLSearchParams(this.query)),{cache:'no-store',credentials:'same-origin',signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const d=await r.json();if(!r.ok){const error=Error(d.error||'操作失败');error.status=r.status;throw error;}return d;
 },
 async load(patch={}){
  if(!this.root)return;Object.assign(this.query,patch);const root=this.root,run=++this.serial;this.controller?.abort();const c=new AbortController();this.controller=c;this.busy=false;root.innerHTML='<p role="status">读取私人图谱…</p>';
  try{const d=await this.request(null,c.signal);if(run!==this.serial||!root.isConnected)return;this.data=d;this.draw();}
  catch(err){if(run!==this.serial||c.signal.aborted||!root.isConnected)return;if(err.status===404&&this.query.focus){this.query.focus='';this.query.edgeOffset=0;return this.load();}root.innerHTML='<p class="kg-alert" role="alert">'+this.e(err.message)+'</p><button class="btn secondary" data-kg-retry>重试</button>';root.querySelector('button').onclick=()=>this.load();}
 },
 options(map,current){return Object.entries(map).map(([k,v])=>'<option value="'+this.e(k)+'" '+(k===current?'selected':'')+'>'+this.e(v)+'</option>').join('');},
 relationOptions(current){return this.options(Object.fromEntries(this.manual.map(k=>[k,this.relations[k]])),current);},
 nodeButton(n,focus){return '<button class="kg-node" type="button" data-kg-node="'+this.e(n.id)+'" aria-current="'+(n.id===focus)+'"><strong>'+this.e(n.title)+'</strong><small>'+this.e(this.kinds[n.kind])+' · '+this.e(n.source)+'</small></button>';},
 draw(){
  const root=this.root,d=this.data,q=this.query,e=v=>this.e(v);if(!root||!d)return;
  const limits=Object.entries(d.limits).filter(([,v])=>v).map(([k])=>({notes:'笔记',projects:'项目',resources:'自建资料',wrongRecords:'错题记录',wrongTags:'错题知识点'})[k]);
  root.innerHTML='<section class="kg-panel"><div class="kg-bar"><strong>'+d.nodeCount+' 个节点 · '+d.edgeCount+' 条关系</strong><span class="kg-muted">当前有界结果，仅本人可见；历史错题不是当前能力评分。</span></div>'+(limits.length?'<p class="kg-alert">当前来源存在截断：'+e(limits.join('、'))+'。请在原模块查看其余记录。</p>':'')+'<form data-kg-search><label>搜索资料、笔记或概念<input name="q" type="search" maxlength="200" value="'+e(q.q)+'"></label><label>节点类别<select name="kind"><option value="">全部节点</option>'+this.options(this.kinds,q.kind)+'</select></label><div class="kg-bar"><button class="btn primary">搜索</button><button type="button" class="btn secondary" data-kg-reset>重置筛选</button></div></form></section><div class="kg-grid"><section class="kg-panel"><h2>节点索引</h2><p class="kg-muted">匹配 '+d.total+' 项</p><div class="kg-list">'+(d.nodes.length?d.nodes.map(n=>this.nodeButton(n,q.focus)).join(''):'<p>没有匹配的节点。</p>')+'</div><div class="kg-bar">'+(q.offset?'<button class="btn secondary" data-kg-prev>上一页</button>':'')+(d.nextOffset!==null?'<button class="btn secondary" data-kg-next>下一页</button>':'')+'</div><details open><summary>创建自定义概念</summary><form data-kg-concept><label>名称<input name="title" required maxlength="200"></label><label>说明<textarea name="description" maxlength="1000"></textarea></label><button class="btn primary">创建概念</button></form></details></section><section class="kg-panel" data-kg-detail></section></div><section class="kg-panel" data-kg-suggestions></section><p role="status" data-kg-message></p>';
  root.querySelector('[data-kg-search]').onsubmit=ev=>{ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target));this.load({...f,offset:0});};
  root.querySelector('[data-kg-reset]').onclick=()=>this.load({q:'',kind:'',offset:0,relation:'',edgeOffset:0});
  root.querySelector('[data-kg-prev]')?.addEventListener('click',()=>this.load({offset:Math.max(0,q.offset-40)}));
  root.querySelector('[data-kg-next]')?.addEventListener('click',()=>this.load({offset:d.nextOffset}));
  root.querySelector('[data-kg-concept]').onsubmit=ev=>{ev.preventDefault();void this.write('concept-create',Object.fromEntries(new FormData(ev.target)));};
  this.detail(root.querySelector('[data-kg-detail]'));this.suggestions(root.querySelector('[data-kg-suggestions]'));
  root.querySelectorAll('[data-kg-node]').forEach(b=>{b.onclick=()=>this.load({focus:b.dataset.kgNode,edgeOffset:0,relation:''});});
 },
 href(n){
  return /^(\/literature|\/reading-notes#note\/[A-Za-z0-9_-]+|#projects|#mistakes)$/.test(n.href)?n.href:'';
 },
 detail(root){
  const d=this.data,q=this.query,f=d.focus,e=v=>this.e(v);
  if(!f){root.innerHTML='<h2>知识网络</h2><p>从节点索引中选择一个节点，查看它的关系和来源。关系依据元数据或本人确认，不代表未经证实的学术事实。</p><p><a href="/literature">文学与研究资料</a> · <a href="/reading-notes">读书笔记</a> · <a href="#today">今日学习</a></p>';return;}
  const n=f.node,href=this.href(n),map=new Map([n,...f.neighbors].map(n=>[n.id,n])),targets=[...new Map([...d.nodes,...f.neighbors].filter(x=>x.id!==n.id).map(x=>[x.id,x])).values()];
  const targetOptions=targets.map(t=>'<option value="'+e(t.id)+'">'+e(t.title+' · '+this.kinds[t.kind])+'</option>').join('');
  root.innerHTML='<h2>'+e(n.title)+'</h2><p class="kg-muted">'+e(this.kinds[n.kind])+' · '+e(n.source)+'</p>'+(n.detail?'<p>'+e(n.detail)+'</p>':'')+(href?'<p><a href="'+e(href)+'">打开原模块</a></p>':'')+'<div class="kg-bar"><button class="btn secondary" data-kg-zoom-out aria-label="缩小图谱">−</button><button class="btn secondary" data-kg-zoom-reset>重置缩放</button><button class="btn secondary" data-kg-zoom-in aria-label="放大图谱">＋</button><button class="btn secondary" data-kg-list-toggle>切换图谱/列表</button></div><div class="kg-svg" data-kg-svg></div><label>关系类别<select data-kg-relation><option value="">全部关系</option>'+this.options(this.relations,q.relation)+'</select></label><p class="kg-muted">邻接关系 '+f.total+' 条，本页最多16条。</p><div class="kg-edges">'+(f.edges.length?f.edges.map(l=>{const t=map.get(l.from===n.id?l.to:l.from);return '<article class="kg-edge"><span>'+e(this.relations[l.relation]||l.relation)+' · '+e(l.source)+(l.stale?' · 来源版本变化，请复核':'')+'</span>'+this.nodeButton(t,n.id)+(l.note?'<p>'+e(l.note)+'</p>':'')+(l.manual?'<details><summary>编辑或删除关系</summary><form data-kg-edit-link="'+e(l.id)+'" class="kg-fields"><label>关系<select name="relation">'+this.relationOptions(l.relation)+'</select></label><label>方向<select name="direction"><option value="same">保持原方向</option><option value="reverse">反转方向</option></select></label><label>说明 / 引用定位<textarea name="note" maxlength="1000">'+e(l.note)+'</textarea></label><button class="btn secondary">保存关系</button></form><button class="btn secondary" data-kg-delete-link="'+e(l.id)+'">删除关系</button></details>':'')+'</article>';}).join(''):'<p>没有当前筛选下的关系。</p>')+'</div><div class="kg-bar">'+(q.edgeOffset?'<button class="btn secondary" data-kg-edge-prev>上一组关系</button>':'')+(f.nextOffset!==null?'<button class="btn secondary" data-kg-edge-next>下一组关系</button>':'')+'</div><details open><summary>添加人工确认的关系</summary><p class="kg-muted">先在左侧搜索目标节点，再从下方选择。学术判断由本人负责，引用须填出处或定位。</p>'+(targets.length?'<form data-kg-link><label>目标节点<select name="to">'+targetOptions+'</select></label><label>关系<select name="relation">'+this.relationOptions('related_to')+'</select></label><label>说明 / 引用定位<textarea name="note" maxlength="1000"></textarea></label><button class="btn primary">保存关系</button></form>':'<p>请先搜索其他节点。</p>')+'</details>'+(n.kind==='concept'?'<details><summary>编辑自定义概念</summary><form data-kg-edit-concept><label>名称<input name="title" required maxlength="200" value="'+e(n.title)+'"></label><label>说明<textarea name="description" maxlength="1000">'+e(n.detail)+'</textarea></label><button class="btn secondary">保存概念</button></form><button class="btn secondary" data-kg-delete-concept>删除概念及人工关联</button></details>':'');
  const canvas=root.querySelector('[data-kg-svg]');this.diagram(canvas,f);
  root.querySelector('[data-kg-zoom-out]').onclick=()=>{this.zoom=Math.max(.7,this.zoom-.2);this.diagram(canvas,f);};
  root.querySelector('[data-kg-zoom-in]').onclick=()=>{this.zoom=Math.min(2,this.zoom+.2);this.diagram(canvas,f);};
  root.querySelector('[data-kg-zoom-reset]').onclick=()=>{this.zoom=1;this.diagram(canvas,f);};
  root.querySelector('[data-kg-list-toggle]').onclick=()=>{canvas.hidden=!canvas.hidden;};
  root.querySelector('[data-kg-relation]').onchange=ev=>this.load({relation:ev.target.value,edgeOffset:0});
  root.querySelector('[data-kg-edge-prev]')?.addEventListener('click',()=>this.load({edgeOffset:Math.max(0,q.edgeOffset-16)}));
  root.querySelector('[data-kg-edge-next]')?.addEventListener('click',()=>this.load({edgeOffset:f.nextOffset}));
  root.querySelector('[data-kg-link]')?.addEventListener('submit',ev=>{ev.preventDefault();void this.write('link-create',{...Object.fromEntries(new FormData(ev.target)),from:n.id});});
  root.querySelectorAll('[data-kg-edit-link]').forEach(form=>form.onsubmit=ev=>{ev.preventDefault();const l=f.edges.find(l=>l.id===form.dataset.kgEditLink),v=Object.fromEntries(new FormData(form));void this.write('link-update',{id:l.id,from:v.direction==='reverse'?l.to:l.from,to:v.direction==='reverse'?l.from:l.to,relation:v.relation,note:v.note});});
  root.querySelectorAll('[data-kg-delete-link]').forEach(b=>b.onclick=()=>{if(confirm('删除这条人工关系？'))void this.write('link-delete',{id:b.dataset.kgDeleteLink});});
  const conceptId=n.kind==='concept'?JSON.parse(n.id.slice(n.id.indexOf(':')+1))[0]:null;
  root.querySelector('[data-kg-edit-concept]')?.addEventListener('submit',ev=>{ev.preventDefault();void this.write('concept-update',{id:conceptId,...Object.fromEntries(new FormData(ev.target))});});
  root.querySelector('[data-kg-delete-concept]')?.addEventListener('click',()=>{if(confirm('删除概念及其人工关系？原始资料不受影响。'))void this.write('concept-delete',{id:conceptId},{focus:'',edgeOffset:0});});
 },
 diagram(root,f){
  const e=v=>this.e(v),ns=[f.node,...f.neighbors],count=Math.max(1,ns.length-1),points=ns.map((n,i)=>({n,x:i?300+215*Math.cos((i-1)*2*Math.PI/count-Math.PI/2):300,y:i?210+155*Math.sin((i-1)*2*Math.PI/count-Math.PI/2):210})),map=new Map(points.map(p=>[p.n.id,p]));
  root.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="'+Math.round(this.zoom*100)+'%" role="group" aria-label="当前节点的局部知识图谱">'+f.edges.map(l=>{const a=map.get(l.from),b=map.get(l.to);return '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="'+(l.manual?'#aa8c4d':'#a0aebd')+'" stroke-width="1.5" '+(l.stale?'stroke-dasharray="5 4"':'')+'/>';}).join('')+points.map((p,i)=>'<g role="button" tabindex="0" aria-label="'+e(p.n.title)+'" data-kg-svg-node="'+e(p.n.id)+'"><circle cx="'+p.x+'" cy="'+p.y+'" r="'+(i?19:27)+'" fill="'+this.colors[p.n.kind]+'" fill-opacity=".20" stroke="'+this.colors[p.n.kind]+'" stroke-width="2"/><circle cx="'+p.x+'" cy="'+p.y+'" r="'+(i?5:9)+'" fill="'+this.colors[p.n.kind]+'"/><text x="'+p.x+'" y="'+(p.y+32)+'" fill="#193852" text-anchor="middle" font-size="12">'+e(Array.from(p.n.title).slice(0,12).join(''))+'</text><title>'+e(p.n.title)+'</title></g>').join('')+'</svg>';
  root.querySelectorAll('[data-kg-svg-node]').forEach(g=>{const choose=()=>this.load({focus:g.dataset.kgSvgNode,edgeOffset:0,relation:''});g.onclick=choose;g.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();choose();}};});
 },
 suggestions(root){
  const d=this.data,q=this.query,e=v=>this.e(v);
  const card=(s,dismissed)=>'<article class="kg-edge"><strong>'+e(s.fromTitle)+' ↔ '+e(s.toTitle)+'</strong><p>'+e(s.reason)+'；仅建议比较，不证明传承、因果或支持。</p><div class="kg-bar">'+(dismissed?'<button class="btn secondary" data-kg-suggestion="suggestion-restore" data-id="'+e(s.id)+'">恢复建议</button>':'<button class="btn primary" data-kg-suggestion="suggestion-confirm" data-id="'+e(s.id)+'">确认相关</button><button class="btn secondary" data-kg-suggestion="suggestion-dismiss" data-id="'+e(s.id)+'">拒绝建议</button>')+'</div></article>';
  root.innerHTML='<h2>待审核关联建议</h2><p class="kg-muted">当前 '+d.suggestionTotal+' 条建议；已拒绝 '+d.dismissedTotal+' 条。'+(d.limitedSuggestions?'候选按主题与总数限制截断。':'')+'</p><div class="kg-edges">'+(d.suggestions.length?d.suggestions.map(s=>card(s,false)).join(''):'<p>本页暂无建议。</p>')+'</div><details><summary>已拒绝的建议</summary><div class="kg-edges">'+d.dismissed.map(s=>card(s,true)).join('')+'</div></details><div class="kg-bar">'+(q.suggestionOffset?'<button class="btn secondary" data-kg-sug-prev>上一页建议</button>':'')+(d.nextSuggestionOffset!==null?'<button class="btn secondary" data-kg-sug-next>下一页建议</button>':'')+'</div><details><summary>来源失效的人工关系（'+d.inactive.length+'）</summary><p class="kg-muted">来源归档、删除或不在当前有界结果内，隐藏旧标题和说明，可删除人工关系。</p>'+d.inactive.map(l=>'<div class="kg-edge">'+e(this.relations[l.relation])+' · 来源不可用 <button class="btn secondary" data-kg-inactive="'+e(l.id)+'">删除关系</button></div>').join('')+'</details>';
  root.querySelectorAll('[data-kg-suggestion]').forEach(b=>b.onclick=()=>void this.write(b.dataset.kgSuggestion,{id:b.dataset.id},{suggestionOffset:0}));
  root.querySelectorAll('[data-kg-inactive]').forEach(b=>b.onclick=()=>{if(confirm('删除这条来源不可用的人工关系？'))void this.write('link-delete',{id:b.dataset.kgInactive});});
  root.querySelector('[data-kg-sug-prev]')?.addEventListener('click',()=>this.load({suggestionOffset:Math.max(0,q.suggestionOffset-12)}));
  root.querySelector('[data-kg-sug-next]')?.addEventListener('click',()=>this.load({suggestionOffset:d.nextSuggestionOffset}));
 },
 async write(action,body,patch={}){
  if(this.busy||!this.root||!this.data)return;this.busy=true;const run=this.serial,root=this.root,controls=[...root.querySelectorAll('button,input,select,textarea')],old=controls.map(x=>x.disabled),msg=root.querySelector('[data-kg-message]');controls.forEach(x=>x.disabled=true);msg.textContent='正在保存…';
  try{await this.request({action,version:this.data.version,...body},this.controller.signal);if(run!==this.serial||!root.isConnected)return;await this.load(patch);if(root===this.root&&root.isConnected)root.querySelector('[data-kg-message]')?.replaceChildren('已保存。');}
  catch(err){if(run===this.serial&&root.isConnected){msg.textContent=err.message;msg.className='kg-alert';}}
  finally{if(run===this.serial){this.busy=false;controls.forEach((x,i)=>x.disabled=old[i]);}}
 }
};
