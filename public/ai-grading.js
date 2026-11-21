'use strict';
const AIGrading={
 enabled:false,info:'正在检查 AI 批改配置…',busy:false,requests:new Map(),
 init(){document.addEventListener('click',event=>{const b=event.target.closest('[data-ai-grade]');if(b)this.grade(b);});window.addEventListener('focus',()=>this.refresh());this.refresh();},
 async refresh(){try{const r=await fetch('/api/ai-grading',{cache:'no-store'}),s=await r.json();this.enabled=!!s.enabled;this.info=s.message||'AI 批改暂时不可用。';}catch{this.info='AI 配置暂时无法读取，请刷新后重试。';}this.buttons();},
 buttons(){document.querySelectorAll('[data-ai-grade]').forEach(b=>{b.disabled=this.busy||!this.enabled;b.title=this.info;});document.querySelectorAll('.ai-grading-state').forEach(n=>{n.textContent=this.busy?'正在批改，请稍候…':this.info;});},
 placeholder(kind,{score=null,maxScore=100,questionId='',assessment=null}={}){
  if(!['writing','translation','oral'].includes(kind))kind='writing';
  const label={writing:'作文',translation:'翻译',oral:'口试'}[kind]||'主观题';
  const historical=score!==null&&score!==''&&Number.isFinite(Number(score));
  const value=assessment?.assessment;return `<section class="ai-grading-placeholder" aria-label="${label} AI 批改"><div class="ai-grading-heading"><strong>${label} AI 批改</strong><button type="button" class="btn secondary" data-ai-grade="${kind}" data-ai-question="${Hub.e(questionId)}" ${this.busy||!this.enabled?'disabled':''}>AI 批改</button></div><p class="ai-grading-state" role="status">${Hub.e(this.info)}</p>${kind==='oral'?'<p>仅评价已填写的文字转写，不评价发音或流利度。</p>':''}${value?`<div class="ai-grading-result"><strong>AI 评分 ${Hub.e(value.score)} / 100</strong>${Hub.paragraphs(value.summary)}${(value.criteria||[]).map(d=>'<p>'+Hub.e(d.name)+' '+Hub.e(d.score)+'/'+Hub.e(d.max)+'：'+Hub.e(d.reason)+'</p>').join('')}<ul>${(value.improvements||[]).map(s=>'<li>'+Hub.e(s)+'</li>').join('')}</ul><p>${Hub.e(assessment.provider?.name)} / ${Hub.e(assessment.provider?.model)}</p></div>`:''}${historical?`<p class="ai-grading-history">历史录入分数：${Hub.e(score)} / ${Hub.e(maxScore)}</p>`:''}</section>`;
 },
 async context(button){
  if(!PublicApp.session.authenticated)throw Error('请先登录后批改。');if(Hub.busy)throw Error('请等待当前保存完成。');const qid=button.dataset.aiQuestion||'';
  if(qid){if(!Hub.writtenMeta||StudyFlow.writtenDirty)await StudyFlow.submitMixed();if(!Hub.writtenMeta||StudyFlow.writtenDirty)throw Error('请先核对答案并保存本次作答。');const record=Hub.writtenMeta;return {id:record.id,revision:record.revision,questionId:qid,signature:()=>JSON.stringify([Hub.writtenMeta?.id,Hub.packet,Hub.answers]),reload:()=>Hub.loadAttempt(record.id)};}
  if(button.dataset.aiGrade==='oral'){if(!Hub.draft?.meta||Hub.draft.dirty)await Hub.saveAttempt();const d=Hub.draft;if(!d?.meta||d.dirty)throw Error('请先保存口试作答，并等待录音上传结束。');return {id:d.meta.id,revision:d.meta.revision,signature:()=>JSON.stringify([Hub.draft?.key,Hub.draft?.answer]),reload:()=>Hub.loadAttempt(d.meta.id)};}
  WritingUI.readDraft();if(!WritingUI.draft.textConfirmed)throw Error('请先核对原稿并勾选确认。');if(WritingUI.dirty||!WritingUI.record)await WritingUI.save();const r=WritingUI.record;if(!r||WritingUI.dirty)throw Error('请先保存当前原稿。');return {id:r.id,revision:r.revision,signature:()=>JSON.stringify([WritingUI.record?.id,WritingUI.draft.originalText,WritingUI.draft.prompt,WritingUI.draft.wordLimit,WritingUI.draft.textConfirmed]),reload:()=>WritingUI.load(r.id)};
 },
 async request(body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),110000);try{const r=await fetch('/api/ai-grading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'批改请求未完成。');return data;}finally{clearTimeout(timer);}},
 async grade(button){
  if(this.busy)return;this.busy=true;this.buttons();let key,context,failed=false;try{context=await this.context(button);const snapshot=context.signature(),token=Hub.routeToken;key=JSON.stringify([context.id,context.questionId,snapshot]);if(!this.requests.has(key))this.requests.set(key,Hub.id('ai-request'));
   this.busy=true;this.buttons();let result=await this.request({recordId:context.id,expectedRevision:context.revision,questionId:context.questionId,requestId:this.requests.get(key)});
   for(let i=0;result.status==='pending'&&i<55;i++){await new Promise(r=>setTimeout(r,2000));const response=await fetch('/api/ai-grading?jobId='+encodeURIComponent(result.jobId),{cache:'no-store'});if(!response.ok)throw Error('读取批改状态失败，请稍后再次点击查询。');result=await response.json();}
   if(result.status==='pending')throw Error('批改仍在进行，再次点击可查询同一请求，不会重复调用模型。');this.requests.delete(key);
   if(result.status!=='succeeded')throw Error(result.error||'批改未完成，请核对用量记录后重试。');
   if(!result.result.applied)throw Error('批改已完成，但作答在处理中发生变化或保存冲突；结果保留在批改记录中，当前成绩未覆盖。');
   if(token===Hub.routeToken&&snapshot===context.signature())await context.reload();else toast('AI 批改已存入原作答档案；当前编辑内容保持不变。');
  }catch(e){failed=true;const message=e.name==='AbortError'?'等待超时，再次点击可查询同一请求；请勿重复新建批改。':e.message;toast(message);const n=document.querySelector('.ai-grading-state');if(n)n.textContent=message;}finally{this.busy=false;if(!failed)this.buttons();else document.querySelectorAll('[data-ai-grade]').forEach(b=>b.disabled=!this.enabled);}
 },
};

