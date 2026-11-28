import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {checkHealth} from './check-release-health.mjs';
import {activate} from './activate-verified-release.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,readlinkSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRelease} from './release-assets.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),rev='a'.repeat(40),old='b'.repeat(40),entry='<script src="app.js"></script>',asset='hello';
let backend=rev,body=asset;const manifest={schema:1,revision:rev,entrySha256:sha(entry),assets:{'app.js':sha(asset)}};
const server=http.createServer((req,res)=>{const path=new URL(req.url,'http://local').pathname;const data={'/release.json':JSON.stringify(manifest),'/api/release':JSON.stringify({schema:1,revision:backend}),'/index.html':entry,'/app.js':body}[path];res.writeHead(data===undefined?404:200,{'cache-control':'no-store'});res.end(data);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
try{
 assert.deepEqual(await checkHealth(url,rev),{revision:rev,assets:1});
 backend=old;await assert.rejects(checkHealth(url,rev),/identity mismatch/);
 backend=rev;body='tampered';await assert.rejects(checkHealth(url,rev),/Asset mismatch/);
 body=asset;manifest.assets['../private.js']=sha(asset);await assert.rejects(checkHealth(url,rev),/Invalid asset/);delete manifest.assets['../private.js'];
 const root=mkdtempSync(join(tmpdir(),'release-activation-'));
 try{
  const prev=join(root,'old'),next=join(root,'new'),current=join(root,'current');mkdirSync(prev);mkdirSync(next);
  const git=(cwd,...args)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  git(next,'init');git(next,'config','user.email','test@example.invalid');git(next,'config','user.name','QA');writeFileSync(join(next,'file'),'old');git(next,'add','file');git(next,'commit','-m','old');const v1=git(next,'rev-parse','HEAD');writeFileSync(join(next,'file'),'new');git(next,'commit','-am','new');const v2=git(next,'rev-parse','HEAD');
  for(const [dir,v] of [[prev,v1],[next,v2]]){const out=join(dir,'dist/client');mkdirSync(out,{recursive:true});writeFileSync(join(out,'index.html'),entry);writeFileSync(join(out,'app.js'),asset);createRelease(out,v);}
  symlinkSync(prev,current,'dir');let restarts=0;
  const args={current,candidate:next,revision:v2,healthUrl:url};
  const health=async(_url,v)=>{assert.equal(readlinkSync(current),v===v1?prev:next);return {revision:v};};
  // A failed restart must restore old code and prove old release health.
  await assert.rejects(activate(args,{runRestart:async()=>{if(++restarts===1)throw Error('synthetic restart failure');},health}),/restored and checked/);
  assert.equal(readlinkSync(current),prev);assert.equal(restarts,2);
  await activate(args,{runRestart:async()=>{restarts++;},health});assert.equal(readlinkSync(current),next);
 }finally{rmSync(root,{recursive:true,force:true});}
 console.log('PASS: live frontend/backend and asset identity, stale and tampered responses, safe atomic activation and verified rollback.');
}finally{await new Promise(r=>server.close(r));}
