import {readFileSync,realpathSync,statSync} from 'node:fs';
import {join,relative,isAbsolute,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';

const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
function encoding(header){
 const choices=new Map(String(header||'').toLowerCase().split(',').map(part=>{const [name,...params]=part.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return [name,q?Number(q.trim().slice(2)):1];}));
 const q=name=>choices.get(name)??(name==='identity'?(choices.get('*')===0?0:1):choices.get('*')??0);
 return ['br','gzip','identity'].map(name=>({name,q:q(name)})).filter(x=>x.q>0&&x.q<=1).sort((a,b)=>b.q-a.q)[0]?.name;
}

// Only public, authored files are cached. API responses and HTML never enter here.
export function createPublicAssetHandler(directory){
 const root=realpathSync(directory),cache=new Map();let bytes=0;
 function put(file,entry){
  const old=cache.get(file);if(old)bytes-=old.bytes;cache.delete(file);
  entry.bytes=entry.source.length+[...entry.encoded.values()].reduce((n,b)=>n+b.length,0);
  cache.set(file,entry);bytes+=entry.bytes;
  while(bytes>16*1024*1024&&cache.size>1){const key=cache.keys().next().value;bytes-=cache.get(key).bytes;cache.delete(key);}
 }
 return function serve(req,res,url){
  if(!['GET','HEAD'].includes(req.method)||req.headers.range)return false;
  let file,meta,type;
  try{
   const path=decodeURIComponent(url.pathname);
   if(path.includes('\\')||path.split('/').some(x=>x.startsWith('.')))return false;
   type=types[extname(path).toLowerCase()];if(!type)return false;
   file=realpathSync(join(root,path.replace(/^\//,'')));const rel=relative(root,file);
   if(rel.startsWith('..')||isAbsolute(rel))return false;
   meta=statSync(file);if(!meta.isFile()||meta.size>2*1024*1024)return false;
  }catch{return false;}
  let entry=cache.get(file);
  if(!entry||entry.mtime!==meta.mtimeMs||entry.size!==meta.size){
   const source=readFileSync(file);
   entry={source,mtime:meta.mtimeMs,size:meta.size,hash:createHash('sha256').update(source).digest('hex'),encoded:new Map(),bytes:0};put(file,entry);
  }
  const format=encoding(req.headers['accept-encoding']);if(!format){res.writeHead(406,{'cache-control':'no-store'});res.end();return true;}
  const etag='"'+entry.hash+'-'+format+'"',version=url.searchParams.get('v');
  const headers={'content-type':type,'cache-control':url.pathname==='/release.json'?'no-store':version===entry.hash.slice(0,12)?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate',etag,vary:'Accept-Encoding','x-content-type-options':'nosniff'};
  if(format!=='identity')headers['content-encoding']=format;
  if(String(req.headers['if-none-match']||'').split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag)){res.writeHead(304,headers);res.end();return true;}
  let body=entry.source;
  if(format!=='identity'){
   body=entry.encoded.get(format);
   if(!body){body=format==='br'?brotliCompressSync(entry.source,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):gzipSync(entry.source,{level:6});entry.encoded.set(format,body);put(file,entry);}
  }
  res.writeHead(200,{...headers,'content-length':body.length});res.end(req.method==='HEAD'?undefined:body);return true;
 };
}
