// Run with Chromium installed, against the compiled worker and an empty private D1.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readdirSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const server=path.resolve('dist/server');
const modules=['index.js',...readdirSync(server,{recursive:true}).filter(f=>/\.m?js$/.test(f)&&f!=='index.js')];
const mf=new Miniflare({modules:modules.map(f=>({type:'ESModule',path:path.join(server,f)})),modulesRoot:server,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const userdir=mkdtempSync(path.join(tmpdir(),'admissions-chrome-'));
let chrome,socket;
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
 app.listen(0,'127.0.0.1');await once(app,'listening');
 const base='http://127.0.0.1:'+app.address().port;
 chrome=spawn(process.env.CHROME_BIN||'chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+userdir,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const ws=await new Promise((resolve,reject)=>{
  let log='';chrome.on('error',reject);chrome.on('exit',()=>reject(Error('Chromium exited: '+log.slice(-4000))));
  chrome.stderr.on('data',buf=>{log+=buf;const match=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match)resolve(match[1]);});
 });
 const [page]=await (await fetch('http://'+new URL(ws).host+'/json/list')).json();
 socket=new WebSocket(page.webSocketDebuggerUrl);await once(socket,'open');
 let serial=0;const pending=new Map();
 socket.onmessage=({data})=>{const r=JSON.parse(data);if(r.id)pending.get(r.id)?.(r);};
 async function send(method,params={}){
  const id=++serial;const response=new Promise(resolve=>pending.set(id,resolve));socket.send(JSON.stringify({id,method,params}));
  try{const r=await response;if(r.error)throw Error(r.error.message);return r.result;}finally{pending.delete(id);}
 }
 async function js(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;}
 async function until(expr){for(let i=0;i<120;i++){if(await js(expr))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expr+' '+await js('document.body.innerText.slice(-900)'));}
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
 }
 console.log('PASS: Chromium desktop/mobile plan save, reload, evidence and training navigation.');
}finally{
 socket?.close();if(chrome?.pid&&chrome.exitCode===null){const closed=once(chrome,'exit');chrome.kill();await closed;}
 app.closeAllConnections();app.close();await mf.dispose();rmSync(userdir,{recursive:true,force:true});
}
