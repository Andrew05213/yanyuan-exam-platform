// Operator-side activation only. Never deploy from an untrusted PR or change
// database schemas automatically. The operator owns the external service hooks.
import {lstatSync,realpathSync,readlinkSync,readFileSync,symlinkSync,renameSync,mkdirSync,rmdirSync,unlinkSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyRelease} from './release-assets.mjs';
import {checkHealth} from './check-release-health.mjs';
const inside=(root,p)=>{const rel=relative(root,p);return !!rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel);};
function command(executable,args,cwd){
 const r=spawnSync(executable,args,{cwd,stdio:'inherit',timeout:120000});if(r.error||r.status!==0)throw Error('Service hook failed.');
}
export async function activate({current,candidate,revision,restart,healthUrl},{runRestart,health=checkHealth}={}){
 if(!/^[a-f0-9]{40}$/.test(revision)||!isAbsolute(current)||!isAbsolute(candidate)||(!runRestart&&(!restart||!isAbsolute(restart))))throw Error('Explicit absolute paths and exact commit required.');
 const root=realpathSync(dirname(current)),link=resolve(root,current.split(sep).at(-1)),next=realpathSync(candidate);
 if(!inside(root,next)||!lstatSync(link).isSymbolicLink())throw Error('Current must be a release symlink and candidate must be under the release root.');
 const previous=realpathSync(link);
 if(!inside(root,previous))throw Error('Previous release outside root.');
 const oldManifest=JSON.parse(readFileSync(resolve(previous,'dist/client/release.json'),'utf8'));
 verifyRelease(resolve(previous,'dist/client'),oldManifest.revision);verifyRelease(resolve(next,'dist/client'),revision);
 // Identical migrations are mandatory for automatic code rollback.
 const migrations=spawnSync('git',['diff','--quiet',oldManifest.revision,revision,'--','drizzle','db/schema.ts','db/literature-schema.ts'],{cwd:next});
 const head=spawnSync('git',['rev-parse','HEAD'],{cwd:next,encoding:'utf8'});
 if(head.status!==0||head.stdout.trim()!==revision||migrations.status!==0)throw Error('Commit mismatch or migration changes; manual backed-up deployment required.');
 const lock=link+'.deploy-lock';mkdirSync(lock,{mode:0o700});
 const swap=target=>{const temp=resolve(lock,'next');symlinkSync(target,temp,'dir');try{renameSync(temp,link);}catch(e){unlinkSync(temp);throw e;}};
 const restartService=()=>runRestart?runRestart():command(restart,[],root);
 let changed=false;
 try{
  if(realpathSync(link)!==previous)throw Error('Release changed during validation.');
  await health(healthUrl,oldManifest.revision);
  if(previous===next){if(oldManifest.revision!==revision)throw Error('Release identity conflict.');return {revision,unchanged:true};}
  swap(next);changed=true;await restartService();await healthy(health,healthUrl,revision);
  return {revision,previous:oldManifest.revision};
 }catch(error){
  if(changed){try{swap(previous);await restartService();await healthy(health,healthUrl,oldManifest.revision);}catch{throw Error('Activation failed AND rollback health failed; urgent operator intervention required.');}throw Error('Activation failed; previous release restored and checked: '+error.message);}
  throw error;
 }finally{rmdirSync(lock);}
}
async function healthy(health,url,revision){
 let last;for(let i=0;i<6;i++){try{return await health(url,revision);}catch(e){last=e;if(i<5)await new Promise(r=>setTimeout(r,2000));}}throw last;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [current,candidate,revision,restart,healthUrl]=process.argv.slice(2);
 try{console.log(await activate({current,candidate,revision,restart,healthUrl}));}catch(e){console.error(e.message);process.exitCode=1;}
}
