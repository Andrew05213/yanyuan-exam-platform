'use strict';
(()=>{
 const $=s=>document.querySelector(s),state={providers:[],editing:null,ready:false,providerBusy:false,audioSettings:null,audioBusy:false,audioModelsEpoch:0,usageEpoch:0,page:1,pages:1,view:'users',userId:''};
 function node(tag,text='',className=''){const n=document.createElement(tag);if(text!==null)n.textContent=String(text);if(className)n.className=className;return n;}
 function button(label,fn,className='button'){const n=node('button',label,className);n.type='button';n.addEventListener('click',fn);return n;}
 function message(selector,text,error=false){const n=$(selector);n.textContent=text;n.classList.toggle('error',error);}
 function lockAccess(status,text){
  $('#admin-app').hidden=true;$('#admin-access').hidden=false;
  $('#access-title').textContent=status===401?'请先登录':status===403?'没有管理权限':'后台暂时无法打开';
  $('#access-message').textContent=text||'请重新验证管理权限。';
  $('#admin-login').hidden=status!==401;$('#admin-retry').hidden=false;
 }
 async function api(url,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store',signal:controller.signal});const data=await r.json();if(!r.ok){if(r.status===401||r.status===403)lockAccess(r.status,data.error);const e=new Error(data.error||'操作未完成，请重试。');e.status=r.status;throw e;}return data;}catch(e){if(e.name==='AbortError')throw Error('请求超时，请刷新后重试。');throw e;}finally{clearTimeout(timer);}
 }
 const number=n=>n===null||n===undefined?'未报告':Number(n).toLocaleString('zh-CN');
 function money(value,currency){if(value===null||value===undefined)return '未知';const n=BigInt(value),whole=n/BigInt(1000000),fraction=(n%BigInt(1000000)).toString().padStart(6,'0');return whole.toString()+'.'+fraction+' '+currency;}
 function cost(row){if(!row.requests&&row.requests!==undefined)return '暂无调用';if(row.estimatedCostMicros===null)return '未知'+(row.knownCostMicros&&row.knownCostMicros!=='0'?'（已知 '+money(row.knownCostMicros,row.currency)+'）':'');return money(row.estimatedCostMicros,row.currency);}
 function date(iso){return iso?new Date(iso).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—';}
 const tabs=['providers','usage','feedback'];
 function toggleTab(name){$('#feedback-view').hidden=name!=='feedback';if(name==='feedback')loadFeedback();$('#providers-view').hidden=name!=='providers';$('#usage-view').hidden=name!=='usage';for(const x of tabs){const tab=$('#tab-'+x);tab.classList.toggle('active',x===name);tab.setAttribute('aria-selected',String(x===name));tab.tabIndex=x===name?0:-1;}if(name==='usage')loadUsage();}
 function busy(value){state.providerBusy=value;$('#provider-form').inert=value;for(const id of ['save-provider','new-provider','reset-provider','refresh-providers'])$('#'+id).disabled=value;for(const b of $('#providers-list').querySelectorAll('button'))b.disabled=value;}
 function resetProvider(p=null){
  state.editing=p;$('#provider-form').reset();$('#provider-form-title').textContent=p?'编辑 Provider':'新增 Provider';
  $('#provider-name').value=p?.name||'DeepSeek';$('#provider-protocol').value=p?.protocol||'openai-compatible';$('#provider-url').value=p?.baseUrl||'https://api.deepseek.com';$('#provider-model').value=p?.model||'deepseek-flash';$('#provider-currency').value=p?.currency||'CNY';$('#provider-enabled').checked=p?.enabled??true;
  $('#provider-preset').value=!p||p.baseUrl.replace(/\/v1\/?$/,'')==='https://api.deepseek.com'?'deepseek':p.baseUrl.replace(/\/v1\/?$/,'')==='https://api.openai.com'?(p.protocol==='openai-responses'?'openai-responses':p.protocol==='openai-compatible'?'openai-chat':'custom'):'custom';clearModels();
  $('#price-input').value=p?.inputPrice||'';$('#price-cached').value=p?.cachedInputPrice||'';$('#price-output').value=p?.outputPrice||'';
  $('#provider-key').value='';$('#provider-key').disabled=!state.ready;$('#provider-clear-key').checked=false;$('#clear-key-label').hidden=!p?.hasKey;
  $('#key-state').textContent=p?.hasKey?'已设置密钥'+(p.keyUpdatedAt?' · 更新于 '+date(p.keyUpdatedAt):'')+'；原文不可读取。':'未设置密钥';
  message('#provider-message','');
 }
 function clearModels(){state.models=[];$('#provider-model-list').replaceChildren(new Option('选择模型',''));$('#model-list-label').hidden=true;$('#model-details').textContent='';message('#models-message','');}
 function modelDetails(){const model=state.models.find(m=>m.id===$('#provider-model-list').value);if(!model){$('#model-details').textContent='';return;}$('#provider-model').value=model.id;const details=[];if(model.contextWindow)details.push('上下文 '+number(model.contextWindow)+' Token');if(model.maxOutputTokens)details.push('最大输出 '+number(model.maxOutputTokens)+' Token');if(model.inputModalities?.length)details.push('输入 '+model.inputModalities.join('、'));if(model.effortLevels?.length)details.push('推理强度 '+model.effortLevels.join(' / '));$('#model-details').textContent=details.join(' · ')||'上游未提供额外模型信息。';}
 async function fetchModels(){
  if(state.providerBusy)return;const p=state.editing;
  if(!p||p.baseUrl!==$('#provider-url').value.trim()||p.protocol!==$('#provider-protocol').value||$('#provider-key').value||$('#provider-clear-key').checked){message('#models-message','请先保存 Provider 配置和 API Key，再获取模型。',true);return;}
  clearModels();busy(true);message('#models-message','正在从上游获取模型…');
  try{const data=await api('/api/admin/models',{id:p.id,expectedRevision:p.revision});state.models=data.models;for(const m of data.models)$('#provider-model-list').add(new Option(m.name?m.name+' · '+m.id:m.id,m.id));$('#model-list-label').hidden=!data.models.length;const current=$('#provider-model').value;if(data.models.some(m=>m.id===current)){$('#provider-model-list').value=current;modelDetails();}message('#models-message',data.models.length?'已获取 '+data.models.length+' 个模型；选择后保存配置生效。':'上游未返回可用模型，可继续手动填写。');}catch(e){message('#models-message',e.message,true);}finally{busy(false);renderProviders();}
 }
 $('#fetch-models').addEventListener('click',fetchModels);$('#provider-model-list').addEventListener('change',modelDetails);
 $('#provider-model').addEventListener('input',()=>{if($('#provider-model').value!==$('#provider-model-list').value){$('#provider-model-list').value='';$('#model-details').textContent='';}});
 $('#provider-preset').addEventListener('change',()=>{clearModels();const preset=$('#provider-preset').value;if(preset==='deepseek'||preset==='openai-responses'||preset==='openai-chat'){
  const deepseek=preset==='deepseek';$('#provider-name').value=deepseek?'DeepSeek':'OpenAI';$('#provider-protocol').value=preset==='openai-responses'?'openai-responses':'openai-compatible';$('#provider-url').value=deepseek?'https://api.deepseek.com':'https://api.openai.com/v1';$('#provider-model').value=deepseek?'deepseek-flash':'gpt-5-mini';$('#provider-currency').value=deepseek?'CNY':'USD';for(const id of ['price-input','price-cached','price-output'])$('#'+id).value='';
 }});
 function renderProviders(){
  const box=$('#providers-list');box.replaceChildren();
  if(!state.providers.length)box.append(node('p','尚未配置 Provider。','empty'));
  for(const p of state.providers){
   const card=node('article',null,'provider-card'),head=node('div',null,'provider-card-head'),heading=node('h3',p.name);
   head.append(heading);
   if(p.isDefault)head.append(node('span','默认','badge default'));
   head.append(node('span',p.enabled?'启用':'已停用','badge '+(p.enabled?'on':'off')));
   card.append(head);
   const model=node('div',null,'provider-model');model.append(node('span',p.protocol),document.createTextNode(' · '+p.model));card.append(model);
   card.append(node('p',p.baseUrl,'provider-url'));
   const facts=node('dl',null,'provider-facts');
   for(const [label,value] of [['密钥',p.hasKey?'已设置 · 原文不可读取':'未设置'],['单价',`输入 ${p.inputPrice||'未知'} / 缓存 ${p.cachedInputPrice||'未知'} / 输出 ${p.outputPrice||'未知'} ${p.currency} / 百万 Token`]]){
    const row=node('div');row.append(node('dt',label),node('dd',value));facts.append(row);
   }
   card.append(facts);
   const actions=node('div',null,'actions');actions.append(button('编辑',()=>{resetProvider(p);$('#provider-form-title').scrollIntoView({behavior:'smooth',block:'start'});}));
   const select=button(p.isDefault?'已设为默认':'设为默认',()=>chooseDefault(p));select.disabled=p.isDefault||!p.enabled;
   actions.append(select,button('删除',()=>removeProvider(p),'button danger'));card.append(actions);box.append(card);
  }
  const select=$('#usage-provider'),previous=select.value;select.replaceChildren(new Option('全部 Provider',''));for(const p of state.providers)select.add(new Option(p.name,p.id));if(state.providers.some(p=>p.id===previous))select.value=previous;
 }
 async function loadProviders(){const data=await api('/api/admin/providers');state.providers=data.providers;state.ready=data.encryptionReady;$('#encryption-notice').hidden=state.ready;$('#provider-key').disabled=!state.ready;renderProviders();renderAudioProviders();}
 function usableAudioProvider(p){return p.enabled&&p.hasKey&&['openai-compatible','openai-responses'].includes(p.protocol);}
 function renderAudioProviders(){
  const select=$('#audio-provider'),previous=select.value;select.replaceChildren(new Option('不启用原音分析',''));
  for(const p of state.providers){const option=new Option(p.name+(usableAudioProvider(p)?'':'（不可用）'),p.id);option.disabled=!usableAudioProvider(p);select.add(option);}
  if(previous&&!state.providers.some(p=>p.id===previous))select.add(new Option('已配置的 Provider 不存在',previous));
  select.value=previous;audioControls();
 }
 function audioControls(){const enabled=!!$('#audio-provider').value;$('#audio-model').disabled=!enabled;$('#audio-model').required=enabled;$('#audio-fetch-models').disabled=!enabled||state.audioBusy;}
 function clearAudioModels(){state.audioModelsEpoch++;$('#audio-model-list').replaceChildren(new Option('选择模型',''));$('#audio-model-list-label').hidden=true;message('#audio-models-message','');}
 function showAudioSettings(settings){
  state.audioSettings=settings;renderAudioProviders();
  if(settings.providerId&&!state.providers.some(p=>p.id===settings.providerId))$('#audio-provider').add(new Option('已配置的 Provider 不存在',settings.providerId));
  $('#audio-provider').value=settings.providerId||'';$('#audio-model').value=settings.model||'';clearAudioModels();audioControls();
  const p=state.providers.find(p=>p.id===settings.providerId);
  $('#audio-config-state').textContent=settings.providerId?(p?.name||'Provider 不可用')+' / '+(settings.model||'未设置模型')+(p&&usableAudioProvider(p)?'':'（请检查 Provider）')+(settings.source==='environment'?' · 沿用服务器配置':''):'未启用；录音保存、播放与文字批改继续可用';
 }
 async function loadAudioSettings(){
  if(state.audioBusy)return;state.audioBusy=true;$('#audio-settings-fields').disabled=true;$('#audio-refresh').disabled=true;
  try{showAudioSettings((await api('/api/admin/oral-audio')).settings);message('#audio-settings-message','');}catch(e){message('#audio-settings-message',e.message,true);}finally{state.audioBusy=false;$('#audio-settings-fields').disabled=!state.audioSettings;$('#audio-refresh').disabled=false;audioControls();}
 }
 $('#audio-provider').addEventListener('change',()=>{$('#audio-model').value='';clearAudioModels();audioControls();message('#audio-settings-message','选择原音模型后保存；文字批改配置保持不变。');});
 $('#audio-model-list').addEventListener('change',()=>{if($('#audio-model-list').value)$('#audio-model').value=$('#audio-model-list').value;});
 $('#audio-model').addEventListener('input',()=>{$('#audio-model-list').value='';});
 $('#audio-refresh').addEventListener('click',async()=>{try{await loadProviders();await loadAudioSettings();}catch(e){message('#audio-settings-message',e.message,true);}});
 $('#audio-fetch-models').addEventListener('click',async()=>{
  if(state.audioBusy)return;const p=state.providers.find(p=>p.id===$('#audio-provider').value);if(!p||!usableAudioProvider(p))return;
  clearAudioModels();const epoch=state.audioModelsEpoch;state.audioBusy=true;$('#audio-settings-fields').disabled=true;$('#audio-refresh').disabled=true;message('#audio-models-message','正在从上游获取模型…');
  try{const data=await api('/api/admin/models',{id:p.id,expectedRevision:p.revision});if(epoch!==state.audioModelsEpoch||$('#audio-provider').value!==p.id||state.providers.find(v=>v.id===p.id)?.revision!==p.revision)return;
   for(const m of data.models)$('#audio-model-list').add(new Option((m.name?m.name+' · ':'')+m.id+(m.inputModalities?.includes('audio')?' · 音频输入':''),m.id));
   $('#audio-model-list-label').hidden=!data.models.length;message('#audio-models-message',data.models.length?'已获取 '+data.models.length+' 个模型，请选择支持音频输入的模型。':'上游未返回模型，可手动填写。');
  }catch(e){if(epoch===state.audioModelsEpoch)message('#audio-models-message',e.message,true);}finally{state.audioBusy=false;$('#audio-settings-fields').disabled=!state.audioSettings;$('#audio-refresh').disabled=false;audioControls();}
 });
 $('#audio-settings-form').addEventListener('submit',async event=>{
  event.preventDefault();if(state.audioBusy||!state.audioSettings)return;const providerId=$('#audio-provider').value||null,p=state.providers.find(p=>p.id===providerId);
  state.audioBusy=true;$('#audio-settings-fields').disabled=true;$('#audio-refresh').disabled=true;
  try{const data=await api('/api/admin/oral-audio',{providerId,model:providerId?$('#audio-model').value.trim():null,expectedRevision:state.audioSettings.revision,expectedProviderRevision:providerId?p?.revision:null});showAudioSettings(data.settings);message('#audio-settings-message',providerId?'原音配置已保存，文字批改配置保持不变。':'原音分析已停用，文字批改配置保持不变。');}catch(e){message('#audio-settings-message',e.message,true);}finally{state.audioBusy=false;$('#audio-settings-fields').disabled=!state.audioSettings;$('#audio-refresh').disabled=false;audioControls();}
 });
 async function chooseDefault(p){if(state.providerBusy)return;busy(true);try{await api('/api/admin/providers',{action:'select-default',id:p.id,expectedRevision:p.revision});await loadProviders();message('#provider-message','默认 Provider 已更新。');}catch(e){message('#provider-message',e.message,true);}finally{busy(false);renderProviders();}}
 async function removeProvider(provider){
  if(state.providerBusy)return;
  if(provider.isDefault){message('#providers-message','请先切换默认 Provider，再删除此配置。',true);return;}
  if(state.audioSettings?.providerId===provider.id){message('#providers-message','请先更换或停用原音分析的 Provider，再删除此配置。',true);return;}
  if(!window.confirm('删除「'+provider.name+'」及其保存的密钥？历史用量和费用将保留。'))return;
  busy(true);message('#providers-message','');
  try{
   await api('/api/admin/providers',{action:'delete',id:provider.id,expectedRevision:provider.revision});
   state.providers=state.providers.filter(p=>p.id!==provider.id);
   if(state.editing?.id===provider.id)resetProvider();
   if($('#audio-provider').value===provider.id){
    $('#audio-provider').value='';$('#audio-model').value='';clearAudioModels();
   }
   renderAudioProviders();message('#providers-message','已删除「'+provider.name+'」。');
  }catch(e){message('#providers-message',e.message,true);}
  finally{busy(false);renderProviders();}
 }
 async function saveProvider(event){
  event.preventDefault();if(state.providerBusy)return;
  const body={...(state.editing?{id:state.editing.id,expectedRevision:state.editing.revision}:{}),name:$('#provider-name').value,protocol:$('#provider-protocol').value,baseUrl:$('#provider-url').value,model:$('#provider-model').value,currency:$('#provider-currency').value,enabled:$('#provider-enabled').checked,inputPrice:$('#price-input').value,cachedInputPrice:$('#price-cached').value,outputPrice:$('#price-output').value,clearKey:$('#provider-clear-key').checked};
  if($('#provider-key').value)body.apiKey=$('#provider-key').value;
  busy(true);try{const data=await api('/api/admin/providers',body);$('#provider-key').value='';await loadProviders();resetProvider(state.providers.find(p=>p.id===data.provider.id)||data.provider);message('#provider-message','配置已保存。密钥不会回显。');}catch(e){message('#provider-message',e.message,true);}finally{delete body.apiKey;$('#provider-key').value='';busy(false);renderProviders();}
 }
 function summary(data){
  const box=$('#usage-summary');box.replaceChildren();const requests=data.totals.reduce((n,r)=>n+r.requests,0),input=data.totals.reduce((n,r)=>n+r.inputTokens,0),output=data.totals.reduce((n,r)=>n+r.outputTokens,0);
  for(const [label,value] of [['请求次数',number(requests)],['输入 Token',number(input)],['输出 Token',number(output)]]){const card=node('article',null,'summary-card');card.append(node('h3',label),node('strong',value));box.append(card);}
  const fees=node('article',null,'summary-card');fees.append(node('h3','估算费用'));if(!data.totals.length)fees.append(node('p','暂无调用'));for(const row of data.totals)fees.append(node('p',cost(row)));box.append(fees);
  const incomplete=data.totals.some(r=>r.unreportedRequests||r.unpricedRequests);$('#usage-note').hidden=!incomplete;$('#usage-note').textContent='部分请求未报告完整用量或未配置价格；Token 合计仅包含已报告部分，费用未知的请求未按零费用处理。';
 }
 function table(headers,rows){const t=node('table'),head=node('thead'),tr=node('tr');for(const h of headers)tr.append(node('th',h));head.append(tr);t.append(head);const body=node('tbody');for(const cells of rows){const row=node('tr');for(const item of cells){const td=node('td');if(item instanceof Node)td.append(item);else td.textContent=String(item??'—');row.append(td);}body.append(row);}t.append(body);return t;}
 function userCell(row){const cell=node('div',row.email||row.displayName||row.userId);if(row.email||row.displayName)cell.append(node('span',row.userId,'cell-note'));return cell;}
 function renderUsage(data){
  summary(data);const box=$('#usage-table');box.replaceChildren();$('#usage-title').textContent=state.view==='users'?'按用户统计':'调用明细';
  if(!data.rows.length)box.append(node('p',state.view==='users'?'尚无用户记录。':'尚无 AI 调用记录；用户发起批改后会在这里显示。','empty'));
  else if(state.view==='users')box.append(table(['用户','请求','输入 Token','缓存输入','输出 Token','总 Token','估算费用','操作'],data.rows.map(r=>[userCell(r),number(r.requests),number(r.inputTokens),number(r.cachedInputTokens),number(r.outputTokens),number(r.totalTokens),cost(r),button('查看明细',()=>{state.userId=r.userId;state.view='events';state.page=1;loadUsage();})])));
  else box.append(table(['时间（北京）','用户','Provider / 模型','类型 / 状态','输入 Token','缓存输入','输出 Token','估算费用'],data.rows.map(r=>[date(r.createdAt),userCell(r),r.providerName+' / '+r.model,({writing:'作文',translation:'翻译',oral:'口试','oral-audio':'原音分析','question-generation':'专题出题','literature-feedback':'文学反馈','research-assistant':'研究助手'}[r.task]||r.task)+' / '+({success:'成功',error:'失败',unknown:'未知'}[r.status]||r.status),number(r.inputTokens),number(r.cachedInputTokens),number(r.outputTokens),cost(r)])));
  state.pages=data.pagination.pages;$('#usage-page').textContent='第 '+data.pagination.page+' / '+state.pages+' 页，共 '+data.pagination.total+' 条';$('#usage-prev').disabled=state.page<=1;$('#usage-next').disabled=state.page>=state.pages;
  $('#usage-users').classList.toggle('active',state.view==='users');$('#usage-events').classList.toggle('active',state.view==='events');$('#usage-users').setAttribute('aria-pressed',String(state.view==='users'));$('#usage-events').setAttribute('aria-pressed',String(state.view==='events'));$('#usage-clear-user').hidden=!state.userId;
 }
 async function loadUsage(){
  const epoch=++state.usageEpoch;$('#usage-submit').disabled=true;message('#usage-message','正在读取…');
  const params=new URLSearchParams({from:$('#usage-from').value,to:$('#usage-to').value,providerId:$('#usage-provider').value,q:$('#usage-query').value,status:$('#usage-status').value,userId:state.userId,view:state.view,page:String(state.page),limit:'50'});
  try{const data=await api('/api/admin/usage?'+params);if(epoch!==state.usageEpoch)return;renderUsage(data);message('#usage-message','');}catch(e){if(epoch===state.usageEpoch)message('#usage-message',e.message,true);}finally{if(epoch===state.usageEpoch)$('#usage-submit').disabled=false;}
 }
 async function start(){
  try{const session=await api('/api/admin/session');state.ready=session.encryptionReady;$('#admin-account').textContent=session.email||session.userId;
   const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);$('#usage-from').value=today.slice(0,8)+'01';$('#usage-to').value=today;
   await loadProviders();await loadAudioSettings();resetProvider();$('#admin-access').hidden=true;$('#admin-app').hidden=false;
  }catch(e){$('#admin-access').hidden=false;$('#admin-app').hidden=true;$('#access-title').textContent=e.status===401?'请先登录':e.status===403?'没有管理权限':'后台暂时无法打开';$('#access-message').textContent=e.message;$('#admin-login').hidden=e.status!==401;$('#admin-retry').hidden=false;}
 }
 $('#admin-retry').addEventListener('click',()=>location.reload());$('#tab-providers').addEventListener('click',()=>toggleTab('providers'));$('#tab-usage').addEventListener('click',()=>toggleTab('usage'));
 for(const name of tabs){const tab=$('#tab-'+name);if(name==='feedback')tab.addEventListener('click',()=>toggleTab(name));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=tabs.indexOf(name),next=tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];toggleTab(next);$('#tab-'+next).focus();});}
 $('#new-provider').addEventListener('click',()=>resetProvider());$('#reset-provider').addEventListener('click',()=>resetProvider());$('#refresh-providers').addEventListener('click',()=>loadProviders().catch(e=>message('#provider-message',e.message,true)));$('#provider-form').addEventListener('submit',saveProvider);
 $('#usage-filter').addEventListener('submit',e=>{e.preventDefault();state.page=1;loadUsage();});$('#usage-users').addEventListener('click',()=>{state.view='users';state.page=1;loadUsage();});$('#usage-events').addEventListener('click',()=>{state.view='events';state.page=1;loadUsage();});$('#usage-clear-user').addEventListener('click',()=>{state.userId='';state.page=1;loadUsage();});
 $('#usage-prev').addEventListener('click',()=>{if(state.page>1){state.page--;loadUsage();}});$('#usage-next').addEventListener('click',()=>{if(state.page<state.pages){state.page++;loadUsage();}});
 let feedbackRows=[],feedbackNext=null,feedbackEpoch=0;
 async function loadFeedback(more=false){
  const epoch=++feedbackEpoch;$('#feedback-more').disabled=true;message('#feedback-message','正在读取…');
  const params=new URLSearchParams({admin:'1'}),filter=$('#feedback-status').value;if(filter)params.set('status',filter);
  if(more&&feedbackNext){params.set('beforeTime',feedbackNext.time);params.set('beforeId',feedbackNext.id);}
  try{const data=await api('/api/feedback?'+params);if(epoch!==feedbackEpoch)return;feedbackRows=more?[...new Map([...feedbackRows,...data.records].map(r=>[r.id,r])).values()]:data.records;feedbackNext=data.next;renderFeedback();message('#feedback-message','');}catch(e){if(epoch===feedbackEpoch)message('#feedback-message',e.message,true);}finally{if(epoch===feedbackEpoch)$('#feedback-more').disabled=false;}
 }
 function renderFeedback(){
  const box=$('#feedback-list');box.replaceChildren();if(!feedbackRows.length)box.append(node('p','暂无反馈。','empty'));
  for(const r of feedbackRows){
   const card=node('article',null,'feedback-card'),p=r.payload;
   card.append(node('h3',r.title+' · '+(r.kind==='paper'?'整卷评价':'第 '+p.questionId+' 题')),node('p',({open:'待处理',resolved:'已处理',declined:'暂不采纳'}[r.status])+' · '+date(r.updatedAt)),node('p','反馈人：'+r.ownerId));
   if(r.kind==='paper')card.append(node('p','质量 '+p.rating+'/5 · 难度 '+({easy:'偏易',suitable:'适中',hard:'偏难'}[p.difficulty])));
   if(p.questionSnapshot){const details=node('details');details.append(node('summary','提交时的题目快照'),node('pre',JSON.stringify(p.questionSnapshot,null,2),'quality-snapshot'));card.append(details);}
   card.append(node('p',p.comment||'未填写补充意见'));
   const form=node('form'),label=node('label','处理说明'),note=node('textarea');note.rows=3;note.maxLength=2000;note.required=true;note.value=r.adminNote||'';label.append(note);
   const status=node('select');status.setAttribute('aria-label','处理状态');for(const [value,text] of [['resolved','已处理'],['declined','暂不采纳'],['open','待处理']])status.add(new Option(text,value));status.value=r.status==='open'?'resolved':r.status;
   const submit=node('button','保存处理结果','button primary');submit.type='submit';form.append(label,status,submit);
   form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{await api('/api/feedback',{action:'handle',id:r.id,status:status.value,note:note.value,expectedUpdatedAt:r.updatedAt});await loadFeedback();}catch(err){message('#feedback-message',err.message,true);}finally{submit.disabled=false;}});
   card.append(form);box.append(card);
  }$('#feedback-more').hidden=!feedbackNext;
 }
 $('#feedback-status').addEventListener('change',()=>loadFeedback());$('#feedback-more').addEventListener('click',()=>loadFeedback(true));
 start();
})();
