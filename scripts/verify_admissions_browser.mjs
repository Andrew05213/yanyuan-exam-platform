// Run with Chromium installed, against the compiled worker and an empty private D1.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readdirSync,readFileSync,mkdtempSync} from 'node:fs';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const wr=createRequire(require.resolve('wrangler')),{Miniflare}=require(wr.resolve('miniflare')),{MockAgent}=require(wr.resolve('undici'));
const mock=new MockAgent();mock.disableNetConnect();
let researchCalls=0;
function fakeResearch(result){mock.get('https://api.deepseek.com').intercept({path:'/chat/completions',method:'POST'}).reply(()=>{researchCalls++;return {statusCode:200,data:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:100,prompt_cache_hit_tokens:40,completion_tokens:20}})};});}
const server=path.resolve('dist/server');
const modules=['index.js',...readdirSync(server,{recursive:true}).filter(f=>/\.m?js$/.test(f)&&f!=='index.js')];
const mf=new Miniflare({modules:modules.map(f=>({type:'ESModule',path:path.join(server,f)})),modulesRoot:server,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_USER_IDS:'qa-browser-admin',AI_CREDENTIALS_ENCRYPTION_KEY:randomBytes(32).toString('base64')},fetchMock:mock});
const userdir=mkdtempSync(path.join(tmpdir(),'admissions-chrome-'));
let chrome,socket,browserWs;
const ownProcessGroup=process.platform!=='win32';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const running=()=>chrome?.pid&&chrome.exitCode===null&&chrome.signalCode===null;
async function waitForExit(ms){
 const end=Date.now()+ms;while(running()&&Date.now()<end)await sleep(100);return !running();
}
function signalBrowser(signal){
 if(!chrome?.pid)return;
 try{if(ownProcessGroup)process.kill(-chrome.pid,signal);else if(running())chrome.kill(signal);}catch(e){if(e.code!=='ESRCH')throw e;}
}
async function closeBrowser(){
 // Request a clean shutdown of the browser, not merely the page target.
 if(running()&&browserWs){
  const control=new WebSocket(browserWs);
  control.addEventListener('open',()=>control.send(JSON.stringify({id:1,method:'Browser.close'})),{once:true});
  control.addEventListener('error',()=>{}, {once:true});
  try{await waitForExit(5000);}finally{control.close();}
 }
 // Chromium renderers and helpers can outlive the parent. Signal only the
 // isolated group we created, never unrelated browser processes.
 signalBrowser('SIGTERM');await waitForExit(3000);await sleep(300);
 signalBrowser('SIGKILL');if(!await waitForExit(3000))throw Error('Chromium did not exit after shutdown');
}

