// Isolated Worker + D1: no deployed accounts or real user data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve(import.meta.dirname,'..'),serverRoot=path.join(root,'dist/server');
const modules=readdirSync(serverRoot,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js');
const mf=new Miniflare({modules:[{type:'ESModule',path:path.join(serverRoot,'index.js')},...modules.map(f=>({type:'ESModule',path:path.join(serverRoot,f)}))],modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const endpoint='/api/literature/community';
async function call(route,user,method='GET',body,extra={}){
 const response=await mf.dispatchFetch('https://study.test'+route,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json(),cache:response.headers.get('cache-control')};
}
const post=(user,body,extra)=>call(endpoint,user,'POST',body,extra);
const get=(user,query='')=>call(endpoint+query,user);
const note=(content)=>({id:'note_shared_id',title:'Independent research',content,status:'在读',language:'中文',sourceLanguage:'日本語',discipline:'哲学',reviewOn:'2027-01-01',locator:'PRIVATE_LOCATOR'});
async function save(user,content){const r=await call('/api/literature/entries',user,'PUT',note(content));assert.equal(r.status,200,JSON.stringify(r.data));return r.data.updated_at;}
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort()){
  for(const statement of readFileSync(path.join(root,'drizzle',f),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
 }
 const a='qa-owner-A',b='qa-owner-B',c='qa-owner-C';
 const va=await save(a,'Original A');const vb=await save(b,'Independent B');
 assert.equal((await get(null)).status,401);
 assert.equal((await post(null,{action:'createTopic',title:'x'})).status,401);
 assert.equal((await post(a,{action:'createTopic',title:'x'},{Origin:'https://elsewhere.test'})).status,403);
 assert.equal((await post(a,{action:'createTopic',title:' '})).status,400);
 const topic=await post(a,{action:'createTopic',title:'Shared question',description:'Multiple independent perspectives'});assert.equal(topic.status,201);
 const t=topic.data.id,topicQuery='?topic='+t;
 assert.equal((await get(b,topicQuery)).data.publications.length,0);
 assert.equal((await post(a,{action:'publish',topicId:t,entryId:'note_shared_id',sourceUpdatedAt:va})).status,400);
 const publish=(user,version,topicId=t,extra={})=>post(user,{action:'publish',topicId,entryId:'note_shared_id',sourceUpdatedAt:version,confirm:true,...extra});
 assert.equal((await publish(c,va,t,{ownerId:a})).status,404);
 const pa=await publish(a,va);assert.equal(pa.status,200,JSON.stringify(pa.data));const aid=pa.data.id;
 const pb=await publish(b,vb);assert.equal(pb.status,200);assert.notEqual(pb.data.id,aid);
 const list=await get(c,topicQuery);assert.equal(list.status,200);assert.equal(list.data.publications.length,2);
 assert.match(list.cache,/no-store/);const serialized=JSON.stringify(list.data);
 for(const secret of [a,b,'@qa.invalid','note_shared_id','PRIVATE_LOCATOR','2027-01-01'])assert.ok(!serialized.includes(secret),secret);
 const detail=await get(b,'?publication='+aid);assert.equal(detail.data.content,'Original A');assert.equal(detail.data.mine,false);assert.equal(detail.data.entryId,undefined);
 assert.equal((await get(null,'?publication='+aid)).status,401);
 const privateB=await call('/api/literature/entries',b);assert.equal(privateB.data.length,1);assert.equal(privateB.data[0].content,'Independent B');
 await new Promise(r=>setTimeout(r,5));const va2=await save(a,'Changed privately');
 assert.equal((await get(b,'?publication='+aid)).data.content,'Original A');
 assert.equal((await publish(a,va)).status,409);
 assert.equal((await post(b,{action:'withdraw',id:aid,ownerId:a})).status,404);
 const updated=await publish(a,va2);assert.equal(updated.data.id,aid);assert.equal(updated.data.revision,2);
 assert.equal((await get(b,'?publication='+aid)).data.content,'Changed privately');
 const t2=(await post(a,{action:'createTopic',title:'Another question'})).data.id;
 const second=await publish(a,va2,t2);assert.equal(second.status,200);assert.notEqual(second.data.id,aid);
 assert.equal((await get(b,'?q=Shared')).data.topics.length,1);
 assert.equal((await get(b,'?q=nonexistent')).data.topics.length,0);
 assert.equal((await get(b,'?offset=-1')).status,400);
 assert.equal((await post(a,{action:'withdraw',id:aid})).status,200);
 assert.equal((await get(b,'?publication='+aid)).status,404);
 assert.equal((await get(b,topicQuery)).data.publications.length,1);
 assert.equal((await get(b,'?publication='+second.data.id)).data.content,'Changed privately');
 const stillPrivate=await call('/api/literature/entries',a);assert.equal(stillPrivate.data[0].content,'Changed privately');
 assert.equal((await publish(a,va2)).status,200);
 console.log('PASS: signed-in topic access, ownership, explicit version consent, independent notes, multi-topic publication, snapshot privacy, withdrawal, metadata minimization, CSRF and private data preservation.');
}finally{await mf.dispose();}
