'use strict';
const PublicApp={
 session:{authenticated:false},baseItems:[],materials:[],mine:new Set(),token:0,editing:null,files:[],
 e:s=>Hub.e(s),
 signin(){return '/signin-with-chatgpt?return_to='+encodeURIComponent('/index.html'+(location.hash.startsWith('#packet/')&&!Hub.packetMeta?.revision?'#studio':location.hash));},
 loginLink(text='登录后使用'){return '<a class="btn primary" target="_top" href="'+this.e(this.signin())+'">'+this.e(text)+' ↗</a>';},
 gate(title='我的学习资料库'){
  $('#screen').innerHTML='<div class="empty-state"><div class="empty-mark">▤</div><h1>'+this.e(title)+'</h1><p>登录后拥有自己的错题、作文、练习和个人预设。<br>这些记录只向当前账号开放，换设备登录同一账号即可继续。</p>'+this.loginLink()+' <a class="btn secondary" href="#studio">先去组卷</a></div>';
 },
 async init(){
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  const r=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw Error('登录状态暂时无法确认，请刷新。');
  this.session=await r.json();KEY='yanyuan-v2:'+(this.session.authenticated?this.session.userId:'guest');
  try{if(this.session.legacyOwner&&!localStorage.getItem(KEY)){const old=localStorage.getItem('yanyuan-archive-v1');if(old)localStorage.setItem(KEY,old);}}catch{storageAvailable=false;}
  this.account();
  const render=Hub.render.bind(Hub),route=Hub.route.bind(Hub);
  Hub.render=view=>{
   if(view==='community'){this.render();return;}
   if(['mistakes','writing','saved'].includes(view)&&!this.session.authenticated){this.gate(names[view]);return;}
   render(view);
   if(view==='studio')this.guestStudio();
   if(view==='schools')$('#screen').insertAdjacentHTML('afterbegin','<div class="community-banner"><span>开放组卷与共享资料 · 个人学习记录按账号保存</span><a href="#community">进入共享题库 ↗</a></div>');
  };
  Hub.route=hash=>{
   if(hash==='material/new'){Hub.page('community','发布资料');this.form();return true;}
   if(hash.startsWith('material/')){Hub.page('community','共享资料');this.detail(hash.slice(9));return true;}
   const privatePath=/^(mistake|essay|preset|attempt)\//.test(hash)||hash.startsWith('packet/')&&Hub.packet?.id!==hash.slice(7)||hash.startsWith('run/')&&Hub.packet?.id!==hash.split('/')[1];
   if(privatePath&&!this.session.authenticated){Hub.page('saved','我的资料库');this.gate();return true;}
   const result=route(hash);
   return result;
  };
  const packetTools=Hub.packetTools.bind(Hub);
  Hub.packetTools=()=>packetTools()+(!this.session.authenticated?'<div class="notice">访客可在线练习、打印及导出；当前卷未保存至账号，请先导出再登录。'+this.loginLink('登录并使用私人资料库')+'</div>':'');
  const oldPresets=TierStudio.loadPresets.bind(TierStudio);
  TierStudio.loadPresets=()=>this.session.authenticated?oldPresets():Promise.resolve();
  const oldSavePreset=TierStudio.savePreset.bind(TierStudio);
  TierStudio.savePreset=()=>{if(!this.session.authenticated){toast('请先点击右上角登录，再保存个人预设。');return;}return oldSavePreset();};
  const oldRender=TierStudio.render.bind(TierStudio);
  TierStudio.render=()=>{if(!this.session.authenticated&&TierStudio.config)for(const k of ['excludeAttempted','excludeGenerated','excludeMaterials'])TierStudio.config[k]=false;oldRender();this.guestStudio();};
  const oldState=TierStudio.state.bind(TierStudio);
  TierStudio.state=c=>this.session.authenticated?oldState(c):Promise.resolve({});
  document.querySelector('#screen').addEventListener('click',event=>this.click(event));
  document.querySelector('#screen').addEventListener('change',event=>this.change(event));
  document.querySelector('#screen').addEventListener('submit',event=>{if(event.target.id==='community-form'){event.preventDefault();this.publish(event.target);}});
  window.addEventListener('hashchange',()=>this.account());
  this.baseItems=TierStudio.data.items.slice();
  await this.refresh().catch(()=>{this.loadError='共享资料暂时无法读取，可稍后刷新。';});
 },
 account(){
  const el=$('#account-links');if(!el)return;
  el.innerHTML=this.session.authenticated?'<a href="#saved">我的资料库</a><a target="_top" href="/signout-with-chatgpt?return_to=%2Findex.html">退出</a>':this.loginLink('登录');
 },
 guestStudio(){
  if(this.session.authenticated)return;
  for(const el of document.querySelectorAll('#tier-attempted,#tier-generated,#tier-materials')){el.checked=false;el.disabled=true;}
  if(TierStudio.config)for(const k of ['excludeAttempted','excludeGenerated','excludeMaterials'])TierStudio.config[k]=false;
  if($('#tier-preset'))$('#tier-preset').disabled=true;
  const screen=$('#screen');
  if(!screen.querySelector('.guest-banner'))screen.insertAdjacentHTML('afterbegin','<div class="notice guest-banner">访客可直接组卷。登录后可保存试卷、跨设备使用错题库和个人预设；云端去重仅对登录账号启用。 '+this.loginLink('登录')+'</div>');
 },
 async refresh(){
  const r=await StudyFlow.request('/api/materials?catalog=1');
  this.materials=r.materials;TierStudio.data.items=[...this.baseItems,...r.items];this.loadError='';
  if(this.session.authenticated){const m=await StudyFlow.request('/api/materials?mine=1');this.ownMaterials=m.materials;this.mine=new Set(m.materials.map(x=>x.id));}
 },
 labels(m){const d=TierStudio.data;return this.e(m.subject)+' / '+this.e(d.sections[m.subject]?.find(x=>x.id===m.section)?.label||m.section)+' / '+this.e(DifficultyEngine.label(d,m.subject,m.tier));},
 async render(){
  const t=++this.token;$('#screen').innerHTML='<div class="loading">正在打开共享资料…</div>';
  try{await this.refresh();if(t!==this.token||currentView!=='community')return;
   $('#screen').innerHTML='<div class="page-heading"><div class="eyebrow">SHARE THE MATERIAL. KEEP YOUR PROGRESS.</div><h1>共享资料与题库</h1><p>公开的材料，一起补充。自己的错题，留在自己的资料库。</p></div><div class="community-banner"><span>已发布的资料与附件可被任何访客阅读和下载；难度为分享者自标。<br>含结构化题目的材料加入组卷库存，原始文档作为阅读资料保存。</span><a class="btn primary" href="#material/new">＋ 发布新资料</a></div><div class="hub-filter-bar"><label>科目<select id="community-subject"><option value="">全部科目</option>'+Object.keys(TierStudio.data.tiers).map(s=>'<option>'+this.e(s)+'</option>').join('')+'</select></label><label>标题或来源<input id="community-query" type="search" placeholder="输入关键词"></label>'+(this.session.authenticated?'<label class="hub-check"><input id="community-mine" type="checkbox">只看我的发布（含已撤下）</label>':'')+'</div><p class="hub-form-note">显示最近200份资料。分享时请提供来源、答案解析和分级理由。撤下后不再公开提供；其他人已保存的试卷快照和下载副本会保留。</p><div id="community-results"></div>';
   $('#community-query').addEventListener('input',()=>this.filter());this.filter();
  }catch(e){if(t===this.token)$('#screen').innerHTML='<div class="empty-state"><h2>共享资料暂时无法打开</h2><p>'+this.e(e.message)+'</p><button class="btn secondary" data-community="refresh">重试</button></div>';}
 },
 filter(){
  const subject=$('#community-subject')?.value||'',query=$('#community-query')?.value.toLowerCase()||'',mine=$('#community-mine')?.checked;
  const records=(mine?this.ownMaterials||[]:this.materials).filter(m=>(!subject||m.subject===subject)&&(!query||(m.title+' '+m.source).toLowerCase().includes(query)));
  $('#community-results').innerHTML=records.length?'<div class="hub-task-grid">'+records.map(m=>'<article class="hub-panel community-card"><div class="hub-card-meta"><span>'+this.labels(m)+'</span><span>'+(!m.active?'已撤下':m.questionCount+'题')+'</span></div><h2><a href="#material/'+this.e(m.id)+'">'+this.e(m.title)+'</a></h2><p>'+this.e(m.reason)+'</p><p class="hub-form-note">分享者：'+this.e(m.authorAlias)+' · 上传者自标，未审核</p><a class="text-link" href="#material/'+this.e(m.id)+'">查看资料与出处 ↗</a></article>').join('')+'</div>':'<div class="empty-state"><h2>这里还没有资料</h2><p>可以发布自己的题目，或附上可公开分享的文档。</p><a class="btn primary" href="#material/new">发布第一份资料</a></div>';
 },
 async detail(id){
  const t=++this.token;$('#screen').innerHTML='<div class="loading">正在读取资料…</div>';
  try{const {material:m}=await StudyFlow.request('/api/materials?id='+encodeURIComponent(id)+(this.mine.has(id)?'&mine=1':''));if(t!==this.token)return;this.editing=m;
   $('#screen').innerHTML='<a class="back-link" href="#community">← 返回共享资料</a><div class="page-heading"><div class="eyebrow">'+this.labels(m)+'</div><h1>'+this.e(m.title)+'</h1><p>分享者：'+this.e(m.authorAlias)+' · '+(m.active?'公开分享':'已撤下')+' · v'+m.revision+'</p></div><div class="notice">分级依据（上传者自标，未审核）：'+this.e(m.reason)+'</div><div class="toolbar">'+(this.mine.has(id)?'<button class="btn secondary" data-community="edit">编辑 / 重新发布</button>'+(m.active?'<button class="btn secondary" data-community="withdraw">撤下共享资料</button>':''):'')+'<a class="btn primary" href="#studio">去组卷 ↗</a></div><section class="hub-panel"><h2>材料正文</h2>'+Hub.paragraphs(m.text||'正文见附件。')+'<div class="hub-source-note">出处：'+this.e(m.source)+(m.sourceUrl?' <a href="'+this.e(m.sourceUrl)+'" target="_blank" rel="noopener">来源链接 ↗</a>':'')+'<br>分享依据：'+this.e({original:'原创',permission:'已获公开分享许可','public-domain':'公有领域'}[m.rights]||m.rights)+'</div><div class="toolbar">'+m.fileIds.map((f,i)=>'<a class="btn secondary" href="/api/material-files?id='+encodeURIComponent(f)+'" download>下载附件 '+(i+1)+' ↧</a>').join('')+'</div></section><div class="flow-space">'+m.questions.map((q,i)=>'<article class="hub-panel flow-space"><h3>'+(i+1)+'. '+this.e(q.stem)+'</h3>'+((q.options||[]).map((o,j)=>'<p>'+'ABCD'[j]+'. '+this.e(o)+'</p>').join(''))+(q.paragraphs?Hub.paragraphs(Object.entries(q.paragraphs).map(([a,p])=>a+'. '+p).join('\n\n')):'')+Hub.paragraphs(q.text||'')+'<details><summary>参考答案与解析</summary><p>'+this.e(q.answer||q.accepted?.join(' / ')||'主观题待实际批改')+'</p>'+Hub.paragraphs(q.analysis)+' '+Hub.paragraphs(q.reference||'')+'</details></article>').join('')+'</div>';
  }catch(e){if(t===this.token)Hub.errorPage(e.message,'资料无法读取');}
 },
 form(material=null){
  if(!this.session.authenticated){this.gate('登录后发布共享资料');return;}
  this.editing=material;this.files=[...(material?.fileIds||[])];const m=material||{},e=this.e,d=TierStudio.data;
  $('#screen').innerHTML='<a class="back-link" href="#community">← 返回共享资料</a><div class="page-heading"><div class="eyebrow">CONTRIBUTE A SOURCE</div><h1>'+(material?'编辑共享资料':'发布新资料')+'</h1><p>发布的正文、题目、署名及附件将向所有访客开放。个人错题和作文保存在“我的资料库”。</p></div><form id="community-form" class="hub-panel hub-form"><div class="tier-header-grid"><label>资料标题<input name="title" maxlength="150" required value="'+e(m.title||'')+'"></label><label>公开署名<input name="authorAlias" maxlength="40" required value="'+e(m.authorAlias||'学习者')+'"></label><label>科目<select name="subject" id="material-subject">'+Object.keys(d.tiers).map(s=>'<option '+(s===(m.subject||'英语')?'selected':'')+'>'+e(s)+'</option>').join('')+'</select></label><label>部分<select name="section" id="material-section"></select></label><label>难度档位<select name="tier" id="material-tier"></select></label></div><label>分级理由<textarea name="reason" maxlength="1000" rows="3" required placeholder="说明词汇、句法、推理或解题步骤为何符合所选档位">'+e(m.reason||'')+'</textarea></label><label>完整材料正文<textarea name="text" maxlength="60000" rows="10" placeholder="阅读、完形和语文题组必须附完整正文；完形空号用[1]、[2]……">'+e(m.text||'')+'</textarea></label><div class="hub-form-pair"><label>作者 / 作品 / 来源<input name="source" maxlength="500" required value="'+e(m.source||'')+'"></label><label>来源链接（选填，https）<input name="sourceUrl" type="url" maxlength="1000" value="'+e(m.sourceUrl||'')+'"></label></div><section class="community-builder"><h2>结构化题目</h2><p class="hub-form-note">只分享资料时保持 []。可用下方表单逐题添加选择题；其他题型可直接编辑JSON。每份最多50题，答案解析必填。</p><details><summary>添加一道选择题</summary><div class="hub-field flow-space"><label>题干<textarea id="material-stem" rows="3"></textarea></label><div class="hub-form-pair">'+[...'ABCD'].map(a=>'<label>选项 '+a+'<textarea id="material-option-'+a+'" rows="2"></textarea></label>').join('')+'</div><label>答案<select id="material-answer">'+[...'ABCD'].map(a=>'<option>'+a+'</option>').join('')+'</select></label><label>解析<textarea id="material-analysis" rows="3"></textarea></label><button type="button" class="btn secondary" data-community="add-question">加入下方题目列表</button></div></details><label>题目列表 JSON<textarea id="material-questions" name="questions" rows="10" spellcheck="false">'+e(JSON.stringify(m.questions||[],null,2))+'</textarea></label><div class="toolbar"><button type="button" class="text-link" data-community="template">下载题型模板 JSON ↧</button><span class="hub-form-note">mc 选择 · fill 填空 · order 排序 · translation 翻译 · writing 写作</span></div></section><label>附件（PDF、DOCX、TXT、JPG、PNG；每个8MB，最多6个）<input id="material-upload" type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" multiple></label><div id="material-files" class="hub-form-note"></div><p class="hub-form-note">附件不会自动转换成组卷题目。需把题干、答案及解析录入上方题目列表；上传完成的附件在发布前仅自己可读。</p><label>分享依据<select name="rights" required><option value="">请选择</option>'+Object.entries({original:'我创作的原创资料',permission:'我已获得公开分享许可','public-domain':'公有领域作品（请在来源中说明版本）'}).map(([k,v])=>'<option value="'+k+'" '+(m.rights===k?'selected':'')+'>'+e(v)+'</option>').join('')+'</select></label><label class="hub-check"><input name="shareConfirmed" type="checkbox" required>我确认有权公开分享，且已检查正文、答案与附件，不含个人隐私。</label><div class="toolbar"><button id="material-publish" class="btn primary" type="submit">发布到共享资料区 ↗</button><span id="material-status" role="status"></span></div></form>';
  this.formOptions(m.section,m.tier);this.fileList();
 },
 formOptions(section,tier){
  const subject=$('#material-subject').value,d=TierStudio.data;
  $('#material-section').innerHTML=d.sections[subject].map(s=>'<option value="'+s.id+'" '+(s.id===section?'selected':'')+'>'+this.e(s.label)+'</option>').join('');
  $('#material-tier').innerHTML=d.tiers[subject].map(t=>'<option value="'+t.id+'" '+(t.id===tier?'selected':'')+'>'+this.e(t.label)+'</option>').join('');
 },
 fileList(){if($('#material-files'))$('#material-files').innerHTML=this.files.map((f,i)=>'<div>附件 '+(i+1)+' · '+this.e(typeof f==='string'?f:f.filename)+' <button class="text-link" type="button" data-community="remove-file" data-index="'+i+'">移除</button></div>').join('')||'未添加附件';},
 async upload(input){
  if(this.uploading||this.publishing)return;const files=[...input.files];if(files.length+this.files.length>6){toast('每份资料最多6个附件。');input.value='';return;}
  this.uploading=true;$('#material-publish').disabled=true;
  try{for(const f of files){if(f.size>8*1024*1024)throw Error('单个附件不能超过8MB。');$('#material-status').textContent='正在上传 '+f.name+'…';const r=await fetch('/api/material-files',{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream','X-File-Name':encodeURIComponent(f.name)},body:f,credentials:'same-origin'});const b=await r.json();if(!r.ok)throw Error(b.error||'上传未完成');this.files.push(b);this.fileList();}$('#material-status').textContent='上传完成，发布后才会对外共享。';}catch(e){$('#material-status').textContent=e.message;}finally{this.uploading=false;$('#material-publish').disabled=false;input.value='';}
 },
 async publish(form){
  if(this.publishing||this.uploading)return;this.publishing=true;const button=$('#material-publish');button.disabled=true;
  try{const data=Object.fromEntries(new FormData(form));data.questions=JSON.parse(data.questions);data.fileIds=this.files.map(f=>typeof f==='string'?f:f.id);data.shareConfirmed=!!data.shareConfirmed;if(this.editing){data.id=this.editing.id;data.expectedRevision=this.editing.revision;}const r=await StudyFlow.request('/api/materials',data);await this.refresh();location.hash='material/'+r.material.id;if(this.editing?.id===r.material.id)await this.detail(r.material.id);toast('资料已公开发布，结构化题目已加入组卷库存。');}catch(e){$('#material-status').textContent=e.message;toast(e.message);}finally{this.publishing=false;if($('#material-publish'))$('#material-publish').disabled=false;}
 },
 async click(event){
  const b=event.target.closest('[data-community]');if(!b)return;
  try{
   if(b.dataset.community==='refresh')return this.render();
   if(b.dataset.community==='edit')return this.form(this.editing);
   if(b.dataset.community==='remove-file'){this.files.splice(Number(b.dataset.index),1);this.fileList();}
   if(b.dataset.community==='withdraw'){const m=this.editing;await StudyFlow.request('/api/materials',{id:m.id,expectedRevision:m.revision,action:'withdraw'});await this.refresh();await this.detail(m.id);toast('已撤下，共享区不再提供本资料。');}
   if(b.dataset.community==='add-question'){const qs=JSON.parse($('#material-questions').value);if(!Array.isArray(qs))throw Error('题目列表必须是数组。');const q={kind:'mc',stem:$('#material-stem').value.trim(),options:[...'ABCD'].map(a=>$('#material-option-'+a).value.trim()),answer:$('#material-answer').value,analysis:$('#material-analysis').value.trim()};if(!q.stem||q.options.some(o=>!o)||!q.analysis)throw Error('请填齐题干、四个选项与解析。');qs.push(q);$('#material-questions').value=JSON.stringify(qs,null,2);for(const el of document.querySelectorAll('.community-builder details textarea'))el.value='';toast('已添加第'+qs.length+'题。');}
   if(b.dataset.community==='template'){const sample=[{kind:'mc',stem:'选择题题干',options:['选项A','选项B','选项C','选项D'],answer:'A',analysis:'答案依据'},{kind:'fill',stem:'填空题题干',accepted:['answer'],analysis:'答案依据'},{kind:'order',stem:'排列以下段落',paragraphs:{A:'第一段',B:'第二段',C:'第三段'},accepted:['ABC'],analysis:'顺序依据'},{kind:'translation',stem:'翻译要求',text:'待翻译文本',reference:'参考译文',analysis:'评分要点'},{kind:'writing',stem:'作文要求',reference:'参考思路',analysis:'评分要点'}];const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(sample,null,2)],{type:'application/json'}));a.href=url;a.download='shared-question-template.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(e){toast(e.message);}
 },
 change(event){if(event.target.id==='material-subject')this.formOptions();if(event.target.id==='material-upload')this.upload(event.target);if(['community-subject','community-mine'].includes(event.target.id))this.filter();}
};
