import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';

const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve(import.meta.dirname,'..'),server=path.join(root,'dist/server');
const modules=['index.js',...readdirSync(server,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js')];
const mf=new Miniflare({
  modules:modules.map(f=>({type:'ESModule',path:path.join(server,f)})),
  modulesRoot:server,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_USER_IDS:'admin'},
});
async function call(actor,query='',body,origin='https://study.test'){
  const headers={...(actor?{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@qa.invalid'}:{}),
    ...(body?{'Content-Type':'application/json','Origin':origin}:{})};
  const response=await mf.dispatchFetch('https://study.test/api/research-projects'+query,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json(),cache:response.headers.get('cache-control')};
}
try{
  const db=await mf.getD1Database('DB'),stamp=new Date().toISOString(),codes={A:crypto.randomUUID(),B:crypto.randomUUID()};
  for(const file of readdirSync(path.join(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort()){
    for(const sql of readFileSync(path.join(root,'drizzle',file),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  }
  for(const actor of ['A','B']){
    await db.prepare("INSERT INTO research_memberships(user_id,id,role,state,change_id,created_at,updated_at) VALUES(?,?,'member','active',?,?,?)").bind(actor,codes[actor],crypto.randomUUID(),stamp,stamp).run();
    await db.prepare("INSERT INTO entries(user_id,id,title,content,updated_at) VALUES(?,?,?,?,?)").bind(actor,'note_'+actor,'私人标题 '+actor,'PRIVATE_BODY_'+actor,stamp).run();
  }
  assert.equal((await call(null)).status,401);
  assert.equal((await call('A','',{action:'create',title:'Project'},'https://elsewhere.invalid')).status,403);
  const {data:{id},status}=await call('A','',{action:'create',title:'Project',question:'Private question'});
  assert.equal(status,201);
  const get=actor=>call(actor,'?id='+id);
  const act=(actor,revision,action,extra={})=>call(actor,'',{id,revision,action,...extra});
  assert.equal((await get('admin')).status,404);
  assert.equal((await get('B')).status,404);
  assert.equal((await call('A','?q=Project')).data.projects.length,1);
  assert.equal((await call('A','?q=Absent')).data.projects.length,0);
  assert.equal((await call('B','?q=Project')).data.projects.length,0);
  assert.match((await get('A')).cache,/no-store/);
  assert.equal((await act('A',1,'link',{noteId:'note_B'})).status,404);
  assert.equal((await act('A',1,'link',{noteId:'note_A'})).status,200);
  await db.prepare("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<300)"+
    " INSERT INTO entries(user_id,id,title,content,updated_at) SELECT 'A','newer_'||x,'Later title','','2099-01-01' FROM n").run();
  const picker=await get('A');
  assert.equal(picker.data.notes.some(n=>n.id==='note_A'),false);
  assert.equal(picker.data.project.links[0].id,'note_A');
  assert.equal(picker.data.nextNoteOffset,50);
  assert.equal((await call('A','?id='+id+'&noteOffset=300')).data.notes[0].id,'note_A');
  assert.equal((await call('A','?id='+id+'&noteQuery='+encodeURIComponent('私人标题 A'))).data.notes[0].id,'note_A');
  await db.prepare("UPDATE entries SET folder='archived' WHERE user_id='A' AND id='note_A'").run();
  assert.equal((await get('A')).data.project.links[0].folder,'archived');
  assert.equal((await act('A',2,'invite',{code:codes.B})).status,200);
  const pending=await get('B');
  assert.equal(pending.data.project.role,'invited');
  assert.equal(pending.data.project.question,undefined);
  assert.equal((await act('B',3,'respond',{accept:true})).status,200);
  const shared=await get('B');
  assert.equal(shared.data.project.question,'Private question');
  assert.equal(shared.data.project.members,undefined);
  assert.deepEqual(shared.data.project.links,[]);
  assert.ok(!JSON.stringify(shared.data).includes('私人标题 A'));
  assert.ok(!JSON.stringify(shared.data).includes('PRIVATE_BODY_'));
  assert.equal((await act('B',4,'milestone-add',{title:'Forbidden'})).status,404);
  assert.equal((await act('B',4,'link',{noteId:'note_B'})).status,200);
  await db.prepare("UPDATE research_memberships SET state='suspended' WHERE user_id='B'").run();
  assert.equal((await get('B')).status,404);
  assert.deepEqual((await call('B')).data.projects,[]);
  await db.prepare("UPDATE research_memberships SET state='active' WHERE user_id='B'").run();
  const owner=await get('A'),memberId=owner.data.project.members[0].id;
  assert.ok(!('userId' in owner.data.project.members[0]));
  assert.equal((await act('A',5,'revoke',{memberId})).status,200);
  assert.equal((await get('B')).status,404);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM entries WHERE id='note_B'").first()).n,1);
  const race=await Promise.all(['一','二'].map(title=>act('A',6,'milestone-add',{title})));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  assert.equal((await act('A',7,'archive')).status,200);
  assert.equal((await act('A',8,'restore')).status,200);
  assert.equal((await act('A',9,'unlink',{noteId:'note_A'})).status,200);
  assert.deepEqual((await get('A')).data.project.links,[]);
  assert.equal((await act('A',10,'delete',{confirm:true})).status,200);
  assert.equal((await get('A')).status,404);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM entries').first()).n,302);
  console.log('PASS: private project access, consent, community suspension, owner-only controls, note isolation, revocation, concurrency, archive and deletion.');
}finally{await mf.dispose();}
