// Exercise the real page controllers with delayed/failed requests, without a live account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const bank=JSON.parse(read('public/bank.json'));
const schools=JSON.parse(read('public/schools.json'));
const difficulty=JSON.parse(read('public/difficulty.json'));
const workflows=JSON.parse(read('public/workflows.json'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let checks=0;
const check=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
function setup(){
 const nodes=new Map();
 const screen={innerHTML:'',addEventListener(){}};nodes.set('#screen',screen);
 for(const id of ['#essay-save-button','#essay-status','#essay-original','#mistake-source-note','#hub-written-progress'])nodes.set(id,{value:'',textContent:'',disabled:false});
 const document={querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[],createElement:()=>({})};
 const ctx=vm.createContext({console,crypto,structuredClone,URL,Date,JSON,Number,Math,Set,Map,Object,Array,String,Error,Promise,
  document,bank,location:{hash:'#packet/test',href:'http://localhost:5188/index.html'},history:{replaceState(){}},currentView:'community',currentPaper:null,
  window:{addEventListener(){},scrollTo(){}},setTimeout,clearTimeout,AbortController,
  escapeHTML:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  $:s=>document.querySelector(s),toast(){},navigate(){},pauseAll(){}});
 for(const file of ['hub-engine.js','workflows-engine.js','difficulty-engine.js','hub.js','workflow-app.js','difficulty-ui.js','mistakes.js','writing.js','community.js'])vm.runInContext(read('public/'+file),ctx);
 Object.assign(ctx,{HubEngine:ctx.window.HubEngine,WorkflowEngine:ctx.window.WorkflowEngine,DifficultyEngine:ctx.window.DifficultyEngine});
 const api=vm.runInContext('({Hub,StudyFlow,TierStudio,MistakeUI,WritingUI,PublicApp,DifficultyEngine,WorkflowEngine})',ctx);
 const {Hub,StudyFlow,TierStudio}=api;Hub.data=schools;StudyFlow.data=workflows;TierStudio.data=difficulty;
 Hub.pauseTimer=()=>{};Hub.renderPacket=()=>{};StudyFlow.renderMixed=()=>{api.renders=(api.renders||0)+1;};
 Hub.packet={id:'test',schema:2,kind:'written',schoolId:'pku',title:'Test',minutes:30,count:2,totalPoints:100,createdAt:new Date().toISOString(),blocks:[{questions:[{id:1,kind:'mc',points:50,answer:'A',options:['a','b','c','d']},{id:2,kind:'writing',points:50}]}]};
 Hub.answers={1:'A'};Hub.packetMeta={revision:1};Hub.routeToken=1;StudyFlow.renderedPacketId='test';
 return {...api,nodes,screen,ctx,api};
}

// Anonymous grading must not depend on archive access or fabricate an essay score.
{
 const {Hub,StudyFlow}=setup();let saves=0;Hub.store=async()=>{saves++;throw Error('must not save');};
 await StudyFlow.submitMixed();check(saves,0);check(StudyFlow.mixedResult.objectiveScore,50);check(StudyFlow.mixedResult.total,null);check(Hub.review,true);check(Hub.busy,false);
}
// A failed cloud save still leaves the grade visible and allows another submission.
{
 const {Hub,StudyFlow,PublicApp}=setup();PublicApp.session.authenticated=true;Hub.store=async()=>{throw Error('offline');};
 await StudyFlow.submitMixed();check(StudyFlow.mixedResult.objectiveScore,50);check(StudyFlow.mixedSaveError.includes('offline'),true);check(Hub.busy,false);
 Hub.store=async()=>({id:'attempt',revision:1});await StudyFlow.submitMixed();check(Hub.writtenMeta.revision,1);check(StudyFlow.mixedSaveError,'');
}
// Saving must not replace the next page or mark later edits as already saved.
{
 const f=setup(),d=deferred();f.PublicApp.session.authenticated=true;f.Hub.store=()=>d.promise;
 const task=f.StudyFlow.submitMixed(),renders=f.api.renders;f.Hub.routeToken++;f.screen.innerHTML='next page';d.resolve({revision:1});await task;
 check(f.api.renders,renders);check(f.screen.innerHTML,'next page');
}
{
 const f=setup(),d=deferred();f.PublicApp.session.authenticated=true;f.Hub.store=()=>d.promise;
 const task=f.StudyFlow.submitMixed();f.StudyFlow.answerInput({value:'B',dataset:{flowAnswer:'1'},hasAttribute:n=>n==='data-flow-answer'});d.resolve({revision:1});await task;
 check(f.Hub.writtenMeta,null);check(f.StudyFlow.mixedResult,null);
}
// Editing an essay answer invalidates its old manual score, even during save.
{
 const f=setup();f.Hub.answers[2]='Original.';f.StudyFlow.manualScores[2]='40';
 f.StudyFlow.answerInput({value:'Revised.',dataset:{flowAnswer:'2'},hasAttribute:n=>n==='data-flow-answer'});
 check(Object.hasOwn(f.StudyFlow.manualScores,2),false);check(f.WorkflowEngine.grade(f.Hub.packet,f.Hub.answers,f.StudyFlow.manualScores).total,null);
 const result={remove(){this.removed=true;}};f.nodes.set('.flow-mixed-result',result);
 f.StudyFlow.answerInput({value:'30',dataset:{flowManual:'2'},hasAttribute:n=>n==='data-flow-manual'});check(result.removed,true);
}
// Slow cloud-source selection cannot override a newer selection (including failure).
for(const fail of [false,true]){
 const f=setup(),d=deferred();f.Hub.api=()=>d.promise;f.Hub.validatePacket=()=>{};f.MistakeUI.fromLegacy=p=>({title:p.title,id:p.id,count:p.count});
 const slow=f.MistakeUI.selectSource('cloud:slow');await f.MistakeUI.selectSource('base:'+bank.papers[1].id);
 if(fail)d.reject(Error('old failure'));else d.resolve({payload:{kind:'written',title:'old'}});await slow;
 check(f.MistakeUI.packet.id,bank.papers[1].id);check(f.MistakeUI.sourceKey,'base:'+bank.papers[1].id);
}
// The background source list cannot reset the user's latest selection.
{
 const f=setup(),d=deferred(),select={value:'base:'+bank.papers[0].id,options:[],append(o){this.options.push(o);}};
 f.nodes.set('#mistake-source',select);f.Hub.api=()=>d.promise;f.MistakeUI.fromLegacy=p=>({id:p.id,title:p.title,count:p.count});
 const loading=f.MistakeUI.loadSources('cloud:previous');await Promise.resolve();select.value='base:'+bank.papers[1].id;await f.MistakeUI.selectSource(select.value);
 d.resolve({records:[{id:'previous',title:'Previous',subtype:'written'}]});await loading;
 check(select.value,'base:'+bank.papers[1].id);check(f.MistakeUI.packet.id,bank.papers[1].id);
}
// Late community data or errors must not overwrite another view.
for(const fail of [false,true]){
 const f=setup(),d=deferred();f.StudyFlow.request=()=>d.promise;let errors=0;f.Hub.errorPage=()=>{errors++;};
 const loading=f.PublicApp.detail('material');f.Hub.routeToken++;f.screen.innerHTML='studio';
 if(fail)d.reject(Error('old error'));else d.resolve({material:{}});await loading;
 check(f.screen.innerHTML,'studio');check(errors,0);
}
// Text typed while an essay save is in flight stays in the editor, unsaved.
{
 const f=setup(),d=deferred();f.WritingUI.draft={originalText:'Original.',images:[],schoolId:'pku',title:'Essay'};
 f.WritingUI.readDraft=()=>{};f.WritingUI.renderEditor=()=>{throw Error('must preserve editor');};f.Hub.store=()=>d.promise;
 f.Hub.api=async()=>({id:'essay',revision:1,schoolId:'pku',title:'Essay',sourceHash:'hash',payload:{originalText:'Original.'}});
 const saving=f.WritingUI.save();f.WritingUI.draft.originalText='New edits.';d.resolve({id:'essay',revision:1});await saving;
 check(f.WritingUI.draft.originalText,'New edits.');check(f.WritingUI.dirty,true);check(f.WritingUI.record.revision,1);check(f.Hub.busy,false);
}
// An old essay-load failure must not replace a new page.
{
 const f=setup(),d=deferred();f.Hub.api=()=>d.promise;let errors=0;f.Hub.errorPage=()=>{errors++;};
 const loading=f.WritingUI.load('old');f.Hub.routeToken++;f.screen.innerHTML='new page';d.reject(Error('old error'));await loading;check(errors,0);
}
// JSON backups retain actual answers, manual scores and time; malformed data is rejected.
{
 const f=setup();let started=false;f.ctx.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});f.ctx.Tesseract={createWorker(){started=true;}};
 await assert.rejects(f.WritingUI.createOCRWorker('eng'),/下载不完整/);check(started,false);
 f.ctx.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2048)});let language,options;
 f.ctx.Tesseract.createWorker=async(l,_,o)=>{language=l;options=o;return {terminate(){}};};await f.WritingUI.createOCRWorker('eng+chi_sim');
 check(language,'eng+chi_sim');check(options.gzip,false);check(options.langPath.endsWith('/ocr/data'),true);
}
{
 const f=setup();f.Hub.answers[2]='My essay.';f.StudyFlow.manualScores[2]='40';f.Hub.writtenTimer={elapsed:15,running:false};
 const backup=JSON.parse(JSON.stringify(f.Hub.packetBackup())),practice=f.Hub.backupPractice(backup.packet,backup.practice);
 check(practice.answers[2],'My essay.');check(practice.manualScores[2],'40');check(practice.elapsedSeconds,15);check(f.Hub.backupPractice(backup.packet,undefined),null);
 check(Object.keys(f.Hub.backupPractice(backup.packet,{manualScores:{2:''}}).manualScores).length,0);
 assert.throws(()=>f.Hub.backupPractice(backup.packet,{answers:{1:'Z'}}));assert.throws(()=>f.Hub.backupPractice(backup.packet,{manualScores:{2:51}}));checks+=2;
 f.Hub.validatePacket=()=>{};f.Hub.createPacket=async p=>{f.Hub.packet={...p,id:'imported'};};
 const event={target:{files:[{size:100,text:async()=>JSON.stringify(backup)}],value:'file'}};await f.Hub.importPacket(event);
 check(f.Hub.answers[2],'My essay.');check(f.Hub.writtenTimer.id,'imported');check(f.StudyFlow.manualScores[2],'40');check(event.target.value,'');
}
// Exercise the actual templates for all schools/subjects after the text cleanup.
{
 const f=setup(),config=f.DifficultyEngine.defaults('英语','pku',difficulty,workflows.profiles);
 config.excludeAttempted=false;config.excludeGenerated=false;config.excludeMaterials=false;
 const packet=f.DifficultyEngine.makePacket(difficulty,config,schools,{});packet.id='complete';
 f.Hub.packet=packet;f.Hub.answers={1:'B'};f.Hub.validatePacket=p=>f.WorkflowEngine.validatePacket(p);
 const backup=JSON.stringify(f.Hub.packetBackup());
 await f.Hub.importPacket({target:{files:[{size:backup.length,text:async()=>backup}],value:'backup'}});
 check(f.Hub.answers[1],'B');check(f.Hub.packet.id!=='complete',true);check(f.Hub.packetMeta.revision,0);check(f.Hub.saveError,'');
}
{
 const f=setup();f.Hub.renderSchools();check((f.screen.innerHTML.match(/class="hub-school-card"/g)||[]).length,6);
 check(f.screen.innerHTML.includes('ONE SPACE'),false);check(f.screen.innerHTML.includes('资料与招生参考'),true);
 f.TierStudio.updateStocks=()=>{};f.TierStudio.loadPresets=()=>{};
 for(const school of schools.schools)for(const subject of school.subjects){f.Hub.school=school.id;f.TierStudio.reset(subject,school.id);f.TierStudio.render();check(f.screen.innerHTML.includes('id="tier-form"'),true);check(f.screen.innerHTML.includes('data-tier-field="count"'),true);check((f.screen.innerHTML.match(/<details\b/g)||[]).length,(f.screen.innerHTML.match(/<\/details>/g)||[]).length);}
}
console.log('PASS: '+checks+' frontend grading, save failure, delayed request, essay edit, backup and template checks.');
