// Isolated, in-process Worker tests. Never sends test identities to a hosted Site.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve(import.meta.dirname,'..');
const serverRoot=path.join(root,'dist/server');const paths=readdirSync(serverRoot,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js');
const mf=new Miniflare({modules:[{type:'ESModule',path:path.join(serverRoot,'index.js')},...paths.map(f=>({type:'ESModule',path:path.join(serverRoot,f)}))],modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{LEGACY_OWNER_EMAIL:'legacy-owner@qa.invalid',ADMIN_USER_IDS:'admin-qa,admin-qa2'},d1Databases:['DB'],r2Buckets:['BUCKET']});
let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const actor=id=>id?{'oai-authenticated-user-id':id,...(id==='legacy-owner'?{'oai-authenticated-user-email':'legacy-owner@qa.invalid'}:{})}:{};
async function call(route,user,body,extra={}){
 const response=await mf.dispatchFetch('https://study.test'+route,{method:body?'POST':'GET',headers:{...actor(user),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});
 const result=await response.json();return {status:response.status,...result};
}
async function rpc(name,args,user){return call('/mcp',user,{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});}
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const statement of readFileSync(path.join(root,'drizzle',f),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
 for(const route of ['/api/archive','/api/materials','/api/essays/review','/api/attachments']){
  const bad=await mf.dispatchFetch('https://study.test'+route,{method:'POST',headers:{...actor('A'),'Origin':'http://study.test','Content-Type':'application/json'},body:'{}'});check(bad.status,403);
 }
 for(const route of ['/api/archive','/api/materials','/api/essays/review']){
  const oversized=await mf.dispatchFetch('https://study.test'+route,{method:'POST',headers:{...actor('A'),'Content-Type':'application/json'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(600000));c.enqueue(new Uint8Array(600000));c.close();}}),duplex:'half'});check(oversized.status,413);
 }
 const invalidUtf8=await mf.dispatchFetch('https://study.test/api/archive',{method:'POST',headers:{...actor('A'),'Content-Type':'application/json'},body:new Uint8Array([255])});check(invalidUtf8.status,400);
 check((await call('/api/session')).authenticated,false);
 check((await call('/api/session','A')).userId,'A');
 check((await call('/api/session','admin-qa2')).admin,true);
 check((await call('/api/session','B')).admin,false);

 check((await call('/api/learning-report')).status,401);
 check((await call('/api/learning-report','B')).uniqueWrong,0);
 const f={source:'base',sourceId:'math-a',kind:'paper',rating:4,difficulty:'hard',completed:true,comment:'QA feedback'};
 const feedback=await call('/api/feedback','A',f);check(feedback.status,200);
 check((await call('/api/feedback','A')).records.length,1);
 check((await call('/api/feedback','B')).records.length,0);
 check((await call('/api/feedback?admin=1','B')).status,403);
 check((await call('/api/feedback?admin=1','admin-qa2')).records.length,1);
 let fr=(await call('/api/feedback','A')).records[0];
 const handle={action:'handle',id:fr.id,status:'resolved',note:'Checked',expectedUpdatedAt:fr.updatedAt};
 check((await call('/api/feedback','B',handle)).status,403);
 check((await call('/api/feedback','admin-qa2',handle)).status,200);
 check((await call('/api/feedback','admin-qa',handle)).status,409);
 check((await call('/api/feedback','A')).records[0].handledBy,'admin-qa2');
 check((await call('/api/feedback','A',{...f,completed:false})).status,400);
 check((await call('/api/feedback','A',{...f,kind:'question',questionId:1,category:'answer'})).status,200);
 check((await call('/api/feedback','A',{...f,kind:'question',questionId:99999,category:'answer'})).status,400);
 check((await call('/api/feedback','A',{...f,source:'record',sourceId:'not-owned'})).status,404);

 const packet={blocks:[{questions:[{id:1,sourceId:'private-question',stem:'Question',kind:'mc',answer:'A',tag:'QA private tag'}]}],subject:'英语'};
 const record={id:'qa-A',kind:'packet',schoolId:'pku',title:'Private A',payload:packet,expectedRevision:0};
 check((await call('/api/archive','A',record)).status,201);
 const wav=Buffer.from('524946461000000057415645666d7420','hex');
 const response=await mf.dispatchFetch('https://study.test/api/oral-audio',{method:'POST',headers:actor('A'),body:wav});check(response.status,201);const audio=await response.json();
 for(const [who,status] of [['A',200],['B',404],['admin-qa',404],[null,401]])check((await mf.dispatchFetch('https://study.test/api/oral-audio?id='+audio.id,{headers:actor(who)})).status,status);
 const attempt={id:'qa-oral',kind:'oral-attempt',schoolId:'pku',title:'Oral',payload:{answer:'',audioId:audio.id},expectedRevision:0};
 check((await call('/api/archive','B',attempt)).status,400);check((await call('/api/archive','admin-qa',attempt)).status,400);check((await call('/api/archive','A',attempt)).status,201);
 check((await call('/api/archive?id=qa-A','admin-qa')).status,404);
 check((await call('/api/archive','admin-qa')).records.length,0);
 check((await call('/api/study-state','admin-qa')).generatedIds.includes('private-question'),false);
 check((await rpc('get_study_record',{id:'qa-A'},'admin-qa')).result.isError,true);
 for(const suffix of ['', '?id=qa-A','?id=qa-oral&audio='+audio.id])check((await mf.dispatchFetch('https://study.test/api/admin'+suffix,{headers:actor('admin-qa')})).status,404);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1JcAAAAASUVORK5CYII=','base64');
 const ir=await mf.dispatchFetch('https://study.test/api/attachments',{method:'POST',headers:{...actor('A'),'Content-Type':'image/png'},body:png});check(ir.status,201);const image=await ir.json();
 check((await mf.dispatchFetch('https://study.test/api/attachments?id='+image.id,{headers:actor('admin-qa')})).status,404);
 check((await mf.dispatchFetch('https://study.test/api/oral-audio',{method:'POST',headers:actor('A'),body:'not-audio'})).status,415);
 check((await mf.dispatchFetch('https://study.test/api/oral-audio',{method:'POST',headers:actor('A'),body:new ReadableStream({start(c){c.enqueue(new Uint8Array(21*1024*1024));c.close();}}),duplex:'half'})).status,413);
 const audit=await db.prepare('SELECT action FROM admin_access_log').all();check(audit.results.some(r=>r.action==='feedback-list'),true);check(audit.results.some(r=>r.action==='feedback-handle-attempt-resolved'),true);
 const userPage=Array.from({length:505},(_,i)=>db.prepare("INSERT INTO archive_records(id,owner_id,kind,school_id,title,payload,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind('bpage-'+String(i).padStart(3,'0'),'B','packet','pku','My searchable','{}',1,'2030-01-01T00:00:00.000Z','2030-01-01T00:00:00.000Z'));
 await db.batch(userPage);
 const bFirst=await call('/api/archive?q=searchable','B');check(bFirst.records.length,500);check(!!bFirst.next,true);
 const bNext=await call('/api/archive?q=searchable&beforeTime='+encodeURIComponent(bFirst.next.time)+'&beforeId='+encodeURIComponent(bFirst.next.id),'B');check(bNext.records.length,5);check(new Set([...bFirst.records,...bNext.records].map(r=>r.id)).size,505);
 check((await call('/api/archive?q=searchable','A')).records.length,0);
 const sharedPayload=JSON.stringify({schema:1,text:'',source:'QA source',sourceUrl:'',reason:'QA',rights:'original',questions:[],fileIds:[],sharedAt:'2030-01-01T00:00:00.000Z'});
 const sharedRows=Array.from({length:205},(_,i)=>db.prepare("INSERT INTO community_materials(id,owner_id,title,subject,section,tier,payload,author_alias,active,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind('material-00000000-0000-4000-8000-'+String(i).padStart(12,'0'),'A','public '+i,'英语','mc','cet4',sharedPayload,'QA',1,1,'2030-01-01T00:00:00.000Z','2030-01-01T00:00:00.000Z'));
 await db.batch(sharedRows);
 const sharedFirst=await call('/api/materials?catalog=1');check(sharedFirst.materials.length,200);check(!!sharedFirst.next,true);
 const sharedNext=await call('/api/materials?catalog=1&beforeTime='+encodeURIComponent(sharedFirst.next.time)+'&beforeId='+encodeURIComponent(sharedFirst.next.id));
 check(sharedNext.materials.some(r=>r.id==='material-00000000-0000-4000-8000-000000000000'),true);
 check(new Set([...sharedFirst.materials,...sharedNext.materials].map(r=>r.id)).size,sharedFirst.materials.length+sharedNext.materials.length);
 const reportQuestion={id:1,sourceId:'report-private-question',stem:'QA report',answer:'A',tag:'QA private tag',kind:'mc'};
 const reportPacket={subject:'英语',blocks:[{questions:[reportQuestion]}]};
 check((await call('/api/archive','A',{id:'qa-report-errors',kind:'error-set',schoolId:'pku',title:'report errors',expectedRevision:0,payload:{packet:reportPacket,entries:[{qid:1,sourceId:reportQuestion.sourceId,selected:'B',correct:'A',question:reportQuestion}]}})).status,201);
 check((await call('/api/learning-report','A')).tags.some(t=>t.tag==='QA private tag'),true);
 check((await call('/api/learning-report?ownerId=A','B')).tags.some(t=>t.tag==='QA private tag'),false);
 check((await call('/api/feedback','B',{source:'record',sourceId:'qa-A',kind:'paper',rating:5,difficulty:'suitable',completed:true,comment:''})).status,404);
 for(const schoolId of ['whu','sisu','nju','fudan']){
  check((await call('/api/archive','A',{id:'qa-new-'+schoolId,kind:'preset',schoolId,title:'QA school metadata',expectedRevision:0,payload:{name:'QA',config:{}}})).status,201);
  check((await call('/api/archive?schoolId='+schoolId,'A')).records.length,1);
 }
 check((await rpc('get_school_profile',{schoolId:'fudan'},'A')).result.isError,undefined);
 console.log('Passed '+checks+' merged-feature checks: feedback handling, owner-only audio/archive, report privacy, pagination, new schools and bounded requests.');
}finally{await mf.dispose();}

