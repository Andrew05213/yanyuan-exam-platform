import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function checkHealth(base,revision,{request=fetch}={}){
 if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Expected exact release commit.');
 const origin=new URL(base);
 if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Provide a bare HTTP(S) origin.');
 if(origin.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw Error('Nonlocal release health checks require HTTPS.');
 async function get(path){
  const u=new URL(path,origin);if(u.origin!==origin.origin)throw Error('Cross-origin asset.');
  const r=await request(u,{redirect:'error',cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error(path+' returned '+r.status);
  return r;
 }
 const [manifest,backend,entry]=await Promise.all([get('/release.json').then(r=>r.json()),get('/api/release').then(r=>r.json()),get('/index.html').then(r=>r.arrayBuffer())]);
 if(manifest.schema!==1||backend.schema!==1||manifest.revision!==revision||backend.revision!==revision||manifest.entrySha256!==sha(Buffer.from(entry)))throw Error('Frontend and backend release identity mismatch.');
 const assets=Object.entries(manifest.assets||{});
 if(assets.length<1||assets.length>200)throw Error('Invalid asset manifest.');
 for(const [name,digest] of assets)if(!/^[A-Za-z0-9_./-]+\.(?:js|css|svg|ico|woff2?|json)$/.test(name)||name.split('/').some(s=>!s||s==='.'||s==='..')||! /^[a-f0-9]{64}$/.test(digest))throw Error('Invalid asset entry.');
 for(let i=0;i<assets.length;i+=5)await Promise.all(assets.slice(i,i+5).map(async([name,digest])=>{
  const r=await get('/'+name+(name.endsWith('.json')?'':'?v='+digest.slice(0,12)));
  if(sha(Buffer.from(await r.arrayBuffer()))!==digest)throw Error('Asset mismatch: '+name);
 }));
 return {revision,assets:assets.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [url,revision]=process.argv.slice(2);try{const result=await checkHealth(url,revision);console.log('Verified live release '+result.revision+' ('+result.assets+' assets).');}catch(e){console.error(e.message);process.exitCode=1;}
}
