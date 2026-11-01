import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {createPublicAssetHandler} from '../lan/public-assets.mjs';

const directory=mkdtempSync(join(tmpdir(),'yanyuan-public-assets-')),root=join(directory,'public');mkdirSync(root);
const source=JSON.stringify({questions:Array(200).fill('Public authored question')});writeFileSync(join(root,'bank.json'),source);writeFileSync(join(directory,'outside.js'),'private');
const serve=createPublicAssetHandler(root),server=http.createServer((req,res)=>{if(!serve(req,res,new URL(req.url,'http://localhost'))){res.writeHead(200,{'cache-control':'private, no-store'});res.end('upstream');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
async function request(path,headers={},method='GET'){return await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path,headers,method},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();});}
try{
 const br=await request('/bank.json?v=12',{'accept-encoding':'gzip, br'});assert.equal(br.status,200);assert.equal(br.headers['content-encoding'],'br');assert.equal(brotliDecompressSync(br.body).toString(),source);assert.ok(br.body.length<source.length/3);assert.match(br.headers['cache-control'],/immutable/);assert.equal(br.headers.vary,'Accept-Encoding');
 const gzip=await request('/bank.json',{'accept-encoding':'gzip'});assert.equal(gunzipSync(gzip.body).toString(),source);assert.notEqual(gzip.headers.etag,br.headers.etag);assert.match(gzip.headers['cache-control'],/must-revalidate/);
 const cached=await request('/bank.json?v=12',{'accept-encoding':'br','if-none-match':br.headers.etag});assert.equal(cached.status,304);assert.equal(cached.body.length,0);
 const head=await request('/bank.json',{'accept-encoding':'gzip'},'HEAD');assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),gzip.body.length);
 const plain=await request('/bank.json',{'accept-encoding':'br;q=0,gzip;q=0'});assert.equal(plain.headers['content-encoding'],undefined);assert.equal(plain.body.toString(),source);
 assert.equal((await request('/bank.json',{'accept-encoding':'*;q=0'})).status,406);
 for(const path of ['/api/session','/index.html','/%2e%2e%2foutside.js','/.secret.js']){const r=await request(path);assert.equal(r.body.toString(),'upstream');assert.equal(r.headers['cache-control'],'private, no-store');}
 assert.equal((await request('/bank.json',{range:'bytes=0-9'})).body.toString(),'upstream');
 writeFileSync(join(root,'bank.json'),source+' ');const changed=await request('/bank.json',{'accept-encoding':'br','if-none-match':br.headers.etag});assert.equal(changed.status,200);assert.notEqual(changed.headers.etag,br.headers.etag);assert.equal(brotliDecompressSync(changed.body).toString(),source+' ');
 console.log('PASS: public-only compression, negotiated encodings, immutable versions, conditional validation, HEAD, range fallback, traversal rejection and change invalidation.');
}finally{await new Promise(r=>server.close(r));const safe=resolve(directory);if(!safe.startsWith(resolve(tmpdir())+sep+'yanyuan-public-assets-'))throw Error('Unexpected test cleanup directory');rmSync(safe,{recursive:true});}
