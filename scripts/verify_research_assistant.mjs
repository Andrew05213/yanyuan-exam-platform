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
let requests=0;const inspectionErrors=[];
function stub(result,inspect){
 mock.get('https://api.deepseek.com').intercept({path:'/chat/completions',method:'POST'}).reply(opts=>{
  requests++;if(inspect){try{const raw=opts.body;const text=typeof raw==="string"?raw:Buffer.isBuffer(raw)||ArrayBuffer.isView(raw)?Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength).toString("utf8"):raw instanceof ArrayBuffer?Buffer.from(raw).toString("utf8"):Array.isArray(raw)?Buffer.from(raw).toString("utf8"):raw?.type==="Buffer"&&Array.isArray(raw.data)?Buffer.from(raw.data).toString("utf8"):JSON.stringify(raw);inspect(text);}catch(e){inspectionErrors.push({message:e.message,bodyType:typeof opts.body,bodyClass:opts.body?.constructor?.name,bodyKeys:opts.body&&typeof opts.body==="object"?Object.keys(opts.body).slice(0,8):[]});}}
  return {statusCode:200,data:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:100,prompt_cache_hit_tokens:40,completion_tokens:20}})};
 });
}
const answer={findings:[{statement:'材料支持一个观点。',evidence:[{source:'S1',quote:'物哀'}]}],limitations:['仅有片段，不能核验全文。'],questions:['如何比较语境？']};
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(path.join(root,'drizzle',f),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const version=await save('A','note_shared','物哀 mono no aware もののあはれ');
 await save('A','note_hidden','PRIVATE_A 物哀');
 const vb=await save('B','note_shared','PRIVATE_B 物哀');
 const t=(await call(community,'A',{action:'createTopic',title:'QA'})).data.id;
 const pub=await call(community,'A',{action:'publish',topicId:t,entryId:'note_shared',sourceUpdatedAt:version,confirm:true});assert.equal(pub.status,200);
 const reference=await call(network,'A',{action:'addReference',topicId:t,title:'物哀 bibliography',authors:'QA'});assert.equal(reference.status,201);
 const p=pub.data.id;
 assert.equal((await ai(null,{action:'search',scope:'public',terms:['物哀']})).status,401);
 const publicHits=await ai('B',{action:'search',scope:'public',topicId:t,terms:['もののあはれ','物哀']});assert.equal(publicHits.status,200,JSON.stringify(publicHits.data));assert.equal(publicHits.data.hits.length,2);assert.ok(!JSON.stringify(publicHits.data).includes('PRIVATE_'));assert.match(publicHits.cache,/no-store/);
 const privateHits=await ai('B',{action:'search',scope:'private',terms:['物哀']});assert.equal(privateHits.data.hits.length,1);assert.match(privateHits.data.hits[0].excerpt,/PRIVATE_B/);assert.ok(!JSON.stringify(privateHits.data).includes('PRIVATE_A'));
 const base={scope:'public',topicId:t,task:'synthesis',question:'比较证据',language:'中文',sources:[{kind:'publication',id:p,version:'1'}]};
 assert.equal((await ai('B',{action:'preview',...base,sources:[{kind:'private',id:'note_hidden',version}]})).status,400);
 const privateBase={...base,scope:'private',sources:[{kind:'private',id:'note_shared',version:vb}]};
 assert.equal((await ai('B',{action:'preview',...privateBase,sources:[{kind:'private',id:'note_hidden',version}]})).status,404);
 assert.equal(requests,0);
 const provider=(await call('/api/admin/providers','admin',{name:'QA DeepSeek',protocol:'openai-compatible',baseUrl:'https://api.deepseek.com',model:'qa-research',currency:'USD',enabled:true,apiKey:secret,inputPrice:'2',cachedInputPrice:'0.5',outputPrice:'8'})).data.provider;
 assert.equal((await call('/api/admin/providers','admin',{action:'select-default',id:provider.id,expectedRevision:provider.revision})).status,200);
 const preview=await ai('B',{action:'preview',...base});assert.equal(preview.status,200,JSON.stringify(preview.data));assert.equal(preview.data.destination.host,'api.deepseek.com');assert.equal(requests,0);
 const f=preview.data.fingerprint;
 assert.equal((await ai('B',{action:'analyze',...base,fingerprint:f})).status,409);
 assert.equal((await ai('C',{action:'analyze',...base,fingerprint:f,confirm:true})).status,409);
 assert.equal((await ai('B',{action:'analyze',...base,question:'different',fingerprint:f,confirm:true})).status,409);
 stub(answer,body=>{assert.ok(body.includes('物哀'));assert.ok(!body.includes('PRIVATE_'));assert.ok(!body.includes('@qa.invalid'));});
 const analyzed=await ai('B',{action:'analyze',...base,fingerprint:f,confirm:true});assert.equal(analyzed.status,200,JSON.stringify(analyzed.data));assert.equal(analyzed.data.reviewStatus,'unverified');
 const privatePreview=await ai('B',{action:'preview',...privateBase});assert.equal(privatePreview.status,200);assert.match(privatePreview.data.sources[0].text,/PRIVATE_B/);
 stub(answer,body=>{assert.ok(body.includes('PRIVATE_B'));assert.ok(!body.includes('PRIVATE_A'));});
 assert.equal((await ai('B',{action:'analyze',...privateBase,fingerprint:privatePreview.data.fingerprint,confirm:true})).status,200);
 assert.equal((await ai('B',{action:'expand',query:'物哀',languages:'日语、英语'})).status,400);
 stub({terms:['もののあはれ','mono no aware']},body=>assert.ok(!body.includes('PRIVATE_')));
 assert.equal((await ai('B',{action:'expand',query:'物哀',languages:'日语、英语',confirm:true})).data.terms.length,3);
 stub({...answer,findings:[{statement:'bad',evidence:[{source:'S1',quote:'invented'}]}]});
 assert.equal((await ai('B',{action:'analyze',...base,fingerprint:f,confirm:true})).status,502);
 assert.equal((await call(interactions,'B',{action:'block',targetKind:'publication',targetId:p})).status,201);
 assert.equal((await ai('B',{action:'analyze',...base,fingerprint:f,confirm:true})).status,404);
 assert.equal((await ai('B',{action:'search',scope:'public',terms:['物哀']})).data.hits.length,0);
 assert.equal((await call(community,'A',{action:'withdraw',id:p})).status,200);
 assert.equal((await ai('C',{action:'preview',...base})).status,404);
 const rows=(await db.prepare("SELECT task,status,pricing_snapshot FROM ai_usage_events WHERE task='research-assistant'").all()).results;assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.status==='error').length,1);assert.ok(!JSON.stringify(rows).includes('PRIVATE_'));
 const evidence=[makeEvidence('S1','publication','t','物哀', '1')];assert.equal(parseResearch(JSON.stringify(answer),evidence).findings.length,1);
 assert.throws(()=>parseResearch(JSON.stringify({...answer,findings:[{statement:'x',evidence:[{source:'S2',quote:'物哀'}]}]}),evidence));
 assert.throws(()=>sourceSelection([{kind:'publication',id:p,version:'1'}],'private'));
 assert.deepEqual(parseExpansion('{"terms":["物哀","mono no aware"]}'),['物哀','mono no aware']);
 assert.equal(requests,4);assert.deepEqual(inspectionErrors,[], 'Mock provider request privacy assertions');mock.assertNoPendingInterceptors();
 console.log('PASS: local multilingual search, private owner scope, public visibility, explicit exact preview, model reuse, quote verification, keyword expansion and metered isolated calls.');
}finally{await mf.dispose();await mock.close();}
