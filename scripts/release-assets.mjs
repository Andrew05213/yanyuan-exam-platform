// Deterministic build output only; never modify tracked source or a live checkout.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,realpathSync,statSync,renameSync} from 'node:fs';
import {resolve,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const resource=/((?:src|href)=")([A-Za-z0-9_./-]+\.(?:js|css|svg|ico|woff2?|json))(?:\?v=[^"]*)?(")/g;
export function fingerprintAssets(directory,html){
 const root=realpathSync(directory),files={};
 const result=html.replace(resource,(whole,before,name,after)=>{
  const file=realpathSync(resolve(root,name)),rel=relative(root,file);
  if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||!statSync(file).isFile())throw Error('Asset outside output: '+name);
  const digest=hash(readFileSync(file));files[name]=digest;
  // JSON preload URLs must equal the application's runtime fetch URLs; they
  // use conditional revalidation rather than immutable cache.
  return before+name+(name.endsWith('.json')?'':'?v='+digest.slice(0,12))+after;
 });
 if(!Object.keys(files).length)throw Error('No entry assets found.');
 return {html:result,files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)))};
}
function atomic(path,text){const tmp=path+'.tmp';writeFileSync(tmp,text);renameSync(tmp,path);}
export function createRelease(directory,revision){
 if(!/^[a-f0-9]{40}$/.test(revision)&&revision!=='unknown')throw Error('Invalid release revision.');
 const index=resolve(directory,'index.html'),data=fingerprintAssets(directory,readFileSync(index,'utf8'));
 const manifest={schema:1,revision,entrySha256:hash(data.html),assets:data.files};
 atomic(index,data.html);atomic(resolve(directory,'release.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
export function verifyRelease(directory,expected){
 const manifest=JSON.parse(readFileSync(resolve(directory,'release.json'),'utf8'));
 const html=readFileSync(resolve(directory,'index.html'),'utf8'),data=fingerprintAssets(directory,html);
 if(manifest.schema!==1||manifest.revision!==expected||data.html!==html||manifest.entrySha256!==hash(html)||JSON.stringify(manifest.assets)!==JSON.stringify(data.files))throw Error('Release manifest, entry or asset digest mismatch.');
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,directory='dist/client',revision='unknown']=process.argv.slice(2);
 if(mode==='generate')createRelease(directory,revision);
 else if(mode==='check')verifyRelease(directory,revision);
 else throw Error('Use generate or check.');
}
