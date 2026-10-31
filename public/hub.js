'use strict';
const Hub={
  data:null,school:'pku',packet:null,packetMeta:null,writtenMeta:null,answers:{},review:false,
  records:[],drafts:new Map(),draft:null,timer:null,routeToken:0,busy:false,saveError:'',
  e:s=>escapeHTML(s==null?'':s),
  schoolById(id){return this.data.schools.find(s=>s.id===id);},
  schoolLabel(s){return s.short+' · '+(s.id==='speit'?'法语':s.track);},
  dateText(iso,withTime=false){return new Date(iso).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'numeric',day:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}:{})});},
  id(prefix){
    if(typeof crypto.randomUUID==='function')return prefix+'-'+crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
    return prefix+'-'+[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  },
  fmt:s=>String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')+':'+String(Math.floor(Math.max(0,s)%60)).padStart(2,'0'),
  paragraphs(text,cls=''){return String(text||'').split(/\n\s*\n/).map(p=>`<p class="${cls}">${this.e(p).replace(/\n/g,'<br>')}</p>`).join('');},
  safeUrl(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'';}catch{return '';}},
  sourceLink(item){const url=this.safeUrl(item.source?.url);return `${this.e(item.source?.label||'原创训练材料')}${url?` <a href="${this.e(url)}" target="_blank" rel="noopener" class="text-link">原文 ↗</a>`:''}`;},
  async api(path='',body){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/archive'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal,credentials:'same-origin'});
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error('云端连接需要重新登录，请保留当前页面并先导出内容。');
      const json=await response.json();if(!response.ok)throw Error(json.error||'云端操作未完成');return json;
    }catch(error){if(error.name==='AbortError')throw Error('云端响应超时，内容仍在当前页面，可重试或先导出。');throw error;}finally{clearTimeout(timeout);}
  },
  async store(kind,schoolId,title,payload,meta){
    const result=await this.api('',{id:meta?.id||this.id(kind),kind,schoolId,title,payload,expectedRevision:meta?.revision||0});
    return result.record;
  },
  init(data){
    this.data=data;
    document.querySelector('[data-view="oral"] .nav-count').textContent=data.oralItems.length;
    $('#screen').addEventListener('click',event=>this.click(event));
    $('#screen').addEventListener('submit',event=>{if(event.target.id==='hub-studio'){event.preventDefault();this.generate(event.target);}});
    $('#screen').addEventListener('change',event=>this.change(event));
    $('#screen').addEventListener('input',event=>this.input(event));
    $('#screen').addEventListener('toggle',event=>{if(event.target.classList?.contains('hub-reference')&&event.target.open&&this.draft){this.draft.referenceSeen=true;this.draft.dirty=true;}},true);
    $('#hub-import-file').addEventListener('change',event=>this.importPacket(event));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pauseTimer();});
    setInterval(()=>this.tick(),500);
  },
  leave(){this.routeToken++;this.pauseTimer();},
  page(view,title){
    if(currentPaper)pauseAll();currentPaper=null;currentView=view;this.pauseTimer();
    document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);el.setAttribute('aria-current',el.dataset.view===view?'page':'false');});
    this.routeToken++;$('#breadcrumb').innerHTML='备考空间 <i>/</i> '+this.e(title);window.scrollTo({top:0,behavior:'instant'});
  },
  route(hash){
    if(hash.startsWith('school/')){const school=this.schoolById(hash.slice(7));if(!school)return false;this.school=school.id;this.page('schools',this.schoolLabel(school));this.renderSchool(school);return true;}
    if(hash.startsWith('task/')){const [,schoolId,id]=hash.split('/');const item=this.data.oralItems.find(q=>q.id===id&&q.schoolIds.includes(schoolId));if(!item)return false;this.school=schoolId;this.page('oral','口试训练');this.renderTask(item,schoolId);return true;}
    if(hash.startsWith('packet/')){this.page('saved','训练卷');this.loadPacket(hash.slice(7));return true;}
    if(hash.startsWith('run/')){const [,id,index]=hash.split('/');this.page('oral','组合口试');this.loadRun(id,Number(index));return true;}
    if(hash.startsWith('attempt/')){this.page('saved','练习复盘');this.loadAttempt(hash.slice(8));return true;}
    return false;
  },
  render(view){if(view==='schools')this.renderSchools();if(view==='studio')this.renderStudio();if(view==='oral')this.renderOralBank();if(view==='saved')this.renderSaved();},
  schoolOptions(selected=this.school){return this.data.schools.map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${this.e(this.schoolLabel(s))}</option>`).join('');},
  levelOptions(){return '<option value="all">全部层级</option><option value="基础">基础</option><option value="进阶">进阶</option><option value="挑战">挑战</option>';},
  typesFor(schoolId){return Object.keys(this.data.types).filter(type=>this.data.oralItems.some(q=>q.type===type&&q.schoolIds.includes(schoolId)));},
  renderSchools(){
    const total=bank.papers.reduce((n,p)=>n+p.count,0)+this.data.writtenExtra.length;
    $('#screen').innerHTML=`<section class="hero hub-hero"><div class="hero-copy"><h1>从一套试卷，<br>走向你的六校备考。</h1><a class="btn primary hub-hero-btn" href="#studio">开始组卷 <span>↗</span></a></div><div class="hero-art" aria-hidden="true"><div class="art-ring"></div><div class="paper-art"><span class="letter">6.</span><span class="art-caption">六校 · 各有方向</span></div></div></section><div class="stats"><div class="stat"><strong>06</strong><small>学校</small></div><div class="stat"><strong>${this.data.oralItems.length}</strong><small>口试任务</small></div><div class="stat"><strong>${total}</strong><small>笔试题目</small></div><div class="stat"><strong>2027</strong><small>备考年度</small></div></div><div class="section-top"><div><h2>你的目标学校</h2></div></div><div class="hub-school-grid">${this.data.schools.map((s,i)=>`<article class="hub-school-card" style="--school-color:${s.color}"><div class="hub-school-top"><span class="hub-region">${this.e(s.region)}</span></div><h3>${this.e(s.name)}</h3><div class="hub-track">${this.e(s.track)}</div><div class="hub-tags">${s.focus.map(t=>`<span>${this.e(t)}</span>`).join('')}</div><div class="hub-school-footer"><span>${s.subjects.join(' / ')} · ${this.data.oralItems.filter(q=>q.schoolIds.includes(s.id)).length} 项口试</span><a href="#school/${s.id}" aria-label="进入${this.e(s.short)}${s.id==='speit'?'':this.e(s.track)}专区">进入专区 ↗</a></div></article>`).join('')}</div><details class="help-note"><summary>资料与招生参考</summary><p>${this.e(this.data.policyNote)}</p><p>本站提供非官方训练材料。</p></details>`;
  },
  renderSchool(s){
    const items=this.data.oralItems.filter(q=>q.schoolIds.includes(s.id));
    $('#screen').innerHTML=`<a class="back-link" href="#schools">← 返回学校中心</a><section class="hub-school-heading" style="--school-color:${s.color}"><div><h1>${this.e(s.name)}<span>${this.e(s.track)}</span></h1><p>${this.e(s.tagline)}</p></div><div class="hub-heading-actions"><button class="btn primary" data-hub="school-studio">生成训练卷 ↗</button><button class="btn secondary" data-hub="school-oral">进入口试题库</button></div></section><div class="hub-profile-grid"><article class="hub-panel"><span class="hub-kicker">公开要求 · 2026参考</span><h2>笔试与面试</h2><p>${this.e(s.writtenNote)}</p><p>${this.e(s.oralOfficial)}</p><a class="text-link" href="${this.e(s.sourceUrl)}" target="_blank" rel="noopener">${this.e(s.sourceLabel)} ↗</a>${s.secondaryUrl?`<br><a class="text-link" href="${this.e(s.secondaryUrl)}" target="_blank" rel="noopener">公开转载 / 正文核对 ↗</a>`:''}</article><article class="hub-panel"><span class="hub-kicker">本站训练设计</span><h2>${this.e(s.profileFocus)}</h2><p>${this.e(s.oralTraining)}</p><p class="hub-muted">${this.e(s.userFormat)}</p><div class="hub-tags">${s.focus.map(f=>`<span>${this.e(f)}</span>`).join('')}</div></article></div><div class="section-top"><div><h2>口试组合</h2><p>各抽一项，包含题目、追问与参考思路。顺序和时长是训练设置。</p></div></div><div class="hub-recipe">${s.oralRecipe.map((t,i)=>`<div><small>0${i+1}</small><b>${this.e(this.data.types[t])}</b><span>${items.filter(q=>q.type===t).length} 项可选</span></div>`).join('')}</div><button class="btn primary" data-hub="school-session">生成一场口试组合</button><div class="section-top hub-space"><div><h2>先练一道</h2><p>不同学校采用不同组合；相同阅读或文化基础题可共享。</p></div><button class="text-link" data-hub="school-oral">查看 ${items.length} 项 →</button></div><div class="hub-task-grid">${items.filter(q=>q.type===s.oralRecipe[0]||q.schoolIds.length===1).slice(0,4).map(q=>this.taskCard(q,s.id)).join('')}</div><div class="archive-note">${this.e(this.data.policyNote)}</div>`;
  },
  taskCard(item,schoolId){return `<article class="hub-task-card"><div class="hub-card-meta"><span>${this.e(this.data.types[item.type])}</span><span>${this.e(item.level)}</span></div><h3><a href="#task/${schoolId}/${item.id}">${this.e(item.title)}</a></h3><p>${this.e(item.prompt).slice(0,95)}${item.prompt.length>95?'…':''}</p><div class="hub-task-bottom"><span>${this.e(item.language)}</span><a href="#task/${schoolId}/${item.id}">开始练习 ↗</a></div></article>`;},
  renderStudio(){
    $('#screen').innerHTML=`<div class="page-heading"><h1>组卷工作台</h1><p>选择学校与训练方式，从当前题库抽取一份训练卷，生成后保存到私人云端档案。</p></div><div class="hub-studio-layout simplified-studio"><form id="hub-studio" class="hub-panel hub-form"><div class="hub-form-head"><span class="hub-step">01</span><h2>设定今天的训练</h2></div><label>目标学校<select name="school" id="hub-school">${this.schoolOptions()}</select></label><label>训练方式<select name="mode" id="hub-mode"><option value="oral">口试组合 / 专项</option><option value="written">笔试专项模拟卷</option></select></label><div id="hub-dynamic-fields"></div><label>训练卷名称 <span class="hub-muted">（可选）</span><input name="title" maxlength="120" placeholder="留空则按学校与训练类型命名"></label><div class="hub-form-footer"><button type="submit" class="btn primary" id="hub-generate">生成训练卷 ↗</button><span id="hub-studio-status" role="status"></span></div></form></div>`;
    this.studioFields();
  },
  studioFields(){
    const school=$('#hub-school').value;this.school=school;const s=this.schoolById(school),mode=$('#hub-mode').value;
    const oldSubject=$('#hub-subject')?.value,oldType=$('#hub-type')?.value;
    $('#hub-dynamic-fields').innerHTML=mode==='oral'?`<label>口试类型<select name="type" id="hub-type"><option value="session">按该校配置组合一场</option>${this.typesFor(school).map(t=>`<option value="${t}" ${oldType===t?'selected':''}>${this.e(this.data.types[t])}</option>`).join('')}</select></label><div class="hub-form-pair"><label>训练层级<select name="level">${this.levelOptions()}</select></label><label>专项抽题数<select name="count" id="hub-count"><option value="1">1 项</option><option value="3" selected>3 项</option><option value="5">5 项</option></select></label></div><p id="hub-pool-info" class="hub-form-note"></p>`:`<label>笔试科目<select name="subject" id="hub-subject">${s.subjects.map(x=>`<option ${x===oldSubject?'selected':''}>${x}</option>`).join('')}</select></label><div id="hub-written-options"></div>`;
    if(mode==='oral')this.oralFields();else this.writtenFields();
  },
  oralFields(){const type=$('#hub-type').value,s=this.schoolById(this.school);$('#hub-count').disabled=type==='session';$('#hub-pool-info').textContent=type==='session'?s.oralRecipe.map(t=>this.data.types[t]).join(' → ')+'。各抽1项。':`当前学校有 ${this.data.oralItems.filter(q=>q.schoolIds.includes(s.id)&&q.type===type).length} 项；筛选层级后数量可能减少。`;},
  writtenFields(){
    const subject=$('#hub-subject').value,school=this.schoolById(this.school);
    $('#hub-written-options').innerHTML=`${subject==='英语'?'<label>题型范围<select name="scope" id="hub-scope"><option value="mixed">综合：语言知识 + 完整阅读</option><option value="grammar">语言知识：词汇与语法</option><option value="reading">阅读理解：整篇抽取</option><option value="cloze">完形填空：完整一篇</option></select></label>':''}<div class="hub-form-pair"><label>训练层级<select name="level" ${subject==='语文'?'disabled':''}>${this.levelOptions()}</select></label><label>题量<select name="count" id="hub-written-count">${(subject==='语文'?[25]:[5,10,15,20]).map(n=>`<option value="${n}" ${n===(subject==='语文'?25:20)?'selected':''}>${n} 题</option>`).join('')}</select></label></div><label>限时（分钟）<input name="minutes" type="number" value="${subject==='语文'?60:30}" min="1" max="240" required></label><p class="hub-form-note">${this.e(school.writtenNote)}<br>${subject==='语文'?'当前语文为文学素养提升版作家选文整卷，保留一篇中国、一篇外国现代文及全部配套题；本次不会生成新文章。':'本版专项卷统一折合100分，题量与限时属于训练设置。层级为命题标记，未经过实测等值。'}</p>`;
    if(subject==='英语')this.scopeFields();
  },
  scopeFields(){const scope=$('#hub-scope').value;const counts=scope==='cloze'?[15]:scope==='reading'?[5,10,15]:scope==='mixed'?[10,15,20]:[5,10,15,20];$('#hub-written-count').innerHTML=counts.map(n=>`<option value="${n}" ${n===counts.at(-1)?'selected':''}>${n} 题</option>`).join('');},
  async generate(form){
    if(this.busy)return;const fd=new FormData(form);let packet;
    try{const args={bank,hub:this.data,schoolId:fd.get('school'),level:fd.get('level')||'all',count:Number(fd.get('count'))};packet=fd.get('mode')==='oral'?HubEngine.makeOral({...args,type:fd.get('type')}):HubEngine.makeWritten({...args,subject:fd.get('subject'),scope:fd.get('scope')||'mixed',minutes:Number(fd.get('minutes'))});const title=String(fd.get('title')||'').trim();if(title)packet.title=title;}catch(error){$('#hub-studio-status').textContent=error.message;toast(error.message);return;}
    await this.createPacket(packet);
  },
  async createPacket(packet){
    if(this.busy){toast('上一项保存仍在进行，请稍候。');return;}
    this.busy=true;this.packet={...packet,id:this.id('packet')};this.packetMeta={id:this.packet.id,revision:0};this.writtenMeta=null;this.writtenReferenceSeen=false;this.answers={};this.review=false;this.saveError='';
    const button=$('#hub-generate');if(button){button.disabled=true;button.textContent='正在组卷并保存…';}
    try{if(PublicApp.session.authenticated)this.packetMeta=await this.store('packet',packet.schoolId,packet.title,this.packet,this.packetMeta);}catch(error){this.saveError=error.message;}finally{this.busy=false;}
    location.hash='packet/'+this.packet.id;
  },
  async loadPacket(id){
    const token=++this.routeToken;
    if(this.packet?.id===id){this.renderPacket();return;}
    $('#screen').innerHTML='<div class="loading">正在读取云端训练卷…</div>';
    try{const record=await this.api('?id='+encodeURIComponent(id));if(token!==this.routeToken||!location.hash.endsWith(id))return;if(record.kind!=='packet')throw Error('这是一份练习记录，请从云端档案打开。');this.validatePacket(record.payload);this.packet=record.payload;this.packetMeta=record;this.answers={};this.review=false;this.writtenMeta=null;this.writtenReferenceSeen=false;this.saveError='';this.renderPacket();}catch(error){if(token===this.routeToken)this.errorPage(error.message);}
  },
  safeRich(html){
    const template=document.createElement('template');template.innerHTML=String(html||'');
    const allowed=new Set(['SPAN','BR','STRONG','B','EM','I','SUB','SUP','IMG']);
    const walk=node=>{for(const el of [...node.children]){if(!allowed.has(el.tagName)){el.replaceWith(document.createTextNode(el.textContent));continue;}if(el.tagName==='IMG'){const src=el.getAttribute('src')||'';const alt=el.getAttribute('alt')||'';const w=el.style.width,h=el.style.height;if(!/^math\/[a-f0-9]+\.svg$/.test(src)){el.replaceWith(document.createTextNode(alt));continue;}for(const attr of [...el.attributes])el.removeAttribute(attr.name);el.src=src;el.alt=alt;el.className='formula';if(/^[\d.]+em$/.test(w))el.style.width=w;if(/^[\d.]+em$/.test(h))el.style.height=h;}else{for(const attr of [...el.attributes])el.removeAttribute(attr.name);walk(el);}}};walk(template.content);return template.innerHTML;
  },
  packetTools(){return `<div class="hub-packet-tools no-print"><button class="btn secondary" data-hub="packet-json">导出试卷与作答</button><button class="btn secondary" data-hub="import-packet">导入备份</button><button class="btn secondary" data-hub="packet-markdown">导出题目与参考</button><button class="btn secondary" data-hub="print">打印 / 存为 PDF</button><a class="text-link" href="#saved">我的学习档案 →</a></div>`;},
  renderPacket(){
    const p=this.packet;if(!p)return;this.school=p.schoolId;const isWritten=p.kind==='written';
    $('#screen').innerHTML=`<a class="back-link" href="#school/${this.e(p.schoolId)}">← 返回学校专区</a><header class="exam-header"><div><h1>${this.e(p.title)}</h1><div class="meta">${this.e(p.schoolName)} · ${p.count} ${isWritten?'题 · 100分 · '+p.minutes+'分钟':'项口试任务'} · ${this.dateText(p.createdAt)}</div></div><span class="hub-cloud-state ${this.packetMeta?.revision?'saved':'unsaved'}">${this.packetMeta?.revision?'✓ 已保存云端':'尚未保存云端'}</span></header>${this.saveError?`<div class="notice no-print">${this.e(this.saveError)} <button class="text-link" data-hub="retry-packet-save">重试保存 →</button></div>`:''}${this.packetTools()}<div class="hub-form-note">${this.e(p.note)}</div>${isWritten?this.writtenPacketHTML():this.oralPacketHTML()}<div class="hub-print-footer">燕园备考 · 非官方训练材料 · ${this.e(p.schoolName)} · ${this.e(p.createdAt.slice(0,10))}</div>`;
    if(isWritten)this.restoreWrittenTimer();
  },
  writtenPacketHTML(){
    const p=this.packet,grade=this.review?HubEngine.grade(p,this.answers):null;
    return `<div class="hub-written-toolbar no-print"><div><b id="hub-written-clock">${this.fmt(p.minutes*60)}</b><button class="btn secondary" data-hub="written-timer" id="hub-written-timer-button">开始计时</button><span id="hub-written-progress">已答 ${Object.keys(this.answers).length}/${p.count}</span></div><div><button class="btn primary" data-hub="written-submit">核对答案</button><button class="btn secondary" data-hub="written-answers">${this.review?'隐藏参考':'查看参考'}</button></div></div>${grade?`<div class="hub-result no-print"><strong>${grade.score}<small> / 100</small></strong><span>答对 ${grade.correct}/${grade.total} · 未答 ${grade.total-grade.answered} 题<br>${this.writtenMeta?.revision?'本次作答已保存云端':'本次核分尚未保存云端'}</span></div>`:''}<div class="hub-generated-paper">${p.blocks.map((block,bi)=>`${block.text?`<article class="reading ${p.subject==='英语'?'english-text':''}"><h3>${this.e(block.title)}</h3><div class="reading-source">${this.e(block.source)}${this.safeUrl(block.sourceUrl)?` <a href="${this.e(block.sourceUrl)}" target="_blank" rel="noopener">出处 ↗</a>`:''}</div>${block.poem?`<p class="poem">${this.e(block.text)}</p>`:(block.paragraphs?.length?block.paragraphs.map(t=>`<p>${this.safeRich(t)}</p>`).join(''):this.paragraphs(block.text))}${block.note?`<div class="reading-note">${this.e(block.note)}</div>`:''}</article>`:''}${block.questions.map(q=>`<article class="question ${this.review?'review':''}"><div class="question-head"><span class="question-num">${q.id}</span><div class="question-stem ${p.subject==='英语'?'en':''}">${this.safeRich(q.stemHtml||this.e(q.stem))}</div><span class="question-points">${q.points} 分</span></div><div class="options ${p.subject==='数学'||block.type==='grammar'?'compact':''}" role="radiogroup" aria-label="第 ${q.id} 题">${q.options.map((o,i)=>{const key='ABCD'[i];return `<label class="option ${this.review&&q.answer===key?'correct':''} ${this.review&&this.answers[q.id]===key&&q.answer!==key?'wrong':''}"><input type="radio" name="hub-q-${q.id}" data-hub-question="${q.id}" value="${key}" ${this.answers[q.id]===key?'checked':''}><span class="option-letter">${key}</span><span>${this.safeRich(q.optionsHtml?.[i]||this.e(o))}</span></label>`;}).join('')}</div>${this.review?`<details class="analysis hub-reference" open><summary>正确答案 ${this.e(q.answer)} · ${this.e(q.tag)}</summary><p>${this.safeRich(q.analysisHtml||this.e(q.analysis))}</p></details>`:''}</article>`).join('')}`).join('')}</div>`;
  },
  oralPacketHTML(){return `<div class="hub-session-list">${this.packet.items.map((q,i)=>`<article class="hub-session-item"><div class="hub-session-number">${String(i+1).padStart(2,'0')}</div><div><div class="hub-card-meta"><span>${this.e(this.data.types[q.type])}</span><span>${this.e(q.level)}</span></div><h2>${this.e(q.title)}</h2><p>${this.e(q.prompt).replace(/\n/g,'<br>')}</p><div class="hub-source-note">${this.sourceLink(q)}</div>${q.text?`<div class="hub-packet-passage ${q.language==='English'?'english-copy':''}">${this.paragraphs(q.text)}</div>`:''}<details class="hub-reference"><summary>参考思路与追问</summary>${this.referenceHTML(q)}</details><a class="btn primary no-print" href="#run/${this.packet.id}/${i}">计时练习这一项 ↗</a></div></article>`).join('')}</div>`;},
  referenceHTML(q){return `<div class="hub-reference-body"><h3>参考思路</h3><ol>${(q.guide||[]).map(g=>`<li>${this.e(g)}</li>`).join('')}</ol>${q.terms?.length?`<h3>词汇 / 术语</h3><ul>${q.terms.map(t=>`<li>${this.e(t)}</li>`).join('')}</ul>`:''}<h3>${['zh-en','en-zh'].includes(q.type)?'参考译文':'参考回答 / 组织方法'}</h3><div class="hub-reference-answer">${this.paragraphs(q.reference)}</div><h3>追问</h3><ol>${(q.followups||[]).map(f=>`<li>${this.e(f)}</li>`).join('')}</ol></div>`;},
  async loadRun(id,index){
    const token=++this.routeToken;
    try{let p=this.packet;if(p?.id!==id){$('#screen').innerHTML='<div class="loading">正在读取口试组合…</div>';const record=await this.api('?id='+encodeURIComponent(id));if(token!==this.routeToken)return;this.validatePacket(record.payload);this.packet=p=record.payload;this.packetMeta=record;}
      if(p.kind!=='oral'||!Number.isSafeInteger(index)||index<0||index>=p.items.length)throw Error('未找到这项口试任务');this.renderTask(p.items[index],p.schoolId,{packetId:p.id,index,total:p.items.length});
    }catch(error){this.errorPage(error.message);}
  },
  renderOralBank(){
    $('#screen').innerHTML=`<div class="page-heading"><h1>口试训练</h1><p>先独立作答，再打开参考思路。国别问题兼顾事实、解释与反例；计时均为训练设置。</p></div><div class="hub-filter-bar"><label>学校<select id="hub-oral-school">${this.schoolOptions()}</select></label><label>题型<select id="hub-oral-type"><option value="all">全部题型</option>${this.typesFor(this.school).map(t=>`<option value="${t}">${this.e(this.data.types[t])}</option>`).join('')}</select></label><label>层级<select id="hub-oral-level">${this.levelOptions()}</select></label><label class="hub-search-label">关键词<input id="hub-oral-query" type="search" placeholder="如：物哀、工程、翻译"></label></div><div class="section-top"><p id="hub-filter-count" aria-live="polite"></p><button class="text-link" data-hub="random-task">随机练一道 ↗</button></div><div class="hub-task-grid" id="hub-oral-results"></div>`;this.filterOral();
  },
  filterOral(){
    this.school=$('#hub-oral-school').value;const type=$('#hub-oral-type').value,level=$('#hub-oral-level').value,query=$('#hub-oral-query').value.trim().toLocaleLowerCase();
    this.filteredItems=this.data.oralItems.filter(q=>q.schoolIds.includes(this.school)&&(type==='all'||type===q.type)&&(level==='all'||level===q.level)&&(!query||(q.title+' '+q.prompt+' '+q.guide.join(' ')).toLocaleLowerCase().includes(query)));
    $('#hub-filter-count').textContent=`找到 ${this.filteredItems.length} 项任务 · ${this.schoolById(this.school).short}`;
    $('#hub-oral-results').innerHTML=this.filteredItems.length?this.filteredItems.map(q=>this.taskCard(q,this.school)).join(''):'<div class="hub-empty">当前筛选没有匹配任务，请调整关键词或层级。</div>';
  },
  renderTask(item,schoolId,run=null,loaded=null){
    this.school=schoolId;this.activeTask=item;this.activeRun=run;
    const key=loaded?loaded.id+'@'+loaded.revision:schoolId+'|'+item.id;
    if(!this.drafts.has(key))this.drafts.set(key,{key,item:HubEngine.clone(item),schoolId,answer:'',reflection:'',nextStep:'',ratings:this.data.rubric.map(()=>''),reviewer:'self',referenceSeen:false,dirty:false,meta:null,...loaded?.payload,meta:loaded?{id:loaded.id,revision:loaded.revision}:null});
    this.draft=this.drafts.get(key);
    const d=this.draft,total=this.totalScore(d.ratings);
    if(!this.timer||this.timer.key!==key)this.timer={key,phase:'idle',remaining:item.prepSeconds,running:false,until:0,elapsed:Number(d.elapsedSeconds)||0,lastStart:null,hideSource:true};
    $('#screen').innerHTML=`<a class="back-link" href="${run?'#packet/'+run.packetId:'#oral'}">← ${run?'返回口试组合':'返回口试题库'}</a><header class="exam-header"><div><h1>${this.e(item.title)}</h1><div class="meta">${this.e(item.language)} · ${this.e(item.level)} · 准备 ${this.fmt(item.prepSeconds)} / 作答 ${this.fmt(item.answerSeconds)}</div></div><span class="hub-cloud-state ${d.meta?'saved':'unsaved'}" id="hub-draft-state">${d.meta?'已保存云端':'当前练习未保存'}</span></header><div class="hub-oral-layout"><div><article class="hub-panel hub-task-prompt"><span class="hub-kicker">任务</span><div class="hub-instruction">${this.e(item.prompt).replace(/\n/g,'<br>')}</div>${item.text?`<div class="hub-source-heading"><span>阅读 / 口译材料</span><button class="text-link" data-hub="toggle-source">显示 / 遮盖原文</button></div><div id="hub-source-panel" class="hub-source-panel ${item.language==='English'?'english-copy':''}"><div class="hub-mask-note">原文已遮盖，先独立作答。</div><div class="hub-source-content">${this.paragraphs(item.text)}</div></div>`:''}<div class="hub-source-note">${this.sourceLink(item)}${item.source?.note?`<br>${this.e(item.source.note)}`:''}</div></article><article class="hub-panel hub-space"><span class="hub-kicker">先回答，再核对</span><h2>留下你的表达与反思</h2><label class="hub-field">作答转写 / 口头要点<textarea id="hub-answer" data-hub-field="answer" rows="8" placeholder="可粘贴语音转写，或记录你的回答要点…">${this.e(d.answer)}</textarea></label><div class="hub-form-pair"><label class="hub-field">本次问题<textarea data-hub-field="reflection" rows="4" placeholder="如：漏译限定语、例子不够具体…">${this.e(d.reflection)}</textarea></label><label class="hub-field">下次怎样改<textarea data-hub-field="nextStep" rows="4" placeholder="写下一项可以落实的改进…">${this.e(d.nextStep)}</textarea></label></div><details class="hub-reference"><summary>展开参考思路、参考回答与追问</summary>${this.referenceHTML(item)}</details></article></div><aside class="hub-oral-rail"><div class="hub-panel hub-clock-card"><span class="hub-kicker" id="hub-phase">准备阶段</span><div class="hub-clock" id="hub-task-clock">${this.fmt(this.timer.remaining)}</div><p>准备 ${this.fmt(item.prepSeconds)} → 作答 ${this.fmt(item.answerSeconds)}</p><button class="btn primary" data-hub="timer" id="hub-task-timer-button">开始准备</button><button class="btn secondary" data-hub="answer-phase">直接开始作答</button><button class="btn ghost" data-hub="finish-task">结束本题计时</button>${['zh-en','en-zh'].includes(item.type)?'<label class="hub-check"><input id="hub-hide-source" type="checkbox" checked>作答时遮盖原文</label>':''}</div><div class="hub-panel hub-space hub-rubric"><span class="hub-kicker">自评 / 教师评分 · 满分100</span><label class="hub-field">评分人<select data-hub-field="reviewer"><option value="self" ${d.reviewer==='self'?'selected':''}>自评</option><option value="teacher" ${d.reviewer==='teacher'?'selected':''}>教师 / 同伴</option></select></label>${this.data.rubric.map((r,i)=>`<label class="hub-score-row" title="${this.e(r.hint)}"><span>${this.e(r.name)}<small> / ${r.max}</small></span><input aria-label="${this.e(r.name)}得分" data-hub-rating="${i}" type="number" min="0" max="${r.max}" step="1" value="${d.ratings[i]}" placeholder="—"></label>`).join('')}<div class="hub-total" id="hub-total">${total===null?'未评分':total+' / 100'}</div><p class="hub-muted">五项填全后才计总分；语音项须根据实际口头表现评定。此处不自动判断你的口语水平。</p><button class="btn primary" data-hub="save-attempt" id="hub-save-attempt">保存作答与复盘</button><button class="btn secondary" data-hub="attempt-export">导出当前练习</button><span id="hub-save-status" role="status" class="hub-form-note"></span></div>${run&&run.index+1<run.total?`<a class="btn secondary hub-next" href="#run/${run.packetId}/${run.index+1}">下一项任务 →</a>`:''}</aside></div>`;
    this.updateTaskClock();
  },
  totalScore(ratings){if(!Array.isArray(ratings)||ratings.length!==this.data.rubric.length||ratings.some((n,i)=>n===''||!Number.isInteger(Number(n))||Number(n)<0||Number(n)>this.data.rubric[i].max))return null;return ratings.reduce((a,n)=>a+Number(n),0);},
  timerRemaining(){return this.timer?.running?Math.max(0,(this.timer.until-Date.now())/1000):(this.timer?.remaining||0);},
  pauseTimer(){
    const t=this.timer;if(t?.running){t.remaining=this.timerRemaining();t.elapsed+=(Date.now()-t.lastStart)/1000;t.running=false;t.lastStart=null;this.updateTaskClock();}
    const w=this.writtenTimer;if(w?.running){w.remaining=Math.max(0,(w.until-Date.now())/1000);w.elapsed+=(Date.now()-w.lastStart)/1000;w.running=false;w.lastStart=null;this.updateWrittenClock();}
  },
  startTimer(){const t=this.timer;if(!t)return;if(t.running){this.pauseTimer();return;}if(t.phase==='finished'){toast('本题计时已结束；作答和复盘仍可保存。');return;}if(t.phase==='idle')t.phase='prepare';t.running=true;t.lastStart=Date.now();t.until=Date.now()+t.remaining*1000;this.updateTaskClock();},
  answerPhase(){const t=this.timer;this.pauseTimer();t.phase='answer';t.remaining=this.activeTask.answerSeconds;t.running=true;t.lastStart=Date.now();t.until=Date.now()+t.remaining*1000;this.updateTaskClock();},
  tick(){
    const t=this.timer;if(t?.running){if(this.timerRemaining()<=0){const over=Math.max(0,(Date.now()-t.until)/1000);t.elapsed+=(Date.now()-t.lastStart)/1000;if(t.phase==='prepare'){t.phase='answer';t.remaining=Math.max(0,this.activeTask.answerSeconds-over);t.until=Date.now()+t.remaining*1000;t.lastStart=Date.now();toast('准备结束，开始作答。');}else{t.phase='finished';t.remaining=0;t.running=false;t.lastStart=null;toast('本题作答计时结束，可保存要点与复盘。');}}this.updateTaskClock();}
    const w=this.writtenTimer;if(w?.running){if(Date.now()>=w.until){w.elapsed+=(Date.now()-w.lastStart)/1000;w.remaining=0;w.running=false;w.lastStart=null;toast('专项卷计时结束，请提交核分。');}this.updateWrittenClock();}
  },
  updateTaskClock(){
    if(!$('#hub-task-clock')||!this.timer)return;const t=this.timer;
    $('#hub-task-clock').textContent=this.fmt(Math.ceil(this.timerRemaining()));$('#hub-phase').textContent={idle:'尚未开始',prepare:'准备阶段',answer:'作答阶段',finished:'计时结束'}[t.phase];
    $('#hub-task-timer-button').textContent=t.running?'暂停计时':t.phase==='idle'?'开始准备':t.phase==='finished'?'计时已结束':'继续计时';$('#hub-task-timer-button').disabled=t.phase==='finished';
    const panel=$('#hub-source-panel');if(panel)panel.classList.toggle('is-masked',!!t.manuallyMasked||(t.phase==='answer'&&t.hideSource&&['zh-en','en-zh'].includes(this.activeTask.type)&&!t.manuallyRevealed));
  },
  restoreWrittenTimer(){if(!this.writtenTimer||this.writtenTimer.id!==this.packet.id)this.writtenTimer={id:this.packet.id,remaining:this.packet.minutes*60,elapsed:0,running:false};this.updateWrittenClock();},
  updateWrittenClock(){if(!$('#hub-written-clock')||!this.writtenTimer)return;const w=this.writtenTimer;$('#hub-written-clock').textContent=this.fmt(Math.ceil(w.running?(w.until-Date.now())/1000:w.remaining));$('#hub-written-timer-button').textContent=w.running?'暂停计时':w.remaining<=0?'计时结束':w.elapsed?'继续计时':'开始计时';$('#hub-written-timer-button').disabled=w.remaining<=0&&!w.running;},
  async saveAttempt(){
    if(this.busy)return;const d=this.draft;if(!d.answer.trim()){toast('先填写作答转写或口头要点，再保存练习记录。');return;}
    if(d.ratings.some((n,i)=>n!==''&&(!Number.isInteger(Number(n))||Number(n)<0||Number(n)>this.data.rubric[i].max))){toast('评分须为各项满分范围内的整数。');return;}
    this.pauseTimer();this.busy=true;$('#hub-save-attempt').disabled=true;$('#hub-save-status').textContent='正在保存…';
    const payload={schema:1,item:d.item,schoolId:d.schoolId,answer:d.answer,reflection:d.reflection,nextStep:d.nextStep,ratings:d.ratings,reviewer:d.reviewer,total:this.totalScore(d.ratings),referenceSeen:d.referenceSeen,elapsedSeconds:this.timer?.elapsed||0,packetId:this.activeRun?.packetId||d.packetId||null,completedAt:new Date().toISOString()};
    try{d.meta=await this.store('oral-attempt',d.schoolId,d.item.title,payload,d.meta);d.dirty=false;if(this.draft===d&&$('#hub-save-status')){$('#hub-save-status').textContent='已保存云端，可从“云端档案”重新打开。';$('#hub-draft-state').textContent='✓ 已保存云端';$('#hub-draft-state').className='hub-cloud-state saved';}toast('作答与复盘已保存。');}catch(error){if(this.draft===d&&$('#hub-save-status'))$('#hub-save-status').textContent=error.message;toast('尚未保存成功，当前内容仍保留在页面中。');}finally{this.busy=false;if($('#hub-save-attempt'))$('#hub-save-attempt').disabled=false;}
  },
  async submitWritten(){
    if(this.busy)return;if(!Object.keys(this.answers).length){toast('请先完成至少一道题，再提交核分。');return;}this.pauseTimer();const packet=this.packet,score=HubEngine.grade(packet,this.answers);this.review=true;this.busy=true;
    const payload={schema:1,packet:HubEngine.clone(packet),answers:{...this.answers},...score,elapsedSeconds:this.writtenTimer?.elapsed||0,referenceSeen:!!this.writtenReferenceSeen,completedAt:new Date().toISOString()};
    const unchanged=()=>this.packet===packet&&JSON.stringify(this.answers)===JSON.stringify(payload.answers);
    try{if(!PublicApp.session.authenticated){toast(`得分 ${score.score}/100，可导出作答。`);return;}const meta=await this.store('written-attempt',packet.schoolId,packet.title+' · 作答',payload,this.writtenMeta);if(unchanged()){this.writtenMeta=meta;this.saveError='';}toast(`得分 ${score.score}/100，作答已保存。`);}catch(error){if(unchanged())this.saveError=error.message;toast('核分完成，保存失败，可重试。');}finally{this.busy=false;if(this.packet===packet&&location.hash==='#packet/'+packet.id)this.renderPacket();}
  },
  async renderSaved(){
    const token=++this.routeToken;$('#screen').innerHTML='<div class="loading">正在读取私人云端档案…</div>';
    try{const result=await this.api();if(token!==this.routeToken||currentView!=='saved')return;this.records=result.records;$('#screen').innerHTML=`<div class="page-heading"><h1>云端档案</h1><p>保存生成卷的完整快照，以及口试、笔试作答与复盘。在其他设备登录同一私人网站后可以继续查看。</p></div><div class="toolbar"><button class="btn primary" data-action="studio">生成一份训练卷</button><button class="btn secondary" data-hub="import-packet">导入训练卷备份</button><button class="btn secondary" data-hub="backup-legacy">备份旧版本机练习到云端</button></div><div class="hub-filter-bar"><label>学校<select id="hub-saved-school"><option value="all">全部学校</option>${this.schoolOptions('none')}</select></label><label>类型<select id="hub-saved-kind"><option value="all">全部档案</option><option value="packet">生成的训练卷</option><option value="oral-attempt">口试作答与复盘</option><option value="written-attempt">笔试作答与核分</option><option value="legacy-backup">旧版本机记录备份</option></select></label><button class="btn secondary" data-hub="refresh-saved">刷新</button></div><div id="hub-saved-results"></div><div class="archive-note">显示最近 ${result.limit} 份档案。旧版三科在线作答仍使用原本机记录；点击上方备份按钮可另存云端副本。评分为训练反馈，不推算录取概率。</div>`;this.filterSaved();}catch(error){if(token===this.routeToken)this.errorPage(error.message,'云端档案暂时无法打开');}
  },
  filterSaved(){const school=$('#hub-saved-school').value,kind=$('#hub-saved-kind').value;const records=this.records.filter(r=>(school==='all'||school===r.schoolId)&&(kind==='all'||kind===r.kind));const kinds={'packet':'训练卷','oral-attempt':'口试复盘','written-attempt':'笔试作答','legacy-backup':'旧版备份'};$('#hub-saved-results').innerHTML=records.length?`<div class="record-list">${records.map(r=>`<article class="record-row"><span class="hub-record-kind">${kinds[r.kind]||'档案'}</span><div class="record-detail"><h3>${this.e(r.title)}</h3><p>${this.e(this.schoolById(r.schoolId)?.short||'旧版三科')} · ${this.dateText(r.updatedAt,true)} · v${r.revision}</p></div><a class="btn secondary" href="#${r.kind==='packet'?'packet':'attempt'}/${this.e(r.id)}">打开 ↗</a></article>`).join('')}</div>`:'<div class="empty-state"><div class="empty-mark">▤</div><h2>这里会留下你的训练</h2><p>生成第一份训练卷，或在口试题目中保存作答与复盘。</p><a class="btn primary" href="#studio">开始组卷</a></div>';},
  async loadAttempt(id){
    const token=++this.routeToken;$('#screen').innerHTML='<div class="loading">正在读取作答与复盘…</div>';
    try{const record=await this.api('?id='+encodeURIComponent(id));if(token!==this.routeToken)return;
      if(typeof StudyFlow!=='undefined'&&StudyFlow.restoreAttempt(record))return;
      if(record.kind==='review-attempt'){await MistakeUI.load(record.payload.parentId);MistakeUI.redo=true;MistakeUI.redoAnswers=record.payload.answers;MistakeUI.reviewMeta=record;MistakeUI.renderRecord();const result=$('#mistake-redo-result');if(result)result.textContent='本次复习答对 '+record.payload.correct+'/'+record.payload.total+'，已作答 '+record.payload.answered+' 题；首次报错保留。';return;}
      if(record.kind==='oral-attempt'){this.renderTask(record.payload.item,record.schoolId,null,record);return;}
      if(record.kind==='written-attempt'){this.validatePacket(record.payload.packet);this.packet=record.payload.packet;this.packetMeta={id:this.packet.id,revision:1};this.writtenMeta=record;this.answers=record.payload.answers||{};this.review=true;this.writtenTimer={id:this.packet.id,remaining:Math.max(0,this.packet.minutes*60-record.payload.elapsedSeconds),elapsed:record.payload.elapsedSeconds,running:false};this.saveError='';this.renderPacket();return;}
      if(record.kind==='legacy-backup'){this.loadedLegacy=record;$('#screen').innerHTML=`<a class="back-link" href="#saved">← 返回云端档案</a><div class="page-heading"><h1>旧版三科练习备份</h1><p>${this.dateText(record.createdAt,true)} · ${record.payload.attempts?.length||0} 次提交。此副本保留原有试卷与版本标识。</p></div><button class="btn primary" data-hub="download-legacy">下载原格式 JSON</button><p class="hub-form-note">下载后可在“旧版本机练习”中导入合并，原有记录会保留。</p>`;return;}
      throw Error('此档案不是练习记录');
    }catch(error){if(token===this.routeToken)this.errorPage(error.message);}
  },
  validatePacket(p){
    if(!p||p.schema!==1||!this.schoolById(p.schoolId)||!['written','oral'].includes(p.kind)||typeof p.title!=='string'||!Number.isSafeInteger(p.count)||p.count<1||p.count>100)throw Error('训练卷格式不受支持。');
    if(p.kind==='oral'){if(!Array.isArray(p.items)||p.items.length!==p.count||p.items.some(q=>typeof q.id!=='string'||typeof q.title!=='string'||typeof q.prompt!=='string'||!Array.isArray(q.guide)||!Array.isArray(q.followups)||typeof q.reference!=='string'||typeof q.text!=='string'||!Number.isFinite(q.prepSeconds)||q.prepSeconds<1||q.prepSeconds>1800||!Number.isFinite(q.answerSeconds)||q.answerSeconds<1||q.answerSeconds>1800))throw Error('口试训练卷内容不完整。');}
    else{if(!Array.isArray(p.blocks)||!Number.isFinite(p.minutes)||p.minutes<1||p.minutes>240)throw Error('笔试设置不完整。');const qs=p.blocks.flatMap(b=>b.questions||[]);if(qs.length!==p.count||qs.reduce((n,q)=>n+q.points,0)!==100||qs.some((q,i)=>q.id!==i+1||!Array.isArray(q.options)||q.options.length!==4||!['A','B','C','D'].includes(q.answer)||!Number.isInteger(q.points)||q.points<1))throw Error('笔试题量、选项或分值不完整。');}
  },
  backupPractice(packet,raw){
    if(raw==null||packet.kind!=='written')return null;
    if(typeof raw!=='object'||Array.isArray(raw))throw Error('作答备份格式不完整。');
    const questions=new Map(packet.blocks.flatMap(b=>b.questions).map(q=>[String(q.id),q])),answers={},manualScores={};
    for(const [id,value] of Object.entries(raw.answers||{})){const q=questions.get(id);if(!q||typeof value!=='string'||value.length>40000||((!q.kind||q.kind==='mc')&&!['','A','B','C','D'].includes(value)))throw Error('备份含无效的题号或作答。');answers[id]=value;}
    for(const [id,value] of Object.entries(raw.manualScores||{})){const q=questions.get(id);if(!q||!['writing','translation'].includes(q.kind))throw Error('备份含无效的主观题评分。');if(value==='')continue;if(!['number','string'].includes(typeof value)||!String(value).trim()||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>q.points)throw Error('备份含无效的主观题评分。');manualScores[id]=value;}
    return {answers,manualScores,elapsedSeconds:Number.isFinite(raw.elapsedSeconds)?Math.max(0,Math.min(raw.elapsedSeconds,packet.minutes*60)):0};
  },
  packetBackup(){
    const p=this.packet,w=this.writtenTimer;
    return {format:'yanyuan-packet-v1',packet:p,...(p.kind==='written'?{practice:{answers:{...this.answers},manualScores:p.schema===2?{...StudyFlow.manualScores}:{},elapsedSeconds:(w?.elapsed||0)+(w?.running?(Date.now()-w.lastStart)/1000:0)}}:{})};
  },
  async importPacket(event){if(this.busy){toast('请等待当前操作完成，再导入备份。');event.target.value='';return;}const file=event.target.files[0];if(!file)return;try{if(file.size>1_000_000)throw Error('备份超过1 MB。');const raw=JSON.parse(await file.text());if(raw.format!=='yanyuan-packet-v1')throw Error('请使用本站导出的训练卷JSON。');this.validatePacket(raw.packet);const practice=this.backupPractice(raw.packet,raw.practice),p=HubEngine.clone(raw.packet);delete p.id;p.createdAt=new Date().toISOString();p.title=p.title+'（导入副本）';await this.createPacket(p);if(practice){this.answers=practice.answers;this.writtenTimer={id:this.packet.id,remaining:Math.max(0,p.minutes*60-practice.elapsedSeconds),elapsed:practice.elapsedSeconds,running:false};if(p.schema===2){StudyFlow.renderedPacketId=this.packet.id;StudyFlow.manualScores=practice.manualScores;StudyFlow.mixedResult=null;StudyFlow.mixedSaveError='';}}}catch(error){toast(error.message||'导入失败，文件格式不完整。');}finally{event.target.value='';}},
  download(name,text,type='application/json'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);},
  packetMarkdown(){const p=this.packet;let out=`# ${p.title}\n\n${p.schoolName}\n\n${p.note}\n\n`;if(p.kind==='oral')for(const [i,q] of p.items.entries()){out+=`## ${i+1}. ${q.title}\n\n${q.prompt}\n\n${q.text}\n\n出处：${q.source.label}${q.source.url?' '+q.source.url:''}\n\n### 参考\n\n${q.guide.join('\n\n')}\n\n${q.reference}\n\n追问：\n\n${q.followups.join('\n\n')}\n\n`;}else for(const b of p.blocks){if(b.text)out+=`## ${b.title}\n\n${b.source||''}\n\n${b.text}\n\n`;for(const q of b.questions)out+=`${q.id}. ${q.stem}\n\n${q.options.map((x,i)=>'ABCD'[i]+'. '+x).join('\n\n')}\n\n`;}
    if(p.kind==='written'){out+='\n# 参考答案与解析\n\n';for(const b of p.blocks)for(const q of b.questions)out+=`${q.id}. ${q.answer} — ${q.analysis}\n\n`;}
    return out;},
  errorPage(message,title='暂时无法打开'){this.pauseTimer();$('#screen').innerHTML=`<div class="empty-state"><h2>${this.e(title)}</h2><p>${this.e(message)}</p><a class="btn primary" href="#studio">返回组卷工作台</a><button class="btn secondary" data-hub="refresh-saved">重试读取云端档案</button></div>`;},
  change(event){const el=event.target;
    if(['hub-school','hub-mode'].includes(el.id))this.studioFields();if(el.id==='hub-type')this.oralFields();if(el.id==='hub-subject')this.writtenFields();if(el.id==='hub-scope')this.scopeFields();
    if(el.id==='hub-oral-school'){this.school=el.value;$('#hub-oral-type').innerHTML='<option value="all">全部题型</option>'+this.typesFor(this.school).map(t=>`<option value="${t}">${this.e(this.data.types[t])}</option>`).join('');this.filterOral();}
    if(['hub-oral-type','hub-oral-level'].includes(el.id))this.filterOral();if(['hub-saved-school','hub-saved-kind'].includes(el.id))this.filterSaved();
    if(el.id==='hub-hide-source'){this.timer.hideSource=el.checked;this.updateTaskClock();}
    if(el.hasAttribute('data-hub-question')){this.answers[el.dataset.hubQuestion]=el.value;this.review=false;this.writtenMeta=null;$('#hub-written-progress').textContent=`已答 ${Object.keys(this.answers).length}/${this.packet.count}`;if($('.hub-result'))this.renderPacket();}
    if(el.dataset.hubField&&this.draft){this.draft[el.dataset.hubField]=el.value;this.markDirty();}
  },
  input(event){const el=event.target;if(el.id==='hub-oral-query')this.filterOral();if(el.dataset.hubField&&this.draft){this.draft[el.dataset.hubField]=el.value;this.markDirty();}if(el.hasAttribute('data-hub-rating')&&this.draft){this.draft.ratings[Number(el.dataset.hubRating)]=el.value;this.markDirty();$('#hub-total').textContent=this.totalScore(this.draft.ratings)===null?'未评分':this.totalScore(this.draft.ratings)+' / 100';}},
  markDirty(){this.draft.dirty=true;const state=$('#hub-draft-state');if(state){state.textContent='有尚未保存的修改';state.className='hub-cloud-state unsaved';}},
  async click(event){const button=event.target.closest('[data-hub]');if(!button)return;const action=button.dataset.hub;
    if(action==='school-studio'){navigate('studio');return;}if(action==='school-oral'){navigate('oral');return;}
    if(action==='school-session'){try{await this.createPacket(HubEngine.makeOral({hub:this.data,schoolId:this.school}));}catch(error){toast(error.message);}return;}
    if(action==='random-task'){if(!this.filteredItems?.length){toast('当前筛选没有可抽取的任务。');return;}const q=HubEngine.sample(this.filteredItems,1)[0];location.hash=`task/${this.school}/${q.id}`;return;}
    if(action==='timer')this.startTimer();if(action==='answer-phase')this.answerPhase();if(action==='finish-task'){this.pauseTimer();this.timer.phase='finished';this.timer.remaining=0;this.updateTaskClock();}
    if(action==='toggle-source'){const panel=$('#hub-source-panel');const masked=panel?.classList.contains('is-masked');this.timer.manuallyMasked=!masked;this.timer.manuallyRevealed=masked;this.updateTaskClock();}
    if(action==='save-attempt')await this.saveAttempt();
    if(action==='attempt-export'){if(this.draft)this.download('口试练习_'+this.activeTask.id+'.json',JSON.stringify({format:'yanyuan-oral-attempt-v1',...this.draft,total:this.totalScore(this.draft.ratings)},null,2));}
    if(action==='written-timer'){const w=this.writtenTimer;if(w.running)this.pauseTimer();else if(w.remaining>0){w.running=true;w.lastStart=Date.now();w.until=Date.now()+w.remaining*1000;this.updateWrittenClock();}}
    if(action==='written-submit')await this.submitWritten();if(action==='written-answers'){this.review=!this.review;if(this.review)this.writtenReferenceSeen=true;this.renderPacket();}
    if(action==='packet-json')this.download(this.packet.title+'.json',JSON.stringify(this.packetBackup(),null,2));
    if(action==='packet-markdown')this.download(this.packet.title+'.md',this.packetMarkdown(),'text/markdown;charset=utf-8');
    if(action==='print'){this.pauseTimer();window.print();}
    if(action==='retry-packet-save'){button.disabled=true;try{this.packetMeta=await this.store('packet',this.packet.schoolId,this.packet.title,this.packet,this.packetMeta);this.saveError='';this.renderPacket();}catch(error){toast(error.message);button.disabled=false;}}
    if(action==='refresh-saved'){if(currentView!=='saved')navigate('saved');else this.renderSaved();}
    if(action==='import-packet')$('#hub-import-file').click();
    if(action==='backup-legacy'){button.disabled=true;try{const copy=structuredClone(practice);for(const [id,state] of Object.entries(copy.papers)){state.elapsed=elapsed(practice.papers[id]);state.startAt=null;}await this.store('legacy-backup','legacy','旧版三科练习备份',copy,null);toast('旧版练习副本已保存云端。');this.renderSaved();}catch(error){toast(error.message);button.disabled=false;}}
    if(action==='download-legacy')this.download('燕园备考_旧版练习备份.json',JSON.stringify(this.loadedLegacy.payload,null,2));
  },
};
