import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/boot\(\);\s*$/,'');
function harness(){
 const calls=[],timers=[],screen={innerHTML:''},status={textContent:''},received=[];let initialized=0;
 const context=vm.createContext({AbortController,console,document:{querySelector:s=>s==='#screen'?screen:status,querySelectorAll:()=>[]},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},fetch:(path,options)=>new Promise((resolve,reject)=>{calls.push({path,options,resolve:data=>resolve({ok:true,json:async()=>data})});options.signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e);});}),Hub:{init(){}},StudyFlow:{init(){}},TierStudio:{init(){}},PublicApp:{async init(data){received.push(data);}},ExamStandards:{init(){}},SchoolTracks:{init(){}},QualityUI:{init(){}},AIGrading:{init(){}},OralAudioAnalysis:{init(){}}});
 vm.runInContext(source,context);context.recordReady=()=>initialized++;vm.runInContext('init=()=>recordReady();setupNavigation=()=>{};',context);
 return {context,calls,timers,screen,status,received,ready:()=>initialized};
}
const good=harness(),pending=vm.runInContext('boot()',good.context);assert.equal(good.calls.length,6);assert.equal(good.calls.at(-1).path,'/api/session');assert.equal(good.calls.at(-1).options.cache,'no-store');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const versions=new Map();
for(const [,name,version] of html.matchAll(/(?:src|href)="([\w.-]+)\?v=([a-f0-9]{12})"/g)){
 const bytes=readFileSync(new URL('../public/'+name,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,12),version,name);
 versions.set(name,version);
}
assert.ok(versions.has('difficulty.json'));
assert.ok(good.calls.some(call=>call.path==='difficulty.json?v='+versions.get('difficulty.json')));
for(const call of good.calls)call.resolve(call.path==='/api/session'?{authenticated:true,userId:'owner-test'}:{});await pending;assert.equal(good.ready(),1);assert.equal(good.received[0].userId,'owner-test');assert.match(good.status.textContent,/6\/6/);
const stalled=harness(),failed=vm.runInContext('boot()',stalled.context);for(const timeout of stalled.timers)timeout();await failed;assert.equal(stalled.ready(),0);assert.equal(stalled.received.length,0);assert.match(stalled.screen.innerHTML,/刷新页面/);
console.log('PASS: startup data and trusted session load concurrently; progress completes; stalled loads abort into retry without treating an unknown user as a guest.');
