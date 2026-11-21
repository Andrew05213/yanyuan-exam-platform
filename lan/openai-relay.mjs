import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {fetch:undiciFetch,ProxyAgent}=require(wr.resolve('undici'));
const paths=new Map([['/v1/models','GET'],['/v1/responses','POST'],['/v1/chat/completions','POST']]);

// No public route: only a local authenticated Worker may reach the allowlisted
// official API via the already-installed HTTP proxy. Keys are never logged.
export function createOpenAIRelay({token,proxyUrl='http://127.0.0.1:18080',request}={}){
 if(typeof token!=='string'||token.length<32)throw Error('Relay token is required.');
 const agent=request?null:new ProxyAgent(proxyUrl),send=request||((url,options)=>undiciFetch(url,{...options,dispatcher:agent}));
 let active=0;
 const server=http.createServer(async(req,res)=>{
  const reply=(status,error)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error}));};
  if(req.url==='/healthz'&&req.method==='GET')return reply(200,null);
  const supplied=req.headers['x-yanyuan-relay-token'];
  if(typeof supplied!=='string'||Buffer.byteLength(supplied)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token)))return reply(401,'Proxy authentication required.');
  let target;
  try{target=new URL(req.headers['x-yanyuan-upstream']);if(req.url!=='/forward'||target.protocol!=='https:'||target.hostname!=='api.openai.com'||target.port&&target.port!=='443'||target.username||target.password||target.search||target.hash||paths.get(target.pathname)!==req.method)throw Error();}catch{return reply(400,'Unsupported upstream endpoint.');}
  if(active>=4)return reply(503,'Proxy is busy.');
  active++;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),95000);
  const abort=()=>{if(!res.writableEnded)controller.abort();};res.on('close',abort);req.on('aborted',abort);
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024)return reply(413,'Request is too large.');chunks.push(chunk);}
   const body=req.method==='POST'?Buffer.concat(chunks):undefined;
   const response=await send(target.href,{method:req.method,headers:{...(req.headers.authorization?{authorization:req.headers.authorization}:{}),'content-type':'application/json',accept:'application/json'},body,redirect:'manual',signal:controller.signal});
   // Never follow upstream redirects or forward credentials to another origin.
   if(response.status>=300&&response.status<400){await response.body?.cancel();return reply(502,'Upstream redirect rejected.');}
   res.writeHead(response.status,{'content-type':response.headers.get('content-type')||'application/json','cache-control':'no-store'});
   let received=0;if(response.body)for await(const chunk of response.body){received+=chunk.length;if(received>2*1024*1024){controller.abort();throw Error();}if(!res.write(chunk))await once(res,'drain',{signal:controller.signal});}
   res.end();
  }catch{if(!res.headersSent)reply(502,'OpenAI proxy connection failed.');else res.destroy();}
  finally{active--;clearTimeout(timeout);res.off('close',abort);req.off('aborted',abort);}
 });
 server.requestTimeout=100000;server.headersTimeout=10000;server.maxHeadersCount=32;
 return {server,async close(){server.closeIdleConnections();await new Promise(resolve=>server.close(resolve));await agent?.close();}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const relay=createOpenAIRelay({token:process.env.AI_RELAY_TOKEN});
 relay.server.listen(18081,'127.0.0.1',()=>console.log('OpenAI relay listening on loopback port 18081'));
 const stop=()=>relay.close().finally(()=>process.exit(0));process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
