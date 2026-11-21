import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve(import.meta.dirname,'..'),server=path.join(root,'dist/server');
const paths=readdirSync(server,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js');
let reply='good';
const mf=new Miniflare({modules:['index.js',...paths].map(p=>({type:'ESModule',path:path.join(server,p)})),modulesRoot:server,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{DEEPSEEK_API_KEY:'test-key-only',DEEPSEEK_MODEL:'test-only'},outboundService:async req=>{
 assert.equal(req.url,'https://api.deepseek.com/v1/chat/completions');
 const input=await req.json();assert.equal(input.response_format.type,'json_object');
 if(reply==='limit')return new Response('',{status:429});
 const value={quote:reply==='good'?'车窗':'不存在',evidenceQuote:'倒影',strength:'能解释观察视角',gap:'仍缺人物动作',suggestion:'补充一句人物描写',questions:['倒影如何影响距离？','车窗外的人会怎么看？']};
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
}});
async function call(route,user,method='GET',data){
 const r=await mf.dispatchFetch('https://qa.test/api/literature/'+route,{method,headers:{origin:'https://qa.test','content-type':'application/json',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 return [r.status,await r.json()];
}
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort()){
  for(const sql of readFileSync(path.join(root,'drizzle',f),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  if(f.startsWith('0007'))await db.prepare('INSERT INTO entries(user_id,id,title,content,status,updated_at) VALUES(?,?,?,?,?,?)').bind('A','genji','旧笔记','旧正文','已读','2026-01-01T00:00:00Z').run();
 }
 assert.equal((await call('entries','A'))[1][0].content,'旧正文');
 const catalog=(await call('materials','A'))[1];
 const custom={...catalog[0],id:'material_demo',title:'自建作品'};
 assert.equal((await call('materials','B','POST',{materials:[custom]}))[1].changed,1);
 assert.equal((await call('materials','B','POST',{materials:[{...custom,title:'冲突标题'}]}))[1].changed,0);
 assert.equal((await call('materials','B'))[1].find(w=>w.id===custom.id).title,custom.title);
 const n={id:'note_qa',workId:'genji',title:'随笔',content:'观点',tags:'面试复练',locator:'第2章',reviewOn:'2026-11-20',status:'在读'};
 assert.equal((await call('entries','A','PUT',n))[0],200);
 const rows=(await call('entries','A'))[1];assert.equal(rows[0].locator,n.locator);
 assert.equal((await call('entries','B','POST',{entries:rows}))[1].changed,2);
 assert.equal((await call('entries','B','POST',{entries:[{...n,title:'冲突内容'}]}))[1].changed,0);
 assert.equal((await call('entries','B'))[1].find(e=>e.id===n.id).title,n.title);
 assert.equal((await call('entries','C'))[1].length,0);
 assert.equal((await call('entries',null,'POST',{entries:[n]}))[0],401);
 assert.equal((await call('entries','A','POST',{entries:[n,{...n,status:'坏数据'}]}))[0],400);
 const prompt={topic:'雪国',question:'距离感如何形成？',evidence:'倒影',answer:'车窗'};
 const good=await call('feedback','A','POST',prompt);assert.equal(good[0],200,JSON.stringify(good));assert.match(good[1].feedback,/追问 2/);
 reply='bad';assert.equal((await call('feedback','A','POST',prompt))[0],502);
 reply='limit';assert.match((await call('feedback','A','POST',prompt))[1].error,/受限/);
 const today = async user => mf.dispatchFetch("https://qa.test/api/today",{headers:user?{"oai-authenticated-user-id":user}:{}});
 assert.equal((await today(null)).status,401);
 const mine=await (await today("A")).json();
 assert.ok(mine.recent && mine.recent.id==="note_qa");
 const other=await (await today("C")).json();
 assert.equal(other.recent,undefined);
 assert.equal(other.notes.length,0);
 console.log('PASS: migrated old notes, metadata, per-user import, retry-safe conflicts, isolated model response and upstream errors.');
}finally{await mf.dispose();}
