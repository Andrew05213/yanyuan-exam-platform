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
 const endpoint='/api/exam-imports',fixture='1. Sample?\nA. One B. Two C. Three D. Four\n答案：B';
 const meta={filename:'fixture.txt',source:'Synthetic school · 2026 sample',sourceUrl:'https://example.test/source',rights:'original',confirm:true};
 async function upload(user,m=meta,body=fixture){const r=await mf.dispatchFetch('https://study.test'+endpoint+'?mode=upload',{method:'POST',headers:{'oai-authenticated-user-id':user,'Origin':'https://study.test','X-Exam-Metadata':encodeURIComponent(JSON.stringify(m))},body});return {status:r.status,data:await r.json()};}
 assert.equal((await call(endpoint,null)).status,401);assert.equal((await upload('A',{...meta,source:''})).status,400);assert.equal((await upload('A',{...meta,filename:'fake.pdf'})).status,400);
 const u=await upload('A');assert.equal(u.status,201,JSON.stringify(u.data));const id=u.data.id;assert.equal((await upload('A')).status,409);assert.equal((await upload('B')).status,201);assert.equal((await call(endpoint+'?id='+id,'B')).status,404);
 const original=await mf.dispatchFetch('https://study.test'+endpoint+'?mode=download&id='+id,{headers:{'oai-authenticated-user-id':'A'}});assert.equal(await original.text(),fixture);assert.match(original.headers.get('content-disposition'),/attachment/);assert.match(original.headers.get('cache-control'),/no-store/);
 assert.equal((await call(endpoint+'?mode=catalog','A')).data.items.length,0);
 const q={sourceNumber:1,kind:'mc',stem:'Sample?',options:['One','Two','Three','Four'],answer:'B',analysis:'',tag:'fixture'},group={title:'Fixture',subject:'英语',section:'mc',tier:'tem4',locator:'page 1 question 1',reason:'fixture',text:'',questions:[q]};
 const save={action:'save',id,revision:1,...meta,groups:[group],approved:true,reviewConfirmed:true};
 assert.equal((await call(endpoint,'A',{...save,reviewConfirmed:false})).status,400);
 assert.equal((await call(endpoint,'A',{...save,groups:[{...group,questions:[{...q,answer:''}]}]})).status,400);
 assert.equal((await call(endpoint,'B',save)).status,404);
 const draft=await call(endpoint,'A',{...save,approved:false,groups:[{...group,questions:[{...q,answer:''}]}]});assert.equal(draft.status,200,JSON.stringify(draft.data));assert.equal((await call(endpoint+'?mode=catalog','A')).data.items.length,0);
 const race=await Promise.all([call(endpoint,'A',{...save,revision:2}),call(endpoint,'A',{...save,revision:2})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 const cat=await call(endpoint+'?mode=catalog','A');assert.equal(cat.data.items.length,1);assert.match(cat.data.items[0].source,/Synthetic school.*fixture.txt.*page 1/);assert.equal(cat.data.items[0].questions[0].answer,'B');assert.equal(cat.data.items[0].questions[0].originalNumber,1);assert.equal((await call(endpoint+'?mode=catalog','B')).data.items.length,0);
 const del=await call(endpoint,'A',{action:'delete',id,revision:3});assert.equal(del.status,200);assert.equal((await call(endpoint+'?mode=catalog','A')).data.items.length,0);assert.equal((await mf.dispatchFetch('https://study.test'+endpoint+'?mode=download&id='+id,{headers:{'oai-authenticated-user-id':'A'}})).status,404);
 console.log('PASS: private exam upload, mandatory provenance, actual R2 bytes, duplicate hash, owner isolation, draft/approval, CAS, catalog and deletion.');
}finally{await mf.dispose();await mock.close();}
