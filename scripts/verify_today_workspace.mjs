// Test owner-scoped summary and static page contract without production access.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve(import.meta.dirname,'..'),serverRoot=path.join(root,'dist/server');
const read=p=>readFileSync(path.join(root,p),'utf8');
const modules=readdirSync(serverRoot,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js');
const mf=new Miniflare({modules:[{type:'ESModule',path:path.join(serverRoot,'index.js')},...modules.map(f=>({type:'ESModule',path:path.join(serverRoot,f)}))],modulesRoot:serverRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
async function call(user){const r=await mf.dispatchFetch('https://study.test/api/today',{headers:user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};}
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of read('drizzle/'+f).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),now=new Date().toISOString();
 for(const user of ['A','B']){
  await db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at,review_on) VALUES(?,?,?,?,?,?,?)").bind(user,'same_note','Title '+user,'PRIVATE_BODY_'+user,'在读',now,today).run();
  await db.prepare("INSERT INTO archive_records(id,owner_id,kind,school_id,title,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind('error-'+user,user,'error-set','pku','Archive '+user,JSON.stringify({secret:'PRIVATE_PAYLOAD_'+user}),now,now).run();
 }
 for(const folder of ['archived','trash']){
  await db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at,review_on,folder) VALUES(?,?,?,?,?,?,?,?)")
   .bind('A',folder,'Inactive '+folder,'Do not summarize','在读',now,today,folder).run();
 }
 assert.equal((await call(null)).status,401);
 const a=await call('A');assert.equal(a.status,200,JSON.stringify(a.body));assert.match(a.cache,/no-store/);
 assert.equal(a.body.today,today);assert.equal(a.body.dueCount,1);assert.equal(a.body.errorSets,1);assert.equal(a.body.notesUpdatedToday,1);assert.equal(a.body.recordsUpdatedToday,1);
 assert.equal(a.body.due[0].title,'Title A');assert.equal(a.body.recentRecords[0].title,'Archive A');
 assert.deepEqual(a.body.recentNotes.map(note=>note.title),['Title A']);
 assert.ok(!JSON.stringify(a.body).includes('PRIVATE_'));assert.ok(!JSON.stringify(a.body).includes('Title B'));assert.ok(!JSON.stringify(a.body).includes('Archive B'));
 const b=await call('B');assert.equal(b.body.due[0].title,'Title B');
 const empty=await call('C');assert.equal(empty.body.dueCount,0);assert.deepEqual(empty.body.recentNotes,[]);
 const html=read('public/index.html'),app=read('public/app.js'),study=read('app/literature/study.tsx'),gateway=read('lan/gateway.mjs');
 assert.match(html,/data-view="today"/);assert.match(html,/today\.js\?v=1/);assert.match(html,/href="\/reading-notes"/);
 assert.match(app,/view==='today'/);assert.ok(study.includes('location.replace("/reading-notes"'));assert.match(gateway,/'\/api\/today'/);
 const ctx=vm.createContext({escapeHTML:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),encodeURIComponent});
 vm.runInContext(read('public/today.js'),ctx);ctx.fixture={...a.body,due:[{id:'note_test',title:'<script>bad</script>',reviewOn:today}]};
 const rendered=vm.runInContext('Today.summary(fixture)',ctx);assert.ok(rendered.includes('&lt;script&gt;'));assert.ok(!rendered.includes('<script>'));assert.ok(rendered.includes('/reading-notes#note/note_test'));
 console.log('PASS: today summary ownership, calendar and counts, metadata-only response, escaped UI, navigation and gateway route.');
}finally{await mf.dispose();}
