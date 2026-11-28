import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),{Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve('dist/server'),modules=['index.js',...readdirSync(root,{recursive:true}).filter(f=>/\.m?js$/.test(f)&&f!=='index.js')];
const mf=new Miniflare({modules:modules.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const date=new Date(Date.now()+8*3600000).toISOString().slice(0,10),next=new Date(Date.parse(date+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);
async function call(user,b,extra={}){const r=await mf.dispatchFetch('https://study.test/api/study-plans'+(b?'':'?date='+next),{method:b?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}),...(b?{'Content-Type':'application/json'}:{}),...extra},body:b?JSON.stringify({date:next,...b}):undefined});return {status:r.status,body:await r.json()};}
try{
 const db=await mf.getD1Database('DB');const migrations=readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();const apply=async f=>{for(const q of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(q).run();};
 for(const f of migrations.filter(f=>!f.startsWith('0022_')))await apply(f);
 const old={date,tasks:[{id:'migration-fixture',kind:'note-review',sourceId:'old',review:{outcome:'good',level:1,due:next,at:new Date().toISOString()}}]};
 await db.prepare("INSERT INTO study_day_plans(user_id,day,version,payload,updated_at) VALUES(?,?,?,?,?)").bind('migration-user',date,'old',JSON.stringify(old),new Date().toISOString()).run();
 for(const f of migrations.filter(f=>f.startsWith('0022_')))await apply(f);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM study_review_events WHERE user_id='migration-user'").first()).n,1);
 await db.prepare("DELETE FROM study_day_plans WHERE user_id='migration-user'").run();
 for(const user of ['A','B'])await db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at,review_on) VALUES(?,?,?,?,?,?,?)").bind(user,'same_note','Title '+user,'PRIVATE_'+user,'在读',new Date().toISOString(),date).run();
 assert.equal((await call(null)).status,401);
 const initial=await call('A');assert.equal(initial.status,200,JSON.stringify(initial.body));assert.equal(initial.body.preferencesVersion,null);
 const noteId=initial.body.candidates[0].id;
 const moved=await call('A',{action:'reschedule',date,taskId:noteId,due:next,rescheduleVersion:null});assert.equal(moved.status,200,JSON.stringify(moved.body));
 assert.equal((await call('A')).body.candidates[0].due,next);assert.notEqual((await call('B')).body.candidates[0].due,next);
 assert.equal((await call('A',{action:'reschedule',date,taskId:noteId,due:date,rescheduleVersion:null})).status,409);
 const reset=await call('A',{action:'reschedule',date,taskId:noteId,due:date,rescheduleVersion:moved.body.rescheduleVersion});assert.equal(reset.status,200,JSON.stringify(reset.body));
 const p={budgets:[30,30,30,30,30,30,0],allowedKinds:['note-review'],preferredTrack:'阅读研究',routines:[{id:'routine',title:'Daily reading',subject:'英语',track:'通用',minutes:10,priority:1,days:[0,1,2,3,4,5,6]}]};
 assert.equal((await call('A',{action:'preferences',preferences:p,preferencesVersion:null},{Origin:'https://other.invalid'})).status,403);
 assert.equal((await call('A',{action:'preferences',preferences:{...p,budgets:[999,30,30,30,30,30,0]},preferencesVersion:null})).status,400);
 const saved=await call('A',{action:'preferences',preferences:p,preferencesVersion:null});assert.equal(saved.status,200,JSON.stringify(saved.body));const version=saved.body.preferencesVersion;
 assert.equal((await call('A',{action:'preferences',preferences:p,preferencesVersion:null})).status,409);
 assert.equal((await call('B')).body.preferencesVersion,null);
 const preview=await call('A',{action:'week-preview',preferencesVersion:version});assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.plans.length,7);assert.equal(preview.body.plans[6].budgetMinutes,0);assert.equal(preview.body.plans[6].tasks.length,0);assert.equal(preview.body.plans.flatMap(p=>p.tasks).filter(t=>t.kind==='note-review').length,1);assert.ok(!JSON.stringify(preview.body).includes('Title B'));
 assert.equal((await db.prepare("SELECT count(*) AS n FROM study_day_plans").first()).n,0);
 const race=await Promise.all([call('A',{action:'week-save',preferencesVersion:version,token:preview.body.token}),call('A',{action:'week-save',preferencesVersion:version,token:preview.body.token})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409],JSON.stringify(race));
 assert.equal((await db.prepare("SELECT count(*) AS n FROM study_day_plans WHERE user_id='A'").first()).n,7);assert.equal((await db.prepare("SELECT count(*) AS n FROM study_day_plans WHERE user_id='B'").first()).n,0);
 const again=await call('A',{action:'week-preview',preferencesVersion:version});assert.equal(again.body.plans.length,0);
 // Verify isolated migration triggers, including history backfill-compatible shape and deletion.
 const event={date,tasks:[{id:'review-fixture',kind:'note-review',sourceId:'same_note',review:{outcome:'good',level:1,due:next,at:new Date().toISOString()}}]};
 await db.prepare("INSERT INTO study_day_plans(user_id,day,version,payload,updated_at) VALUES(?,?,?,?,?)").bind('B',date,'fixture',JSON.stringify(event),new Date().toISOString()).run();
 assert.equal((await db.prepare("SELECT count(*) AS n FROM study_review_events WHERE user_id='B'").first()).n,1);
 await db.prepare("UPDATE study_day_plans SET payload=? WHERE user_id='B' AND day=?").bind(JSON.stringify(event),date).run();
 assert.equal((await db.prepare("SELECT count(*) AS n FROM study_review_events WHERE user_id='B'").first()).n,1);
 await db.prepare("DELETE FROM study_day_plans WHERE user_id='B' AND day=?").bind(date).run();
 assert.equal((await db.prepare("SELECT count(*) AS n FROM study_review_events WHERE user_id='B'").first()).n,0);
 console.log('PASS: private preferences, validated budgets, seven-day preview, rest, candidate dedupe, atomic concurrent save, existing-plan preservation and review event triggers.');
}finally{await mf.dispose();}