const app=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+req.headers.host);
  if(url.pathname.startsWith('/api/')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const r=await mf.dispatchFetch(url.href,{method:req.method,headers:{...req.headers,'oai-authenticated-user-id':'browser-fixture'},body:chunks.length?Buffer.concat(chunks):undefined});
   res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
  }
  const file=path.resolve('dist/client','.'+url.pathname);
  if(!file.startsWith(path.resolve('dist/client')+path.sep))throw Error();
  const bytes=readFileSync(file);
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'})[path.extname(file)]??'application/octet-stream');
  res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())
  for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at) VALUES(?,?,?,?,?,?)").bind('browser-fixture','research-fixture','Research fixture','fixture 物哀 evidence','在读',new Date().toISOString()).run();
 async function admin(body){const r=await mf.dispatchFetch('https://study.test/api/admin/providers',{method:'POST',headers:{'oai-authenticated-user-id':'qa-browser-admin','oai-authenticated-user-email':'qa-browser-admin@qa.invalid','Content-Type':'application/json','Origin':'https://study.test'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
 const provider=(await admin({name:'Browser mock',protocol:'openai-compatible',baseUrl:'https://api.deepseek.com',model:'qa-browser',currency:'USD',enabled:true,apiKey:'qa-browser-secret',inputPrice:'2',cachedInputPrice:'0.5',outputPrice:'8'})).provider;
 await admin({action:'select-default',id:provider.id,expectedRevision:provider.revision});
 app.listen(0,'127.0.0.1');await once(app,'listening');
 const base='http://127.0.0.1:'+app.address().port;
 chrome=spawn(process.env.CHROME_BIN||'chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-breakpad','--disable-crash-reporter','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+userdir,'about:blank'],{stdio:['ignore','ignore','pipe'],detached:ownProcessGroup});
 const ws=await new Promise((resolve,reject)=>{
  let log='';chrome.on('error',reject);chrome.on('exit',()=>reject(Error('Chromium exited: '+log.slice(-4000))));
  chrome.stderr.on('data',buf=>{log+=buf;const match=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match)resolve(match[1]);});
 });
 browserWs=ws;
 const [page]=await (await fetch('http://'+new URL(ws).host+'/json/list')).json();
 socket=new WebSocket(page.webSocketDebuggerUrl);await once(socket,'open');
 let serial=0;const pending=new Map();
 socket.onmessage=({data})=>{const r=JSON.parse(data);if(r.id)pending.get(r.id)?.(r);};
 async function send(method,params={}){
  const id=++serial;const response=new Promise(resolve=>pending.set(id,resolve));socket.send(JSON.stringify({id,method,params}));
  try{const r=await response;if(r.error)throw Error(r.error.message);return r.result;}finally{pending.delete(id);}
 }
 async function js(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;}
 async function until(expr,attempts=120){for(let i=0;i<attempts;i++){try{if(await js(expr))return;}catch(e){if(!/Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id/.test(String(e.message)))throw e;}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expr+' '+await js('document.body.innerText.slice(-900)'));}
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:width===390});
  await send('Page.navigate',{url:base+'/index.html#admissions'});
  await until("!!document.querySelector('[name=city]')");
  await js("document.querySelector('[name=school][value=pku]').checked=true;document.querySelector('[name=city]').value='北京';document.querySelector('[data-indicator]').value='2';document.querySelector('[data-indicator]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[value=save]').click()");
  await until("document.body.innerText.includes('方案已保存。')");
  await js("window.__previousPage=true");await send('Page.reload');await until("!window.__previousPage");await until("document.querySelector('[data-indicator]')?.value==='2' && !!document.querySelector('a[href^=\"#task/\"]')");
  assert.equal(await js("document.querySelector('[name=city]').value"),'北京');
  await js("document.querySelector('.admissions-results a[href^=\"#task/\"]').click()");
  await until("location.hash.startsWith('#task/') && !!document.querySelector('#screen h1') && !document.querySelector('.admissions-workspace')");
  await send('Page.navigate',{url:base+'/index.html#today'});
  await until("!!document.querySelector('[data-sp-add]')");
  await js("document.querySelector('[data-sp-budget]').value='65';document.querySelector('[data-sp-budget-form]').requestSubmit()");
  await until("document.querySelector('[data-sp-message]')?.innerText.includes('已保存当天预算')");
  await js("document.querySelector('[data-sp-add]').closest('details').open=true;document.querySelector('[data-sp-preview]').closest('details').open=true;document.querySelector('[data-sp-add]').click();document.querySelector('[data-sp-manual] [name=title]').value='Browser study';document.querySelector('[data-sp-preview]').click()");
  await until("!document.querySelector('[data-sp-save]').disabled");
  await js("document.querySelector('[data-sp-save]').click()");
  await until("!!document.querySelector('[data-sp-task]') && document.querySelector('[data-sp-message]').innerText.includes('已保存')");
  await js("window.__previousPage=true");await send('Page.reload');await until("!window.__previousPage");await until("document.querySelector('[data-sp-tasks]')?.innerText.includes('Browser study')");
  await js("document.querySelector('[data-sp-done]').click()");
  await until("document.querySelector('[data-sp-done]')?.checked && document.querySelector('[data-sp-message]')?.innerText.includes('已保存')");
  await js("(()=>{const form=document.querySelector('[data-sp-quick]');form.elements.title.value='Quick reading';form.elements.minutes.value='5';form.elements.minutes.dispatchEvent(new Event('change'));form.requestSubmit();})()");
  await until("document.querySelector('[data-sp-tasks]')?.innerText.includes('Quick reading') && document.querySelector('[data-sp-message]')?.innerText.includes('已添加任务')");
  assert.equal(await js("document.querySelector('[data-sp-done]')?.checked"),true);
  await js("document.querySelector('[data-sp-budget]').value='0';document.querySelector('[data-sp-budget-form]').requestSubmit()");
  await until("document.querySelector('[data-sp-quick] [name=expandBudget]')?.required");
  await js("(()=>{const form=document.querySelector('[data-sp-quick]');form.elements.title.value='Extra reading';form.elements.expandBudget.checked=true;form.requestSubmit();})()");
  await until("document.querySelector('[data-sp-tasks]')?.innerText.includes('Extra reading') && document.querySelector('[data-sp-message]')?.innerText.includes('已添加任务')");
  await js("document.querySelector('[data-sp-budget]').value='5';document.querySelector('[data-sp-budget-form]').requestSubmit()");
  await until("document.querySelector('[data-sp-budget-form]').innerText.includes('超出预算') && document.querySelector('[data-sp-message]')?.innerText.includes('已保存当天预算')");
  assert.equal(await js("document.querySelector('[data-sp-done]')?.checked"),true);
  assert.equal(await js("document.querySelector('[data-sp-tasks]').innerText.includes('Extra reading')"),true);
  await js("document.querySelector('[data-sp-tab=week]').click()");
  await until("document.querySelector('[data-sp-body]').innerText.includes('备考主线投入')");

  await js("document.querySelector('[data-sp-tab=reflection]').click();document.querySelector('[data-sp-reflection] [name=challenge]').value='Browser reflection';document.querySelector('[data-sp-reflection] button').click()");
  await until("document.querySelector('[data-sp-message]')?.innerText.includes('已保存')");
  await js("document.querySelector('[data-sp-tab=tasks]').click()");
  await until("!!document.querySelector('[data-sp-delete]')");
  await send('Page.enable');let dialog;socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-sp-delete]').click()");
  await until("!document.querySelector('[data-sp-task]') && document.querySelector('[data-sp-message]')?.innerText.includes('已保存')");
  await js("document.querySelector('[data-sp-tab=settings]').click()");
  await until("!!document.querySelector('[data-long-form]')");
  await js("document.querySelector('[data-long-budget=\"0\"]').value='45';document.querySelector('[data-long-form] button.btn.primary').click()");
  await until("document.querySelector('[data-sp-message]')?.innerText.includes('长期设置已保存')");
  await js("document.querySelector('[data-long-preview]').click()");
  await until("!document.querySelector('[data-long-save]')?.disabled && !!document.querySelector('[data-long-result]')");
  await js("document.querySelector('[data-long-save]').click()");
  await until("document.querySelector('[data-sp-message]')?.innerText.includes('整周计划已创建')");
  await js("window.__weekReload=true");await send('Page.reload');await until("!window.__weekReload");await until("!!document.querySelector('[data-sp-tab=settings]')");
  await js("document.querySelector('[data-sp-tab=settings]').click()");
  await until("document.querySelector('[data-long-budget=\"0\"]')?.value==='45'");
  await send('Page.navigate',{url:base+'/index.html#knowledge-graph'});
  await until("!!document.querySelector('[data-kg-concept]')");
  await js("document.querySelector('[data-kg-concept] [name=title]').value='Browser concept A';document.querySelector('[data-kg-concept] button').click()");
  await until("document.querySelector('[data-kg-message]')?.innerText.includes('已保存')");
  await js("document.querySelector('[data-kg-concept] [name=title]').value='Browser concept B';document.querySelector('[data-kg-concept] button').click()");
  await until("document.querySelector('[data-kg-message]')?.innerText.includes('已保存')");
  await js("document.querySelector('[data-kg-search] [name=kind]').value='concept';document.querySelector('[data-kg-search] button.btn.primary').click()");
  await until("document.querySelectorAll('[data-kg-node]').length===2");
  await js("document.querySelector('[data-kg-node]').click()");
  await until("!!document.querySelector('[data-kg-link]')");
  await js("document.querySelector('[data-kg-link] [name=note]').value='Browser relation';document.querySelector('[data-kg-link] button').click()");
  await until("document.querySelector('[data-kg-message]')?.innerText.includes('已保存') && !!document.querySelector('[data-kg-edit-link]')");
  await js("window.__kgReload=true");await send('Page.reload');await until("!window.__kgReload");await until("!!document.querySelector('[data-kg-search]')");
  await js("document.querySelector('[data-kg-search] [name=kind]').value='concept';document.querySelector('[data-kg-search] button.btn.primary').click()");
  await until("document.querySelectorAll('[data-kg-node]').length===2");
  await js("document.querySelector('[data-kg-node]').click()");
  await until("!!document.querySelector('[data-kg-edit-link]')");
  assert.equal(await js("document.querySelector('[data-kg-detail]').innerText.includes('Browser relation')"),true);
  assert.equal(await js("document.querySelector('.kg-workspace').scrollWidth<=document.querySelector('.kg-workspace').clientWidth+2"),true);
  await js("document.querySelector('[data-kg-zoom-in]').click();document.querySelector('[data-kg-zoom-reset]').click();document.querySelector('[data-kg-list-toggle]').click()");
  assert.equal(await js("document.querySelector('[data-kg-svg]').hidden"),true);
  await js("document.querySelector('[data-kg-list-toggle]').click()");
  await js("document.querySelector('[data-kg-edit-link] [name=note]').value='Updated relation';document.querySelector('[data-kg-edit-link] button').click()");
  await until("document.querySelector('[data-kg-message]')?.innerText.includes('已保存') && document.querySelector('[data-kg-detail]').innerText.includes('Updated relation')");
  socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-kg-delete-link]').click()");
  await until("document.querySelector('[data-kg-message]')?.innerText.includes('已保存') && !document.querySelector('[data-kg-edit-link]')");
  socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-kg-delete-concept]').click()");
  await until("document.querySelector('[data-kg-message]')?.innerText.includes('已保存') && document.querySelectorAll('[data-kg-node]').length===1");

  await send('Page.navigate',{url:base+'/index.html#references'});
  await until("!!document.querySelector('[data-ref-editor]')");
  await js("document.querySelector('[data-ref-editor] [name=title]').value='Browser paper';document.querySelector('[data-ref-editor] [name=authors]').value='Author';document.querySelector('[data-ref-editor] [name=year]').value='2024';document.querySelector('[data-ref-editor] [name=doi]').value='10.1234/browser';document.querySelector('[data-ref-editor] [name=status]').value='reading';document.querySelector('[data-ref-editor] button.btn.primary').click()");
  await until("document.querySelector('[data-ref-message]')?.innerText.includes('已保存') && !!document.querySelector('[data-ref-select]')");
  await js("document.querySelector('[data-ref-select]').click()");
  await until("document.querySelector('[data-ref-editor] [name=title]')?.value==='Browser paper' && document.querySelector('[data-ref-editor] [name=status]')?.value==='reading'");
  await js("document.querySelector('[data-ref-export] [name=format]').value='bibtex';document.querySelector('[data-ref-export] button').click()");
  await until("document.querySelector('[data-ref-output]')?.value.includes('10.1234/browser')");
  await js("window.__refReload=true");await send('Page.reload');await until("!window.__refReload");await until("!!document.querySelector('[data-ref-select]')");
  await js("document.querySelector('[data-ref-select]').click()");
  await until("document.querySelector('[data-ref-editor] [name=title]')?.value==='Browser paper' && document.querySelector('[data-ref-editor] [name=status]')?.value==='reading'");
  await js("document.querySelector('[data-ref-editor] [name=title]').value='Edited browser paper';document.querySelector('[data-ref-editor] [name=status]').value='read';document.querySelector('[data-ref-editor] button.btn.primary').click()");
  await until("document.querySelector('[data-ref-message]')?.innerText.includes('已保存') && document.querySelector('[data-ref-editor] [name=title]')?.value==='Edited browser paper' && document.querySelector('[data-ref-editor] [name=status]')?.value==='read'");
  assert.equal(await js("document.querySelector('.ref-workspace').scrollWidth<=document.querySelector('.ref-workspace').clientWidth+2"),true);
  socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-ref-delete]').click()");
  await until("document.querySelector('[data-ref-message]')?.innerText.includes('已保存') && !document.querySelector('[data-ref-select]')");
  await send('Page.navigate',{url:base+'/index.html#deep-research'});
  await until("!!document.querySelector('[data-dr-editor]')");
  await js("document.querySelector('[data-dr-editor] [name=title]').value='Browser research';document.querySelector('[data-dr-editor] [name=question]').value='Compare evidence';document.querySelector('[data-dr-editor] button.btn.primary').click()");
  await until("document.querySelector('[data-dr-message]')?.innerText.includes('已保存') && !!document.querySelector('[data-dr-search]')");
  await js("window.__drReload=true");await send('Page.reload');await until("!window.__drReload");await until("!!document.querySelector('[data-dr-task]')");
  await js("document.querySelector('[data-dr-task]').click()");
  await until("document.querySelector('[data-dr-editor] [name=title]')?.value==='Browser research'");
  await js("document.querySelector('[data-dr-search] [name=terms]').value='fixture';document.querySelector('[data-dr-search] button').click()");
  await until("document.querySelector('[data-dr-message]')?.innerText.includes('检索到') && !!document.querySelector('[data-dr-hit]')");
  await js("document.querySelector('[data-dr-hit]').click();document.querySelector('[data-dr-select]').click()");
  await until("document.querySelector('[data-dr-message]')?.innerText.includes('已保存') && document.querySelector('[data-dr-selected]').innerText.includes('1 / 4')");
  await js("document.querySelector('[data-dr-preview]').click()");
  await until("!!document.querySelector('[data-dr-confirm]') && document.querySelector('[data-dr-preview-area]').innerText.includes('物哀')");
  const beforeResearch=researchCalls;
  fakeResearch({findings:[{statement:'研究草稿',evidence:[{source:'S1',quote:'物哀'}]}],limitations:['仅依据片段'],questions:['如何比较语境？']});
  await js("document.querySelector('[data-dr-confirm]').click()");
  await until("!!document.querySelector('[data-dr-review]') && document.querySelector('[data-dr-results]').innerText.includes('研究草稿')");
  assert.equal(researchCalls,beforeResearch+1);
  await js("document.querySelector('[data-dr-finding] [name=status]').value='accepted';document.querySelector('[data-dr-finding] [name=note]').value='Browser checked';document.querySelector('[data-dr-review] button').click()");
  await until("document.querySelector('[data-dr-message]')?.innerText.includes('已保存') && document.querySelector('[data-dr-finding] [name=status]')?.value==='accepted'");
  await js("window.__drResultReload=true");await send('Page.reload');await until("!window.__drResultReload");await until("!!document.querySelector('[data-dr-task]')");
  await js("document.querySelector('[data-dr-task]').click()");
  await until("document.querySelector('[data-dr-finding] [name=note]')?.value==='Browser checked'");
  await js("document.querySelector('[data-dr-expand] [name=query]').value='物哀';document.querySelector('[data-dr-expand]').closest('details').open=true;document.querySelector('[data-dr-expand] button').click()");
  await until("!!document.querySelector('[data-dr-expand-confirm]')");
  fakeResearch({terms:['もののあはれ','mono no aware']});
  await js("document.querySelector('[data-dr-expand-confirm]').click()");
  await until("document.querySelector('[data-dr-search] [name=terms]')?.value.includes('mono no aware')");
  assert.equal(researchCalls,beforeResearch+2);
  assert.equal(await js("document.querySelector('.dr-workspace').scrollWidth<=document.querySelector('.dr-workspace').clientWidth+2"),true);
  await send('Page.navigate',{url:base+'/index.html#research-results'});
  await until("!!document.querySelector('[data-rr-form]')");
  await js("document.querySelector('[data-rr-form] button').click()");
  await until("!!document.querySelector('[data-rr-docx]') && document.querySelector('.rr-paper').innerText.includes('Browser checked')");
  assert.equal(await js("document.querySelector('.rr-workspace').scrollWidth<=document.querySelector('.rr-workspace').clientWidth+2"),true);
  await js("window.__rrWord=null;fetch(document.querySelector('[data-rr-docx]').href).then(r=>r.arrayBuffer()).then(b=>window.__rrWord=new DataView(b).getUint32(0,true))");
  await until("window.__rrWord===0x04034b50");
  const printUrl=await js("document.querySelector('[data-rr-print]').href");
  await send('Page.navigate',{url:printUrl});
  await until("!!document.querySelector('main.paper') && document.body.innerText.includes('Browser checked')");
  const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
  assert.equal(Buffer.from(pdf.data,'base64').subarray(0,5).toString(),'%PDF-');
  await send('Page.navigate',{url:base+'/index.html#deep-research'});
  await until("!!document.querySelector('[data-dr-task]')");
  await js("document.querySelector('[data-dr-task]').click()");
  await until("document.querySelector('[data-dr-finding] [name=note]')?.value==='Browser checked'");
  socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-dr-delete]').click()");
  await until("document.querySelector('[data-dr-message]')?.innerText.includes('已保存') && !document.querySelector('[data-dr-task]')");
  await send('Page.navigate',{url:base+'/index.html#exam-imports'});
  await until("!!document.querySelector('[data-ei-upload]')");
  await js("(()=>{const f=document.querySelector('[data-ei-upload]');const dt=new DataTransfer();dt.items.add(new File(['1. Synthetic question?\\nA. One B. Two C. Three D. Four\\n答案：B'],'browser.txt',{type:'text/plain'}));f.querySelector('[name=file]').files=dt.files;f.querySelector('[name=source]').value='Synthetic source 2026';f.querySelector('[name=confirm]').checked=true;f.querySelector('button').click()})()");
  await until("document.querySelector('[data-ei-text]')?.value.includes('Synthetic question')");
  await js("document.querySelector('[data-ei-parse]').click();document.querySelector('[data-ei-group-form] [name=locator]').value='page 1';document.querySelector('[data-ei-group-form] [name=locator]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-ei-confirm]').checked=true;document.querySelector('[data-ei-approve]').click()");
  await until("document.querySelector('[data-ei-msg]')?.innerText.includes('已确认入私人题库')");
  assert.equal(await js("TierStudio.data.items.some(x=>x.importId&&x.source.includes('Synthetic source 2026')&&x.questions[0].answer==='B')"),true);
  const trace=await js("(()=>{const u=TierStudio.data.items.find(x=>x.importId);const c={schema:'tiers-v1',schoolId:'pku',subject:'英语',minutes:20,name:'Import provenance fixture',topics:[],fullReadingSets:false,excludeAttempted:false,excludeGenerated:false,excludeMaterials:false,rows:[{section:'mc',tier:u.tier,count:1}]};const p=DifficultyEngine.makePacket({...TierStudio.data,items:[u]},c,Hub.data,{},()=>0.5);const b=p.blocks[0],h=StudyFlow.blockHTML(b,1,false),md=StudyFlow.packetMarkdown(p);return {q:b.questions[0].originalNumber,html:h.includes('Synthetic source 2026')&&h.includes('原题1')&&h.includes('data-import-source'),markdown:md.includes('Synthetic source 2026')&&md.includes('原题1')}})()");
  assert.deepEqual(trace,{q:1,html:true,markdown:true});
  assert.equal(await js("ExamImportParser.parse('1. Question?\\nA. One B. Two C. Three D. Four\\n答案：B\\n参考答案：1.C').questions[0].answer"),'');
  await js("window.__eiReload=true");await send('Page.reload');await until("!window.__eiReload");await until("!!document.querySelector('[data-ei-file]')");
  await js("document.querySelector('[data-ei-file]').click()");
  await until("document.querySelector('[data-ei-meta] [name=source]')?.value==='Synthetic source 2026' && document.querySelector('[data-ei-group-form] [name=locator]')?.value==='page 1' && document.querySelector('[data-ei-questions] [data-q=answer]')?.value==='B'");
  socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-ei-delete]').click()");
  await until("document.querySelector('[data-ei-msg]')?.innerText.includes('已删除') && !document.querySelector('[data-ei-file]')");
  const fixture=readFileSync('scripts/fixtures/exam-mixed.pdf.b64','utf8').trim();
  await js(`(()=>{const f=document.querySelector('[data-ei-upload]'),dt=new DataTransfer();
   dt.items.add(new File([Uint8Array.from(atob('${fixture}'),c=>c.charCodeAt(0))],'mixed.pdf',{type:'application/pdf'}));
   f.elements.file.files=dt.files;f.elements.source.value='Synthetic PDF';f.elements.confirm.checked=true;f.requestSubmit();})()`);
  await until("document.querySelector('[data-ei-msg]')?.innerText.includes('已自动保存待审核')",1200);
  await js("window.__pdfReload=true");await send('Page.reload');await until("!window.__pdfReload");
  await until("!!document.querySelector('[data-ei-file]')");
  await js("document.querySelector('[data-ei-file]').click()");
  await until("ExamImports.record?.groups?.[0]?.questions?.length===2");
  assert.deepEqual(await js("ExamImports.record.groups[0].questions.map(q=>[q.sourceNumber,q.sourcePage,q.answer])"),[[1,1,'A'],[2,3,'B']]);
  assert.deepEqual(await js("ExamImports.record.groups[0].questions[0].options"),['Blue','Red','Green','Yellow']);
  assert.match(await js("ExamImports.record.groups[0].pdfPages[1]"),/Practice English Examination/);
  assert.equal(await js("ExamImports.record.approved"),false);
  await js("document.querySelector('[data-ei-confirm]').checked=true;document.querySelector('[data-ei-approve]').click()");
  await until("document.querySelector('[data-ei-msg]')?.innerText.includes('已确认入私人题库')");
  assert.equal(await js("ExamImports.record.groups[0].questions[1].sourcePage"),3);
  const importId=JSON.stringify(await js("ExamImports.record.id"));
  const importedStock=`TierStudio.data.items.filter(item=>item.importId===${importId}).length`;
  assert.equal(await js(importedStock),2);
  await js("location.hash='#studio'");
  await until("!!document.querySelector('[data-tier-stock]')");
  await js("window.__pdfApprovedStock = [...document.querySelectorAll('[data-tier-stock]')].map(node=>Number(node.textContent))");
  await js("location.hash='#exam-imports'");
  await until("!!document.querySelector('[data-ei-file]')");
  await js("document.querySelector('[data-ei-file]').click()");
  await until("ExamImports.record?.approved===true && !!document.querySelector('[data-ei-extract]')");
  socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-ei-extract]').click()");
  await until("document.querySelector('[data-ei-msg]')?.innerText.includes('已自动保存待审核')",1200);
  assert.equal(await js("ExamImports.record.approved"),false);
  assert.equal(await js(importedStock),0);
  await js("location.hash='#studio'");
  await until("!!document.querySelector('[data-tier-stock]')");
  assert.ok(await js("[...document.querySelectorAll('[data-tier-stock]')].some((node,i)=>Number(node.textContent)<window.__pdfApprovedStock[i])"),'draft questions must disappear from visible stock before preview');
  await js("location.hash='#exam-imports'");
  await until("!!document.querySelector('[data-ei-file]')");
  await js("document.querySelector('[data-ei-file]').click()");
  await until("!!document.querySelector('[data-ei-delete]')");
  socket.addEventListener('message',function handler({data}){const msg=JSON.parse(data);if(msg.method==='Page.javascriptDialogOpening'){socket.removeEventListener('message',handler);void send('Page.handleJavaScriptDialog',{accept:true});}});
  await js("document.querySelector('[data-ei-delete]').click()");
  await until("document.querySelector('[data-ei-msg]')?.innerText.includes('已删除') && !document.querySelector('[data-ei-file]')");
  console.log('PASS: cross-page PDF text, real scan OCR and immediate visible stock refresh at width '+width);
  await db.prepare("DELETE FROM private_reference_libraries WHERE user_id=?").bind('browser-fixture').run();
  await db.prepare("DELETE FROM private_knowledge_graphs WHERE user_id=?").bind('browser-fixture').run();
  // Reset the isolated fixture's week so the second viewport exercises creation rather than reuse.
  await db.prepare("DELETE FROM study_day_plans WHERE user_id=?").bind('browser-fixture').run();


 }
 mock.assertNoPendingInterceptors();assert.equal(researchCalls,4);
 console.log('PASS: Chromium deep research preview, mock analysis, citation, review, expansion and reload.');
 console.log('PASS: Chromium desktop/mobile private report preview, DOCX bytes, real print-to-PDF and return navigation.');
 console.log('PASS: Chromium desktop/mobile exam text upload, parse, provenance, reviewed catalog, reload and deletion.');
 console.log('PASS: Chromium desktop/mobile admissions and study planner save, reload, reflection, delete, long-term preferences, weekly preview/save, private graph and references create, search, link, export, edit, delete, reload and navigation.');
}finally{
 try{socket?.close();await closeBrowser();}finally{
  app.closeAllConnections();app.close();
  try{await mf.dispose();await mock.close();}finally{
   // Asynchronous bounded cleanup allows pending OS filesystem activity to drain.
   // Do not suppress a final cleanup failure or any functional assertion.
   await rm(userdir,{recursive:true,force:true,maxRetries:20,retryDelay:250});
  }
 }
 console.log('PASS: Chromium shutdown and isolated profile cleanup.');
}
