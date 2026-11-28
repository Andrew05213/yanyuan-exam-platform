// Isolated D1, fake configured provider and synthetic notes; no real model calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {parseResearch,parseExpansion,sourceSelection,makeEvidence} from '../lib/research-assistant-contract.ts';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {Miniflare}=require(wr.resolve('miniflare')),{MockAgent}=require(wr.resolve('undici'));
const root=path.resolve(import.meta.dirname,'..'),server=path.join(root,'dist/server');
const modules=readdirSync(server,{recursive:true}).filter(x=>/\.(m?js)$/.test(x)&&x!=='index.js');
const mock=new MockAgent();mock.disableNetConnect();
const mf=new Miniflare({modules:[{type:'ESModule',path:path.join(server,'index.js')},...modules.map(x=>({type:'ESModule',path:path.join(server,x)}))],modulesRoot:server,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ADMIN_USER_IDS:'admin',AI_CREDENTIALS_ENCRYPTION_KEY:randomBytes(32).toString('base64')},d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock:mock});
const endpoint='/api/literature/research-ai',community='/api/literature/community',network='/api/literature/network',interactions='/api/literature/interactions',secret='qa-provider-secret-only';
async function call(route,user,body,method=body?'POST':'GET',extra={}){
 const response=await mf.dispatchFetch('https://study.test'+route,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}),...(body?{'Content-Type':'application/json','Origin':'https://study.test'}:{}),...extra},body:body?JSON.stringify(body):undefined});
 const text=await response.text();assert.ok(!text.includes(secret));return {status:response.status,data:JSON.parse(text),cache:response.headers.get('cache-control')};
}
const ai=(user,body)=>call(endpoint,user,body);
async function save(user,id,content){const r=await call('/api/literature/entries',user,{id,title:'研究 '+id,content,status:'在读',language:'日语'},'PUT');assert.equal(r.status,200,JSON.stringify(r.data));return r.data.updated_at;}
let requests=0;const inspections=[];
async function decodeBody(raw){
 if(typeof raw==="string")return raw;
 if(raw&&typeof raw.getReader==="function"){
  const reader=raw.getReader(),decoder=new TextDecoder();let text="";
  try{while(true){const {done,value}=await reader.read();if(done)break;text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
  finally{reader.releaseLock();}
 }
 if(Buffer.isBuffer(raw)||ArrayBuffer.isView(raw))return Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength).toString("utf8");
 if(raw instanceof ArrayBuffer)return Buffer.from(raw).toString("utf8");
 throw Error("Unexpected mock body type: "+raw?.constructor?.name);
}
function stub(result,inspect,delay=0,onRequest){
 const response=mock.get('https://api.deepseek.com').intercept({path:'/chat/completions',method:'POST'}).reply(opts=>{
  requests++;if(onRequest)onRequest();
  if(inspect)inspections.push(decodeBody(opts.body).then(text=>{inspect(text);return null;}).catch(e=>e.message));
  return {statusCode:200,data:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:100,prompt_cache_hit_tokens:40,completion_tokens:20}})};
 });if(delay)response.delay(delay);
}
const answer={findings:[{statement:'材料支持一个观点。',evidence:[{source:'S1',quote:'物哀'}]}],limitations:['仅有片段，不能核验全文。'],questions:['如何比较语境？']};
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(path.join(root,'drizzle',f),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const endpoint='/api/deep-research',api=(user,b,q='')=>call(endpoint+q,user,b);
 const note=async(uid,id,content)=>db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at) VALUES(?,?,?,?,?,?)").bind(uid,id,id,content,'在读',new Date().toISOString()).run();
 await note('A','note','物哀 研究 PRIVATE_A');await note('B','note','物哀 PRIVATE_B');await note('A','hidden','PRIVATE_UNSELECTED');
 assert.equal((await api(null)).status,401);
 const create={action:'create',title:'Research',question:'物哀を比較',language:'中文',task:'synthesis',plan:'Compare sources',selection:[]};
 assert.equal((await call(endpoint,'A',create,'POST',{Origin:'https://other.invalid'})).status,403);
 const created=await api('A',create);assert.equal(created.status,200,JSON.stringify(created.data));let {id,version}=created.data;
 assert.equal((await api('B',null,'?id='+id)).status,404);
 const hits=await api('A',null,'?mode=search&term='+encodeURIComponent('物哀'));assert.equal(hits.status,200,JSON.stringify(hits.data));assert.equal(hits.data.hits.length,1);assert.ok(!JSON.stringify(hits.data).includes('PRIVATE_B'));
 const h=hits.data.hits[0],select={action:'select',id,version,selection:[{kind:h.kind,id:h.id,version:h.version}]};
 const selected=await api('A',select);assert.equal(selected.status,200,JSON.stringify(selected.data));version=selected.data.version;
 const provider=(await call('/api/admin/providers','admin',{name:'QA DeepSeek',protocol:'openai-compatible',baseUrl:'https://api.deepseek.com',model:'qa-research',currency:'USD',enabled:true,apiKey:secret,inputPrice:'2',cachedInputPrice:'0.5',outputPrice:'8'})).data.provider;
 assert.equal((await call('/api/admin/providers','admin',{action:'select-default',id:provider.id,expectedRevision:provider.revision})).status,200);
 const pv=await api('A',{action:'preview',id,version});assert.equal(pv.status,200,JSON.stringify(pv.data));assert.equal(requests,0);assert.match(pv.data.sources[0].text,/PRIVATE_A/);
 const analyze={action:'analyze',id,version,nonce:pv.data.nonce,fingerprint:pv.data.fingerprint,confirm:true};
 assert.equal((await api('A',{...analyze,confirm:false})).status,409);assert.equal((await api('A',{...analyze,fingerprint:'bad'})).status,409);
 stub({...answer,findings:[{statement:'bad',evidence:[{source:'S1',quote:'invented'}]}]});assert.equal((await api('A',analyze)).status,502);
 const fresh=await api('A',{action:'preview',id,version});const confirmed={...analyze,nonce:fresh.data.nonce,fingerprint:fresh.data.fingerprint};
 stub(answer,body=>{assert.ok(body.includes('PRIVATE_A'));assert.ok(!body.includes('PRIVATE_B'));assert.ok(!body.includes('PRIVATE_UNSELECTED'));assert.ok(!body.includes('@qa.invalid'));});
 const analyzed=await api('A',confirmed);assert.equal(analyzed.status,200,JSON.stringify(analyzed.data));version=analyzed.data.version;assert.equal((await api('A',confirmed)).status,409);assert.equal(requests,2);
 const detail=await api('A',null,'?id='+id);assert.equal(detail.data.detail.run.analysis.result.findings.length,1);
 const reviewed=await api('A',{action:'review',id,version,reviews:[{index:0,status:'accepted',note:'Checked'}]});assert.equal(reviewed.status,200,JSON.stringify(reviewed.data));version=reviewed.data.version;
 assert.equal((await api('A',null,'?id='+id)).data.detail.run.analysis.reviews[0].status,'accepted');
 await db.prepare("UPDATE entries SET folder='archived' WHERE user_id='A' AND id='note'").run();const gone=await api('A',null,'?id='+id);assert.equal(gone.data.detail.stale,true);assert.equal(gone.data.detail.run.analysis,null);
 assert.equal((await api('A',{action:'preview',id,version})).status,404);
 assert.equal((await api('A',{action:'delete',id,version})).status,200);assert.equal((await api('A',null,'?id='+id)).status,404);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM ai_usage_events WHERE task='research-assistant' AND user_id='A'").first()).n,2);
 assert.deepEqual((await Promise.all(inspections)).filter(Boolean),[]);mock.assertNoPendingInterceptors();
 console.log('PASS: private deep research, source selection, explicit preview, fake provider, exact citations, usage, review and stale source isolation.');
}finally{await mf.dispose();await mock.close();}
