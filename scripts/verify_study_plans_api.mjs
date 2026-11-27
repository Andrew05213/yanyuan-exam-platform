import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),{Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve('dist/server'),modules=['index.js',...readdirSync(root,{recursive:true}).filter(f=>/\.m?js$/.test(f)&&f!=='index.js')];
const mf=new Miniflare({modules:modules.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const date=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
async function call(user,b,extra={}){const r=await mf.dispatchFetch('https://study.test/api/study-plans'+(b?'':'?date='+date),{method:b?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}),...(b?{'Content-Type':'application/json'}:{}),...extra},body:b?JSON.stringify({date,...b}):undefined});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};}
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const q of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(q).run();
 for(const user of ['A','B'])await db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at,review_on) VALUES(?,?,?,?,?,?,?)").bind(user,'same_note','Title '+user,'PRIVATE_BODY_'+user,'在读',new Date().toISOString(),date).run();
 assert.equal((await call(null)).status,401);
 const a=await call('A');assert.equal(a.status,200,JSON.stringify(a.body));assert.match(a.cache,/no-store/);assert.equal(a.body.candidates.length,1);assert.equal(a.body.candidates[0].title,'Title A');assert.ok(!JSON.stringify(a.body).includes('PRIVATE_BODY'));assert.ok(!JSON.stringify(a.body).includes('Title B'));const id=a.body.candidates[0].id;
 const body={version:null,budgetMinutes:45,selected:[id],manual:[{id:'manual-fixture',title:'English reading',subject:'英语',track:'通用',minutes:20,priority:1}]};
 assert.equal((await call('A',{action:'preview',...body},{Origin:'https://elsewhere.invalid'})).status,403);
 const preview=await call('A',{action:'preview',...body});assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.plan.tasks.length,2);assert.equal((await call('A')).body.version,null);
 let saved=await call('A',{action:'save',...body});assert.equal(saved.status,200,JSON.stringify(saved.body));let version=saved.body.version;assert.equal((await call('A',{action:'save',...body})).status,409);
 assert.equal((await call('B')).body.version,null);assert.equal((await call('B',{action:'delete',version,confirm:true})).status,409);
 const feedback={action:'feedback',version,taskId:id,status:'done',actualMinutes:12,note:'Reviewed',outcome:'good'};
 const race=await Promise.all([call('A',feedback),call('A',feedback)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);saved=race.find(x=>x.status===200);version=saved.body.version;
 assert.equal(saved.body.plan.tasks[0].review.level,1);assert.equal(saved.body.plan.tasks[0].actualMinutes,12);
 const read=await call('A');assert.equal(read.body.weekStats.done,1);assert.equal(read.body.weekStats.actualMinutes,12);assert.ok(read.body.candidates[0].due>date);
 assert.equal((await call('A',{action:'save',...body,version,budgetMinutes:0})).status,409);
 const extra=await call('A',{action:'extra',version,id:'extra-fixture',title:'Extra',subject:'英语',track:'通用',actualMinutes:null,note:'Recorded'});assert.equal(extra.status,200,JSON.stringify(extra.body));version=extra.body.version;
 const ref=await call('A',{action:'reflection',version,challenge:'Time',judgment:'Focus',next:'Review'});assert.equal(ref.status,200,JSON.stringify(ref.body));version=ref.body.version;
 assert.equal((await call('A')).body.plan.reflection.next,'Review');assert.equal((await call('B')).body.plan.reflection.next,'');
 assert.equal((await call('A',{action:'delete',version,confirm:true})).status,200);
 assert.equal((await call('A')).body.version,null);assert.equal((await db.prepare("SELECT count(*) AS n FROM entries").first()).n,2);
 const rest=await call('A',{action:'save',version:null,budgetMinutes:0,selected:[id],manual:[]});assert.equal(rest.status,200);assert.equal(rest.body.plan.tasks.length,0);
 console.log('PASS: private study planner, real source, preview, budget/rest, revision race, review schedule, weekly stats, extra records, reflection and deletion.');
}finally{await mf.dispose();}
