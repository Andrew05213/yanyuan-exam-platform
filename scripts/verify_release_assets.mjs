import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRelease,verifyRelease,fingerprintAssets} from './release-assets.mjs';
const root=mkdtempSync(join(tmpdir(),'hezhi-release-')),rev='a'.repeat(40);
try{
 mkdirSync(join(root,'assets'));writeFileSync(join(root,'assets/logo.svg'),'<svg/>');writeFileSync(join(root,'app.js'),'let version=1;');writeFileSync(join(root,'data.json'),'{}');
 const html='<link href="assets/logo.svg?v=2"><link rel="preload" href="data.json" as="fetch"><script src="app.js?v=1"></script>';
 writeFileSync(join(root,'index.html'),html);const one=createRelease(root,rev);
 assert.equal(one.assets['app.js'],createHash('sha256').update('let version=1;').digest('hex'));
 assert.match(readFileSync(join(root,'index.html'),'utf8'),/app\.js\?v=[a-f0-9]{12}/);
 assert.match(readFileSync(join(root,'index.html'),'utf8'),/href="data\.json"/);
 assert.deepEqual(verifyRelease(root,rev),one);assert.deepEqual(createRelease(root,rev),one);
 writeFileSync(join(root,'app.js'),'let version=2;');assert.throws(()=>verifyRelease(root,rev),/mismatch/);
 const two=createRelease(root,rev);assert.notEqual(two.assets['app.js'],one.assets['app.js']);assert.notEqual(two.entrySha256,one.entrySha256);
 assert.throws(()=>verifyRelease(root,'b'.repeat(40)),/mismatch/);
 assert.throws(()=>fingerprintAssets(root,'<script src="missing.js"></script>'));
 assert.throws(()=>fingerprintAssets(root,'<script src="../outside.js"></script>'));
 const git=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});const head=git.status===0?git.stdout.trim():'unknown';
 const built=verifyRelease('dist/client',head);assert.ok(Object.keys(built.assets).length>=30);
 const source=readFileSync('public/index.html','utf8');assert.doesNotMatch(source,/(?:src|href)="[^"]+\?v=/);
 console.log('PASS: deterministic content-addressed release, runtime/preload consistency, tamper/stale revision rejection, full built entry verification and untouched source.');
}finally{rmSync(root,{recursive:true,force:true});}
