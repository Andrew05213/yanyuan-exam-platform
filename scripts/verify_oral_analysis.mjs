// Isolated Worker, D1, R2 and simulated upstream only; no real recordings or keys.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {Miniflare}=require(wr.resolve('miniflare')),{MockAgent}=require(wr.resolve('undici')),{buildSync}=require(wr.resolve('esbuild'));
const root=path.resolve(import.meta.dirname,'..'),serverRoot=path.join(root,'dist/server'),paths=readdirSync(serverRoot,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js');
const providerId='provider-00000000-0000-4000-8000-000000000001',master=randomBytes(32).toString('base64'),key='fake-oral-analysis-key';
const cryptoCode=buildSync({stdin:{resolveDir:root,contents:"export {encryptProviderKey} from './lib/secret-crypto';"},bundle:true,format:'esm',write:false}).outputFiles[0].text;
const {encryptProviderKey}=await import('data:text/javascript;base64,'+Buffer.from(cryptoCode).toString('base64'));
const agent=new MockAgent();agent.disableNetConnect();
const mf=new Miniflare({modules:[{type:'ESModule',path:path.join(serverRoot,'index.js')},...paths.map(f=>({type:'ESModule',path:path.join(serverRoot,f)}))],modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ORAL_AUDIO_PROVIDER_ID:providerId,AI_CREDENTIALS_ENCRYPTION_KEY:master},d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock:agent});
let checks=0,requests=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function call(route,user,body,extra={}){const r=await mf.dispatchFetch('https://study.test'+route,{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),...(body?{'content-type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});const text=await r.text();assert.ok(!text.includes(key)&&!text.includes(master));return {status:r.status,body:JSON.parse(text)};}
function wave(silent=false){const out=new Uint8Array(44+32000),v=new DataView(out.buffer),put=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));put(0,'RIFF');v.setUint32(4,out.length-8,true);put(8,'WAVE');put(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,32000,true);for(let i=0;i<16000;i++)v.setInt16(44+i*2,silent?0:Math.round(2000*Math.sin(i*.1)),true);return out;}
const feedback={assessable:true,transcript:'A clear response.',summary:'Synthetic fixture feedback',confidence:'medium',pronunciation:'Synthetic pronunciation advice',fluency:'Synthetic rhythm advice',issues:[{startSeconds:.1,endSeconds:.7,heard:'clear',advice:'Practice the stressed syllable'}],practice:['Repeat slowly']};
function mock(result=feedback){agent.get('https://api.openai.com').intercept({method:'POST',path:'/v1/chat/completions',headers:{authorization:'Bearer '+key}}).reply(()=>{requests++;return {statusCode:200,data:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:500,prompt_tokens_details:{cached_tokens:0},completion_tokens:200}})};});}
try{
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');
 for(const file of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(path.join(root,'drizzle',file),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 eq((await call('/api/oral-analysis')).status,401);eq((await call('/api/oral-analysis','A')).body.enabled,false);
 async function provider(id,name,model,url,isDefault){const now=new Date().toISOString();await db.prepare('INSERT INTO ai_providers(id,name,protocol,base_url,model,currency,enabled,is_default,revision,encrypted_key,input_price_micros,cached_input_price_micros,output_price_micros,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,1,?,?,?,?,?,?)').bind(id,name,'openai-compatible',url,model,'USD',isDefault,await encryptProviderKey(key,id,master),2000000,500000,8000000,now,now).run();}
 await provider(providerId,'Audio fixture','qa-audio-model','https://api.openai.com/v1',0);
 await provider('provider-00000000-0000-4000-8000-000000000002','Text default','must-not-be-used','https://api.deepseek.com',1);
 const config=(await call('/api/oral-analysis','A')).body;eq(config.enabled,true);eq(config.model,'qa-audio-model');
 async function audio(suffix,silent=false){const id='oral-audio-00000000-0000-4000-8000-'+suffix.padStart(12,'0'),bytes=wave(silent),objectKey='fixture/'+id;await bucket.put(objectKey,bytes);await db.prepare('INSERT INTO oral_audio(id,owner_id,object_key,mime,size,created_at) VALUES(?,?,?,?,?,?)').bind(id,'A',objectKey,'audio/wav',bytes.length,new Date().toISOString()).run();return id;}
 const a=await audio('1'),b=await audio('2'),silent=await audio('3',true),payload={answer:'Notes',audioId:a,item:{prompt:'Describe the idea',language:'English'}};
 const record={id:'qa-oral-analysis',kind:'oral-attempt',schoolId:'pku',title:'Isolated audio fixture',expectedRevision:0,payload};eq((await call('/api/archive','A',record)).status,201);
 const body={recordId:record.id,expectedRevision:1,requestId:'qa-audio-request-0001',consent:true,consentToken:config.consentToken};
 eq((await call('/api/oral-analysis',null,body)).status,401);eq((await call('/api/oral-analysis','B',body)).status,404);
 eq((await call('/api/oral-analysis','A',{...body,consent:false})).status,400);eq((await call('/api/oral-analysis','A',{...body,consentToken:'old-provider'})).status,409);
 eq((await call('/api/oral-analysis','A',body,{Origin:'https://other.test'})).status,403);eq((await call('/api/oral-analysis','A',{...body,providerId})).status,400);eq(requests,0);
 mock();const result=await call('/api/oral-analysis','A',body);eq(result.status,200);assert.equal(result.body.status,'succeeded',JSON.stringify(result.body));eq(result.body.current,true);eq(result.body.result.audioId,a);eq(result.body.result.provider.model,'qa-audio-model');eq(result.body.result.metrics.durationSeconds,1);eq(result.body.result.metrics.wordCount,3);eq(requests,1);
 const ledger=await db.prepare('SELECT * FROM ai_usage_events WHERE request_id=?').bind(result.body.jobId).first();eq(ledger.user_id,'A');eq(ledger.task,'oral-audio');eq(ledger.status,'success');eq(ledger.input_tokens,500);eq(ledger.cached_input_tokens,0);eq(ledger.output_tokens,200);eq(ledger.estimated_cost_micros,null);eq(JSON.parse(ledger.pricing_snapshot).inputPriceMicros,null);
 eq((await call('/api/oral-analysis','A',body)).body.status,'succeeded');eq(requests,1);eq((await db.prepare('SELECT count(*) AS n FROM ai_usage_events').first()).n,1);
 eq((await call('/api/oral-analysis?jobId='+result.body.jobId,'B')).status,404);eq((await call('/api/oral-analysis?recordId='+record.id,'A')).body.current,true);
 eq((await call('/api/archive','A',{...record,expectedRevision:1,payload:{...payload,audioId:b}})).status,200);eq((await call('/api/oral-analysis?jobId='+result.body.jobId,'A')).body.current,false);eq((await call('/api/oral-analysis?recordId='+record.id,'A')).body.status,'none');
 mock({...feedback,issues:[{...feedback.issues[0],endSeconds:99}]});const failed=await call('/api/oral-analysis','A',{...body,expectedRevision:2,requestId:'qa-audio-invalid-0001'});eq(failed.body.status,'failed');const error=await db.prepare('SELECT status,input_tokens FROM ai_usage_events WHERE request_id=?').bind(failed.body.jobId).first();eq(error.status,'error');eq(error.input_tokens,500);
 eq((await call('/api/archive','A',{...record,expectedRevision:2,payload:{...payload,audioId:silent}})).status,200);eq((await call('/api/oral-analysis','A',{...body,expectedRevision:3,requestId:'qa-audio-silent-0001'})).status,422);eq(requests,2);eq((await db.prepare('SELECT count(*) AS n FROM ai_usage_events').first()).n,2);
 agent.assertNoPendingInterceptors();console.log('Passed '+checks+' oral audio API checks: dedicated Provider, owner isolation, consent/config binding, PCM metrics, idempotency, real usage fields, unknown audio prices, stale source and invalid feedback.');
}finally{await mf.dispose();await agent.close();}
