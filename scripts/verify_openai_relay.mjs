import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createOpenAIRelay} from '../lan/openai-relay.mjs';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{buildSync}=require(wr.resolve('esbuild'));
const code=buildSync({entryPoints:['lib/upstream-fetch.ts'],bundle:true,format:'esm',write:false}).outputFiles[0].text;
const {createAIFetch}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const token='fake-local-relay-token-for-isolated-tests',key='fake-openai-key-for-isolated-tests',calls=[];
const relay=createOpenAIRelay({token,request:async(url,options)=>{calls.push({url,options});assert.equal(options.headers['x-yanyuan-relay-token'],undefined);assert.equal(options.redirect,'manual');return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});}});
await new Promise(resolve=>relay.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+relay.server.address().port+'/forward';
try{
 assert.equal((await fetch(url)).status,401);
 for(const target of ['http://api.openai.com/v1/models','https://127.0.0.1/v1/models','https://api.openai.com.evil.test/v1/models','https://api.openai.com/v1/files','https://api.openai.com/v1/models?secret=x']){const r=await fetch(url,{headers:{'x-yanyuan-relay-token':token,'x-yanyuan-upstream':target}});assert.equal(r.status,400);}
 assert.equal(calls.length,0);
 const ai=createAIFetch({url,token});const r=await ai('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:'fixture',input:'fixture',stream:false})});assert.equal(r.status,200);assert.equal(calls[0].url,'https://api.openai.com/v1/responses');assert.equal(calls[0].options.headers.authorization,'Bearer '+key);
 let direct=0;const test=createAIFetch({url,token},async(target,options)=>{direct++;assert.equal(target,'https://api.deepseek.com/models');assert.equal(new Headers(options?.headers).has('x-yanyuan-relay-token'),false);return Response.json({});});await test('https://api.deepseek.com/models');assert.equal(direct,1);
 await assert.rejects(async()=>createAIFetch({url:'http://192.168.100.1/forward',token})('https://api.openai.com/v1/models'));
 console.log('PASS: authenticated loopback OpenAI relay, strict host/path/method allowlist, secret separation, real local HTTP forwarding and unchanged DeepSeek routing. No external API call.');
}finally{await relay.close();}
