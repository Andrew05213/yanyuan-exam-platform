// Isolated D1 and synthetic identities; no production access.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),{Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve(import.meta.dirname,'..'),serverRoot=path.join(root,'dist/server');
const modules=readdirSync(serverRoot,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js');
const mf=new Miniflare({modules:[{type:'ESModule',path:path.join(serverRoot,'index.js')},...modules.map(f=>({type:'ESModule',path:path.join(serverRoot,f)}))],modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ADMIN_USER_IDS:'qa-admin'},d1Databases:['DB'],r2Buckets:['BUCKET']});
const c='/api/literature/community',n='/api/literature/network',i='/api/literature/interactions',a='qa-A',b='qa-B',u='qa-C',admin='qa-admin';
async function call(route,user,body,method=body?'POST':'GET',extra={}){
 const r=await mf.dispatchFetch('https://study.test'+route,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};
}
async function save(user,content){const r=await call('/api/literature/entries',user,{id:'note_qa',title:'Independent '+content,content,status:'在读'},'PUT');assert.equal(r.status,200,JSON.stringify(r.data));return r.data.updated_at;}
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(path.join(root,'drizzle',f),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const uid of [a,b,u])await db.prepare("INSERT INTO research_memberships(user_id,id,role,state,change_id,created_at,updated_at) VALUES(?,?,'member','active',?,?,?)").bind(uid,'fixture-'+uid,'fixture-'+uid,new Date().toISOString(),new Date().toISOString()).run();
 const topic=(await call(c,a,{action:'createTopic',title:'QA topic'})).data.id;
 const publish=(user,v,tid=topic)=>call(c,user,{action:'publish',topicId:tid,entryId:'note_qa',sourceUpdatedAt:v,confirm:true});
 const va=await save(a,'A evidence'),vb=await save(b,'B response');
 const pa=await publish(a,va),pb=await publish(b,vb);assert.equal(pa.status,200);assert.equal(pb.status,200);
 const aid=pa.data.id,bid=pb.data.id;
 const link={action:'link',sourceId:bid,targetId:aid,sourceRevision:1,targetRevision:1,kind:'derivative'};
 assert.equal((await call(n,null,link)).status,401);
 assert.equal((await call(n,a,link)).status,409);
 assert.equal((await call(n,b,link,'POST',{Origin:'https://other.test'})).status,403);
 const added=await call(n,b,link);assert.equal(added.status,201,JSON.stringify(added.data));
 assert.equal((await call(n,b,link)).status,409);
 const outgoing=await call(n+'?publication='+bid,b),incoming=await call(n+'?publication='+aid,u);
 assert.equal(outgoing.data.links[0].direction,'outgoing');assert.equal(incoming.data.links[0].direction,'incoming');assert.equal(incoming.data.links[0].ownerId,undefined);
 assert.equal((await call(n,u,{action:'unlink',id:added.data.id})).status,404);
 const compare=n+'?topic='+topic+'&compare='+aid+','+bid;
 const compared=await call(compare,u);assert.equal(compared.status,200);assert.deepEqual(compared.data.notes.map(x=>x.content),['A evidence','B response']);assert.equal(compared.data.notes[0].ownerId,undefined);
 assert.equal((await call(n+'?topic='+topic+'&compare='+aid+','+aid,u)).status,400);
 const t2=(await call(c,a,{action:'createTopic',title:'Other topic'})).data.id;
 const other=await publish(a,va,t2);assert.equal(other.status,200);
 assert.equal((await call(n,b,{...link,targetId:other.data.id})).status,409);
 assert.equal((await call(n+'?topic='+topic+'&compare='+aid+','+other.data.id,u)).status,404);
 await new Promise(r=>setTimeout(r,5));const va2=await save(a,'Updated evidence');assert.equal((await publish(a,va2)).status,200);
 assert.equal((await call(n+'?publication='+bid,b)).data.links[0].stale,true);
 assert.equal((await call(n,b,{...link,kind:'citation'})).status,409);
 const fresh=await call(n,b,{...link,targetRevision:2,kind:'citation'});assert.equal(fresh.status,201);
 const ref=await call(n,b,{action:'addReference',topicId:topic,title:'QA bibliography',authors:'Research author',year:'2026',identifier:'ISBN example'});assert.equal(ref.status,201,JSON.stringify(ref.data));
 const refs=n+'?topic='+topic+'&q=QA';assert.equal((await call(refs,u)).data.references.length,1);assert.equal((await call(refs,u)).data.references[0].ownerId,undefined);
 assert.equal((await call(n,u,{action:'removeReference',id:ref.data.id})).status,404);
 assert.equal((await call(i,u,{action:'report',targetKind:'reference',targetId:ref.data.id,revision:0,category:'spam'})).status,201);
 const reports=await call(i+'?admin=1',admin);const report=reports.data.reports.find(r=>r.targetKind==='reference');
 assert.equal((await call(i,admin,{action:'moderate',id:report.id,decision:'hide'})).status,200);
 assert.equal((await call(refs,u)).data.references.length,0);
 assert.equal((await call(i,admin,{action:'moderate',id:report.id,decision:'restore'})).status,200);
 assert.equal((await call(refs,u)).data.references.length,1);
 assert.equal((await call(i,u,{action:'block',targetKind:'reference',targetId:ref.data.id})).status,201);
 assert.equal((await call(refs,u)).data.references.length,0);
 assert.equal((await call(compare,u)).status,404);
 assert.equal((await call(n+'?publication='+aid,u)).data.links.length,0);
 assert.equal((await call(c,a,{action:'withdraw',id:aid})).status,200);
 assert.equal((await call(n+'?publication='+bid,b)).data.links.length,0);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM research_links WHERE target_id=?').bind(aid).first()).n,0);
 assert.equal((await call(n,b,{action:'removeReference',id:ref.data.id})).status,200);
 assert.equal((await call('/api/literature/entries',b)).data[0].content,'B response');
 console.log('PASS: versioned bidirectional citation links, explicit derived relationships, same-topic comparison, bibliography reporting and visibility, owner checks and withdrawal cascade.');
}finally{await mf.dispose();}
