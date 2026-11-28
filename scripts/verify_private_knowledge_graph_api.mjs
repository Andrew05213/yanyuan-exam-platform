import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),{Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve('dist/server'),modules=['index.js',...readdirSync(root,{recursive:true}).filter(f=>/\.m?js$/.test(f)&&f!=='index.js')];
const mf=new Miniflare({modules:modules.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const stamp=new Date().toISOString();
async function call(user,query={},body,extra={}){const r=await mf.dispatchFetch('https://study.test/api/knowledge-graph?'+new URLSearchParams(query),{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};}
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const q of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(q).run();
 for(const [user,id,title] of [['A','same','Own A'],['A','second','Own A second'],['B','same','Private B']])await db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at,tags) VALUES(?,?,?,?,?,?,?)").bind(user,id,title,'PRIVATE_BODY_'+user,'在读',stamp,'fixture_unique_tag').run();
 assert.equal((await call(null)).status,401);
 const a=await call('A',{kind:'note'});assert.equal(a.status,200,JSON.stringify(a.body));assert.match(a.cache,/no-store/);assert.deepEqual(a.body.nodes.map(n=>n.title).sort(),['Own A','Own A second']);assert.ok(!JSON.stringify(a.body).includes('PRIVATE_BODY'));assert.ok(!JSON.stringify(a.body).includes('Private B'));
 const other=await call('B',{kind:'note'});assert.equal(other.body.nodes.length,1);
 const s=a.body.suggestions.find(x=>x.reason.includes('fixture_unique_tag'));assert.ok(s);const v=a.body.version;
 assert.equal((await call('A',{}, {version:v,action:'concept-create',title:'x'},{Origin:'https://other.invalid'})).status,403);
 const cr=await call('A',{}, {version:v,action:'concept-create',title:'<script>Concept</script>',description:'fixture'});assert.equal(cr.status,200,JSON.stringify(cr.body));let version=cr.body.version;
 assert.equal((await call('A',{}, {version:v,action:'concept-create',title:'stale'})).status,409);
 assert.equal((await call('B',{kind:'concept'})).body.total,0);
 const c=(await call('A',{kind:'concept'})).body.nodes[0];
 assert.equal(c.title,'<script>Concept</script>');
 assert.equal((await call('B',{}, {version:null,action:'link-create',from:other.body.nodes[0].id,to:c.id,relation:'related_to'})).status,404);
 const reject=await call('A',{}, {version,action:'suggestion-dismiss',id:s.id});assert.equal(reject.status,200,JSON.stringify(reject.body));version=reject.body.version;
 assert.ok((await call('A')).body.dismissed.some(x=>x.id===s.id));
 const restore=await call('A',{}, {version,action:'suggestion-restore',id:s.id});assert.equal(restore.status,200);version=restore.body.version;
 const confirm=await call('A',{}, {version,action:'suggestion-confirm',id:s.id});assert.equal(confirm.status,200,JSON.stringify(confirm.body));version=confirm.body.version;
 const focus=(await call('A',{focus:s.from})).body.focus;assert.ok(focus.edges.some(e=>e.manual&&e.relation==='related_to'));
 const args={version,action:'link-create',from:c.id,to:a.body.nodes[0].id,relation:'cites',note:'page 12'};
 const race=await Promise.all([call('A',{},args),call('A',{},args)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);version=race.find(r=>r.status===200).body.version;
 const link=(await call('A',{focus:c.id})).body.focus.edges.find(e=>e.manual);assert.equal(link.note,'page 12');
 await db.prepare("UPDATE entries SET folder='archived' WHERE user_id='A' AND id='same'").run();
 const gone=await call('A',{focus:a.body.nodes.find(n=>n.title==='Own A').id});assert.equal(gone.status,404);
 const current=await call('A',{kind:'note'});assert.equal(current.body.total,1);assert.ok(current.body.inactive.length>=1);
 assert.equal((await call('A',{}, {version,action:'link-delete',id:current.body.inactive[0].id})).status,200);
 console.log('PASS: private knowledge graph API, account isolation, real sources, XSS-safe JSON, suggestion decisions, atomic concurrent links, source archival and deletion.');
}finally{await mf.dispose();}
