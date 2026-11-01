import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../public/oral-audio-analysis.js',import.meta.url),'utf8');
const config={enabled:true,consentToken:'provider-A-v1',providerName:'Fixture',model:'audio-fixture',host:'api.example.test'};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
class Element{constructor(){this.checked=false;this.disabled=false;this.text='';this.html='';}set textContent(v){this.text=String(v);this.html='';}get textContent(){return this.text;}set innerHTML(v){this.html=String(v);this.text='';}get innerHTML(){return this.html;}}
function fixture(){
 const nodes=Object.fromEntries(['#oral-analysis-config','#oral-analysis-consent','#oral-analysis-result','[data-audio-analyze]'].map(k=>[k,new Element()]));
 const draft={audioId:'audio-A',item:{prompt:'Explain the idea',language:'English'},dirty:false,meta:{id:'attempt-A',revision:1}},posts=[],messages=[];
 const ctx=vm.createContext({console,AbortController,setTimeout,clearTimeout,document:{querySelector:k=>nodes[k]},PublicApp:{session:{authenticated:true,userId:'owner-A'}},Hub:{draft,routeToken:1,id:()=> 'request-123456',e:x=>String(x??''),paragraphs:x=>'<p>'+x+'</p>',async saveAttempt(){draft.dirty=false;}},toast:m=>messages.push(m)});
 vm.runInContext(source,ctx);const audio=vm.runInContext('OralAudioAnalysis',ctx);
 audio.config={...config};audio.boundSource=audio.fingerprint(draft);
 audio.json=async(url,options={})=>{if(options.method==='POST'){posts.push(JSON.parse(options.body));return {status:'failed',error:'fixture'};}return url.includes('?')?{status:'none'}:{...config};};
 const consent=nodes['#oral-analysis-consent'],result=nodes['#oral-analysis-result'];consent.checked=true;result.innerHTML='Feedback for audio A';
 return {ctx,audio,draft,nodes,consent,result,posts,messages};
}
// Switching recordings invalidates feedback and consent before the config response.
{
 const f=fixture(),wait=deferred();f.audio.json=()=>wait.promise;f.draft.audioId='audio-B';f.draft.dirty=true;
 const pending=f.audio.mount(f.draft);assert.equal(f.consent.checked,false);assert.equal(f.result.innerHTML,'');assert.equal(f.nodes['[data-audio-analyze]'].disabled,true);
 wait.resolve(config);await pending;assert.equal(f.consent.checked,false);assert.equal(f.result.innerHTML,'');
}
// Notes alone do not invalidate an audio review; a changed task or user does.
{
 const f=fixture();f.draft.answer='New notes';f.draft.dirty=true;await f.audio.mount(f.draft);assert.equal(f.consent.checked,true);assert.equal(f.result.innerHTML,'Feedback for audio A');
 f.draft.item.prompt='A different task';await f.audio.mount(f.draft);assert.equal(f.consent.checked,false);assert.equal(f.result.innerHTML,'');
 f.consent.checked=true;f.ctx.PublicApp.session.userId='owner-B';await f.audio.mount(f.draft);assert.equal(f.consent.checked,false);
}
// A late result for audio A cannot be displayed after audio B is uploaded.
{
 const f=fixture(),wait=deferred();f.audio.json=async url=>url.includes('?')?wait.promise:config;
 const old=f.audio.mount(f.draft);await tick();f.draft.audioId='audio-B';f.draft.dirty=true;await f.audio.mount(f.draft);
 wait.resolve({status:'succeeded',current:true,result:{audioId:'audio-A'}});await old;assert.equal(f.result.innerHTML,'');assert.equal(f.consent.checked,false);
}
// Config responses that arrive out of order cannot restore an old Provider.
{
 const f=fixture(),a=deferred(),b=deferred();let call=0;f.draft.dirty=true;f.audio.json=()=>++call===1?a.promise:b.promise;
 const old=f.audio.mount(f.draft);f.draft.audioId='audio-B';const latest=f.audio.mount(f.draft);b.resolve({...config,consentToken:'provider-B'});await latest;a.resolve(config);await old;assert.equal(f.audio.config.consentToken,'provider-B');
}
// Saving may finish after the user changes Provider or revokes consent.
for(const change of ['provider','consent']){
 const f=fixture(),save=deferred();f.draft.dirty=true;f.ctx.Hub.saveAttempt=async()=>{await save.promise;f.draft.dirty=false;};
 const pending=f.audio.analyze();await tick();if(change==='provider')f.audio.config={...config,consentToken:'provider-B'};else f.consent.checked=false;
 save.resolve();await pending;assert.equal(f.posts.length,0);assert.match(f.result.textContent,/重新确认/);
}
// A job finishing after the source changes keeps its result off the new draft.
{
 const f=fixture(),wait=deferred();f.audio.json=async(url,options={})=>options.method==='POST'?wait.promise:url.includes('?')?{status:'none'}:config;
 const pending=f.audio.analyze();await tick();f.draft.audioId='audio-B';f.draft.dirty=true;await f.audio.mount(f.draft);wait.resolve({status:'succeeded',result:{audioId:'audio-A'}});await pending;assert.equal(f.result.innerHTML,'');assert.equal(f.consent.checked,false);
}
{
 const f=fixture();f.audio.show({status:'succeeded',current:true,result:{audioId:'audio-B'}});assert.match(f.result.textContent,/旧录音/);
 f.audio.json=async()=>{throw Error('offline');};await f.audio.mount(f.draft);assert.equal(f.nodes['[data-audio-analyze]'].disabled,true);
}
console.log('PASS: audio/task/user-bound feedback and consent; stale response exclusion; Provider and consent races; safe config failures.');
