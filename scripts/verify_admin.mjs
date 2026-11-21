// Isolated Workers and in-memory D1 only. The internal harness is never deployed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler'));
const {Miniflare}=require(wranglerRequire.resolve('miniflare'));
const {buildSync}=require(wranglerRequire.resolve('esbuild'));
const root=path.resolve(import.meta.dirname,'..'),serverRoot=path.join(root,'dist/server');
const paths=readdirSync(serverRoot,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js');
const bindings={ADMIN_EMAILS:'admin-a@qa.invalid,admin-b@qa.invalid',AI_CREDENTIALS_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
const harness=buildSync({stdin:{resolveDir:root,contents:`
 import {recordAIUsage} from './lib/ai-usage';
 import {providerForExecution} from './lib/admin-providers';
 export default {async fetch(request){try{
  const body=await request.json();
  if(body.operation==='record')return Response.json(await recordAIUsage(body.user,body.provider,body.event));
  if(body.operation==='execution'){const p=await providerForExecution(body.id);return Response.json({id:p.id,keyMatches:p.apiKey===body.expectedKey});}
  return new Response('',{status:404});
 }catch{return Response.json({error:'rejected'},{status:400});}}};
`},bundle:true,external:['cloudflare:workers'],format:'esm',target:'es2022',write:false}).outputFiles[0].text;
const dbConfig={DB:'isolated-admin-db'};
const appModules=[{type:'ESModule',path:path.join(serverRoot,'index.js')},...paths.map(f=>({type:'ESModule',path:path.join(serverRoot,f)}))];
const mf=new Miniflare({workers:[
 {name:'app',modules:appModules,modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings,d1Databases:dbConfig,r2Buckets:['BUCKET']},
 {name:'no-master',modules:appModules,modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ADMIN_EMAILS:bindings.ADMIN_EMAILS},d1Databases:dbConfig,r2Buckets:['BUCKET']},
 {name:'no-allowlist',modules:appModules,modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{},d1Databases:dbConfig,r2Buckets:['BUCKET']},
 {name:'internal-test',script:harness,modules:true,compatibilityDate:'2026-05-15',bindings,d1Databases:dbConfig},
]});
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const ok=a=>{assert.ok(a);checks++;};
const fakeKey='fake-secret-used-only-in-isolated-tests',replacement='fake-replacement-used-only-in-isolated-tests';
const admin={'oai-authenticated-user-id':'admin-a','oai-authenticated-user-email':'admin-a@qa.invalid'};
const ordinary={'oai-authenticated-user-id':'ordinary','oai-authenticated-user-email':'ordinary@qa.invalid'};
async function call(route,body,headers=admin,options={}){
 const response=await mf.dispatchFetch('https://study.test'+route,{method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'}),...options.headers},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();ok(!text.includes(fakeKey)&&!text.includes(replacement)&&!text.includes(bindings.AI_CREDENTIALS_ENCRYPTION_KEY));
 return {status:response.status,data:JSON.parse(text),headers:response.headers};
}
const publicConfig={name:'Isolated QA',protocol:'openai-compatible',baseUrl:'https://api.example.com/v1',model:'qa-model',currency:'USD',enabled:true,inputPrice:'2',cachedInputPrice:'0.5',outputPrice:'8'};
const editable=p=>({id:p.id,expectedRevision:p.revision,name:p.name,protocol:p.protocol,baseUrl:p.baseUrl,model:p.model,currency:p.currency,enabled:p.enabled,inputPrice:p.inputPrice,cachedInputPrice:p.cachedInputPrice,outputPrice:p.outputPrice});
try{
 const db=await mf.getD1Database('DB','app'),internal=await mf.getWorker('internal-test');
 for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(path.join(root,'drizzle',f),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const noMaster=await mf.getWorker('no-master'),noAllowlist=await mf.getWorker('no-allowlist');
 eq((await noAllowlist.fetch('https://study.test/api/admin/session',{headers:admin})).status,403);
 for(const email of ['andreswang0702@163.com','andrew052131@gmail.com'])for(const lan of [false,true])eq((await noAllowlist.fetch('https://study.test/api/admin/session',{headers:{'oai-authenticated-user-id':'no-default-admin','oai-authenticated-user-email':email,...(lan?{'x-yanyuan-lan':'1'}:{})}})).status,403);
 const locked=await noMaster.fetch('https://study.test/api/admin/session',{headers:admin});eq((await locked.json()).encryptionReady,false);
 const rejected=await noMaster.fetch('https://study.test/api/admin/providers',{method:'POST',headers:{...admin,'Content-Type':'application/json'},body:JSON.stringify({...publicConfig,apiKey:fakeKey})});eq(rejected.status,503);ok(!(await rejected.text()).includes(fakeKey));
 for(const endpoint of ['session','providers','usage']){
  eq((await call('/api/admin/'+endpoint,undefined,{})).status,401);
  eq((await call('/api/admin/'+endpoint,undefined,ordinary)).status,403);
 }
 eq((await call('/api/admin/providers',{...publicConfig,apiKey:fakeKey},ordinary)).status,403);
 eq((await call('/api/admin/session',undefined,{'oai-authenticated-user-email':'admin-a@qa.invalid'})).status,401);
 eq((await call('/api/admin/session',undefined,{'oai-authenticated-user-id':'admin-b','oai-authenticated-user-email':'ADMIN-B@QA.INVALID'})).status,200);
 eq((await call('/api/session',undefined,admin)).data.admin,true);
 eq((await call('/api/session',undefined,ordinary)).data.admin,false);
 eq((await call('/api/session',undefined,{'oai-authenticated-user-id':'ordinary'})).status,200);
 eq((await call('/api/admin/providers',publicConfig,admin,{headers:{Origin:'https://other.test','Sec-Fetch-Site':'cross-site'}})).status,403);
 eq((await call('/api/admin/providers',publicConfig,admin,{headers:{'Content-Type':'text/plain'}})).status,415);
 eq((await call('/api/admin/providers',{...publicConfig,name:'x'.repeat(33000)})).status,413);
 eq((await call('/api/admin/providers',{...publicConfig,baseUrl:'http://localhost'})).status,400);
 eq((await call('/api/admin/providers',{...publicConfig,admin:true})).status,400);
 const created=await call('/api/admin/providers',{...publicConfig,apiKey:fakeKey});eq(created.status,200);
 let p=created.data.provider;eq(p.hasKey,true);eq('apiKey' in p,false);eq('encrypted_key' in p,false);
 eq((await call('/api/admin/models',{id:p.id,expectedRevision:p.revision},{})).status,401);
 eq((await call('/api/admin/models',{id:p.id,expectedRevision:p.revision},ordinary)).status,403);
 eq((await call('/api/admin/models',{id:p.id,expectedRevision:p.revision},admin,{headers:{Origin:'https://other.test'}})).status,403);
 eq((await call('/api/admin/models',{id:p.id,expectedRevision:0})).status,409);
 eq((await call('/api/admin/models',{id:p.id,expectedRevision:p.revision,apiKey:fakeKey})).status,400);
 eq((await call('/api/admin/models',{id:p.id,expectedRevision:p.revision})).status,400);
 ok(created.headers.get('Cache-Control').includes('no-store'));
 const cipher=(await db.prepare('SELECT encrypted_key FROM ai_providers WHERE id=?').bind(p.id).first()).encrypted_key;
 ok(cipher&&!cipher.includes(fakeKey));
 async function internalCall(body){const r=await internal.fetch('https://internal.test',{method:'POST',body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 eq((await internalCall({operation:'execution',id:p.id,expectedKey:fakeKey})).data.keyMatches,true);
 const preserved=await call('/api/admin/providers',{...editable(p),name:'Renamed',apiKey:''});eq(preserved.status,200);p=preserved.data.provider;
 eq((await db.prepare('SELECT encrypted_key FROM ai_providers WHERE id=?').bind(p.id).first()).encrypted_key,cipher);
 eq((await call('/api/admin/providers',{...editable(p),expectedRevision:1})).status,409);
 p=(await call('/api/admin/providers',{...editable(p),apiKey:replacement})).data.provider;
 eq((await internalCall({operation:'execution',id:p.id,expectedKey:replacement})).data.keyMatches,true);
 p=(await call('/api/admin/providers',{action:'select-default',id:p.id,expectedRevision:p.revision})).data.provider;eq(p.isDefault,true);
 const other=(await call('/api/admin/providers',{...publicConfig,name:'Second',currency:'CNY'})).data.provider;
 eq((await call('/api/admin/providers',{action:'select-default',id:other.id,expectedRevision:other.revision})).status,200);
 eq((await db.prepare('SELECT COUNT(*) AS n FROM ai_providers WHERE is_default=1').first()).n,1);
 let otherFresh=(await call('/api/admin/providers')).data.providers.find(v=>v.id===other.id);
 otherFresh=(await call('/api/admin/providers',{...editable(otherFresh),enabled:false})).data.provider;eq(otherFresh.isDefault,false);
 eq((await call('/api/admin/providers',{action:'select-default',id:otherFresh.id,expectedRevision:otherFresh.revision})).status,400);
 p=(await call('/api/admin/providers')).data.providers.find(v=>v.id===p.id);
 const billing={id:p.id,name:p.name,model:p.model,currency:p.currency,revision:p.revision,pricing:{inputPriceMicros:2000000,cachedInputPriceMicros:500000,outputPriceMicros:8000000},apiKey:replacement};
 const event={requestId:'upstream-1',task:'writing',status:'success',counts:{inputTokens:1000000,cachedInputTokens:250000,outputTokens:100000},elapsedMs:100};
 const write={operation:'record',user:{id:'ordinary'},provider:billing,event};
 const recorded=await internalCall(write);eq(recorded.status,200);eq(recorded.data.duplicate,false);
 eq((await internalCall(write)).data.duplicate,true);
 eq((await internalCall({...write,user:{id:'other-user'}})).status,400);
 eq((await internalCall({...write,event:{...event,counts:{...event.counts,cachedInputTokens:2000000}}})).status,400);
 const stored=await db.prepare('SELECT * FROM ai_usage_events WHERE request_id=?').bind('upstream-1').first();eq(stored.estimated_cost_micros,'2425000');ok(!JSON.stringify(stored).includes(replacement));
 await db.prepare('UPDATE ai_usage_events SET created_at=? WHERE id=?').bind('2026-10-31T15:59:59.999Z',stored.id).run();
 for(const [requestId,userId,currency,counts,status,stamp] of [
  ['unknown','ordinary','USD',{inputTokens:null,cachedInputTokens:null,outputTokens:null},'error','2026-10-31T00:00:00.000Z'],
  ['other-currency','ordinary','CNY',{inputTokens:0,cachedInputTokens:0,outputTokens:1000000},'success','2026-10-30T16:00:00.000Z'],
  ['outside','ordinary','USD',{inputTokens:0,cachedInputTokens:0,outputTokens:1000000},'success','2026-10-31T16:00:00.000Z'],
 ]){
  const r=await internalCall({...write,user:{id:userId},provider:{...billing,currency},event:{...event,requestId,counts,status}});eq(r.status,200);
  await db.prepare('UPDATE ai_usage_events SET created_at=? WHERE id=?').bind(stamp,r.data.id).run();
 }
 const query='/api/admin/usage?from=2026-10-31&to=2026-10-31';
 let usage=(await call(query)).data;eq(usage.range.timeZone,'Asia/Shanghai');eq(usage.totals.length,2);
 const usd=usage.totals.find(v=>v.currency==='USD'),cny=usage.totals.find(v=>v.currency==='CNY');
 eq(usd.requests,2);eq(usd.totalTokens,1100000);eq(usd.cachedInputTokens,250000);eq(usd.unreportedRequests,1);eq(usd.failedRequests,1);eq(usd.knownCostMicros,'2425000');eq(usd.estimatedCostMicros,null);eq(cny.estimatedCostMicros,'8000000');
 eq(usage.rows.find(v=>v.userId==='admin-a').requests,0);
 eq(usage.rows.find(v=>v.userId==='ordinary'&&v.currency==='USD').email,'ordinary@qa.invalid');
 const events=(await call(query+'&view=events&userId=ordinary&limit=1&page=2')).data;
 eq(events.pagination.total,3);eq(events.pagination.pages,3);eq(events.rows.length,1);ok(!JSON.stringify(events).includes('pricing_snapshot'));
 eq((await call(query+'&q=ordinary%40qa.invalid')).data.totals.find(v=>v.currency==='USD').requests,2);
 eq((await call(query+'&q=%27%20OR%201%3D1%20--')).data.rows.length,0);
 eq((await call(query+'&status=error')).data.totals[0].requests,1);
 eq((await call(query+'&providerId='+other.id)).data.totals.length,0);
 for(const invalid of ['from=2026-02-30','from=2026-11-02&to=2026-11-01','from=2020-01-01&to=2026-01-01','page=0','limit=101'])eq((await call('/api/admin/usage?'+invalid)).status,400);
 p=(await call('/api/admin/providers',{...editable(p),inputPrice:'999',apiKey:''})).data.provider;
 eq((await db.prepare('SELECT estimated_cost_micros FROM ai_usage_events WHERE id=?').bind(stored.id).first()).estimated_cost_micros,'2425000');
 p=(await call('/api/admin/providers',{...editable(p),clearKey:true})).data.provider;eq(p.hasKey,false);
 eq((await db.prepare('SELECT encrypted_key FROM ai_providers WHERE id=?').bind(p.id).first()).encrypted_key,null);
 eq((await internalCall({operation:'execution',id:p.id,expectedKey:replacement})).status,400);
 const audit=await db.prepare('SELECT * FROM admin_audit_events').all();ok(audit.results.length>0);ok(!JSON.stringify(audit.results).includes(replacement));
 eq((await call('/api/ai-grading')).data.enabled,false);
 const notAdmin=await mf.dispatchFetch('https://study.test/api/admin/providers',{method:'POST',headers:{...ordinary,'Content-Type':'application/json'},body:'{malformed'});eq(notAdmin.status,403);
 console.log(`Passed ${checks} admin authorization, encryption, concurrency, ledger and usage-query checks.`);
}finally{await mf.dispose();}
