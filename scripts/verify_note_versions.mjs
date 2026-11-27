// Isolated compiled-worker integration, no production DB or users.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve('dist/server');
const paths=readdirSync(root,{recursive:true}).filter(f=>/\.m?js$/.test(f)&&f!=='index.js');
const mf=new Miniflare({modules:['index.js',...paths].map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const call=(method,user,entry,query='')=>mf.dispatchFetch('https://study.test/api/literature/entries'+query,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),...(entry?{'Content-Type':'application/json'}:{})},body:entry?JSON.stringify(entry):undefined});
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const statement of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
 let note={id:'note_fixture',title:'first',content:'private A',status:'在读',revision:0};
 let r=await call('PUT','A',note);assert.equal(r.status,200);note=(await r.json()).entry;
 assert.equal((await call('GET','B',null,'?history=note_fixture')).status,404);
 assert.equal((await call('GET',null,null,'?history=note_fixture')).status,401);
 for(let i=0;i<23;i++){r=await call('PUT','A',{...note,content:'version '+i});assert.equal(r.status,200);note=(await r.json()).entry;}
 const history=await call('GET','A',null,'?history=note_fixture');assert.equal(history.status,200);assert.match(history.headers.get('Cache-Control'),/no-store/);
 const versions=(await history.json()).versions;assert.equal(versions.length,20);assert.equal(versions[0].content,'version 21');assert.ok(versions.every(v=>v.revision<note.revision));
 const stale=await call('PUT','A',{...note,revision:1,content:'stale'});assert.equal(stale.status,409);
 const restore=await call('PUT','A',{...note,content:versions[0].content});assert.equal(restore.status,200);assert.equal((await restore.json()).entry.revision,note.revision+1);
 assert.equal((await call('GET','B',null,'?history=note_fixture')).status,404);
 await db.prepare('DELETE FROM entries WHERE user_id=? AND id=?').bind('A','note_fixture').run();
 assert.equal((await db.prepare('SELECT count(*) AS n FROM note_versions WHERE user_id=?').bind('A').first()).n,0);
 console.log('PASS: private bounded note history, stale revisions, restore as new revision and deletion.');
}finally{await mf.dispose();}
