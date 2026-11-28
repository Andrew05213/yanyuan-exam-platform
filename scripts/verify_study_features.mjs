import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {Miniflare}=require(wr.resolve('miniflare')),{MockAgent}=require(wr.resolve('undici'));
const root=path.resolve(import.meta.dirname,'..'),server=path.join(root,'dist/server');
const modules=readdirSync(server,{recursive:true}).filter(name=>/\.(m?js)$/.test(name)&&name!=='index.js');
const mock=new MockAgent();
mock.disableNetConnect();
const mf=new Miniflare({
  modules:[{type:'ESModule',path:path.join(server,'index.js')},...modules.map(name=>({type:'ESModule',path:path.join(server,name)}))],
  modulesRoot:server,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  bindings:{ADMIN_USER_IDS:'admin',AI_CREDENTIALS_ENCRYPTION_KEY:randomBytes(32).toString('base64')},
  d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock:mock,
});
const secret='isolated-study-provider-test-key';

async function call(route,user,method='GET',data) {
  const response=await mf.dispatchFetch('https://study.test'+route,{method,headers:{
    ...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),
    ...(data?{'content-type':'application/json','origin':'https://study.test'}:{}),
  },body:data?JSON.stringify(data):undefined});
  const text=await response.text();
  assert.ok(!text.includes(secret));
  return {status:response.status,body:JSON.parse(text)};
}

async function setProvider(protocol,baseUrl) {
  const registered=await call('/api/admin/providers','admin','POST',{
    name:protocol,protocol,baseUrl,model:'qa-study-model',currency:'USD',enabled:true,
    apiKey:secret,inputPrice:'2',cachedInputPrice:'0.5',outputPrice:'8',
  });
  assert.equal(registered.status,200,JSON.stringify(registered.body));
  const {id,revision}=registered.body.provider;
  assert.equal((await call('/api/admin/providers','admin','POST',{action:'select-default',id,expectedRevision:revision})).status,200);
}

try {
  const manifest=JSON.parse(readFileSync(path.join(root,'dist/client/release.json'),'utf8'));
  const release=await mf.dispatchFetch('https://study.test/api/release');assert.equal(release.status,200);assert.equal(release.headers.get('cache-control'),'no-store');assert.deepEqual(await release.json(),{schema:1,revision:manifest.revision});
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync(path.join(root,'drizzle')).filter(name=>name.endsWith('.sql')).sort()) {
    if(file.startsWith('0012_')){
      await db.prepare("INSERT INTO entries(user_id,id,title,content,status,updated_at) VALUES('migration-check','legacy-note','旧笔记','原正文','已读','2026-11-20T02:00:00Z')").run();
    }
    for(const sql of readFileSync(path.join(root,'drizzle',file),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)) {
      await db.prepare(sql).run();
    }
  }
  const notes='/api/literature/entries',bank='/api/question-bank',questions='/api/ai-questions',review='/api/literature/feedback';
  const legacy=(await call(notes,'migration-check')).body[0];
  assert.deepEqual([legacy.id,legacy.content,legacy.folder,legacy.revision,legacy.language],['legacy-note','原正文','active',1,null]);
  assert.equal((await call('/api/literature/governance','A')).body.read,false);
  assert.equal((await call('/api/literature/community','A')).status,403);
  assert.equal((await call(notes,null)).status,401);
  assert.equal((await call(notes,'A','PUT',{id:'test_note',title:'研究笔记',content:'文本依据',status:'在读',language:'日语',sourceLanguage:'日本語',discipline:'文学'})).status,200);
  const note=(await call(notes,'A')).body[0];
  assert.equal(note.title,'研究笔记');
  assert.equal(note.revision,1);
  const edits=await Promise.all(['甲端修改','乙端修改'].map(content=>call(notes,'A','PUT',{...note,content})));
  assert.deepEqual(edits.map(item=>item.status).sort(),[200,409]);
  const savedNote=edits.find(item=>item.status===200).body.entry;
  assert.equal(savedNote.revision,2);
  assert.deepEqual(edits.find(item=>item.status===409).body.current,savedNote);
  assert.equal((await call(notes,'B','PATCH',{id:note.id,revision:2,folder:'trash'})).body.current,null);
  const moved=await call(notes,'A','PATCH',{id:note.id,revision:2,folder:'archived'});
  assert.equal(moved.body.entry.folder,'archived');
  assert.equal((await call(notes,'A','PUT',{...savedNote,revision:3})).status,409);
  assert.equal((await call(notes,'A','PATCH',{id:note.id,revision:3,folder:'trash'})).body.entry.folder,'trash');
  const restored=(await call(notes,'A','PATCH',{id:note.id,revision:4,folder:'active'})).body.entry;
  assert.equal(restored.revision,5);
  assert.equal(restored.content,savedNote.content);
  assert.deepEqual([restored.language,restored.sourceLanguage,restored.discipline],['日语','日本語','文学']);
  assert.equal((await call(notes,'A','POST',{entries:[note]})).body.changed,0);
  assert.equal((await call(notes,'A')).body[0].revision,5);
  assert.deepEqual((await call(notes,'B')).body,[]);
  assert.equal((await call(questions,'A')).body.ready,false);
  await setProvider('openai-responses','https://api.openai.com/v1');
  assert.equal((await call(questions,'A')).body.ready,true);
  const item={items:[{title:'Vocabulary',questions:[{stem:'Choose the best word.',options:['work','worked','works','working'],answer:'C',analysis:'主语是第三人称单数。',tag:'主谓一致'}]}]};
  const counts={input_tokens:100,input_tokens_details:{cached_tokens:40},output_tokens:20};
  mock.get('https://api.openai.com').intercept({path:'/v1/responses',method:'POST'}).reply(200,JSON.stringify({
    status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(item)}]}],usage:counts,
  }));
  const request={requestId:'test-generation-0001',subject:'英语',topic:'主谓一致',difficulty:'进阶',type:'mc',count:1};
  const generated=await call(questions,'A','POST',request);
  assert.equal(generated.status,200,JSON.stringify(generated.body));
  assert.equal((await call(questions,'A','POST',request)).body.deduplicated,true);
  assert.equal((await call(bank,'A','POST',{items:generated.body.items})).status,201);
  assert.equal((await call(bank,'A')).body.total,1);
  assert.equal((await call(bank,'B')).body.total,0);
  const saved=(await call(bank,'A')).body.items[0];
  assert.equal((await call(bank,'B','PUT',{id:saved.id,expectedRevision:saved.revision,reviewStatus:'approved'})).status,409);
  assert.equal((await call(bank,'A','PUT',{id:saved.id,expectedRevision:saved.revision,reviewStatus:'approved'})).status,200);

  await setProvider('openai-compatible','https://api.deepseek.com');
  const feedback={quote:'用措辞支持判断',evidenceQuote:'原文有变化',strength:'提供了文本支持',gap:'可以补充语境',suggestion:'举出前后文',questions:['如何理解变化？','判断在何处失效？']};
  const usage={prompt_tokens:100,prompt_cache_hit_tokens:40,completion_tokens:20};
  const stub=content=>mock.get('https://api.deepseek.com').intercept({path:'/chat/completions',method:'POST'})
    .reply(200,JSON.stringify({choices:[{finish_reason:'stop',message:{content}}],usage}));
  const practice={topic:'文本细读',question:'你如何理解这段话？',evidence:'原文有变化',answer:'用措辞支持判断'};
  stub(JSON.stringify(feedback));
  const successful=await call(review,'B','POST',practice);
  assert.equal(successful.status,200,JSON.stringify(successful.body));
  assert.match(successful.body.feedback,/提供了文本支持/);
  stub('{}');
  assert.equal((await call(review,'B','POST',practice)).status,502);
  const rows=(await db.prepare('SELECT user_id,task,status,input_tokens,cached_input_tokens,output_tokens,estimated_cost_micros FROM ai_usage_events ORDER BY user_id,status').all()).results;
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(row=>[row.user_id,row.task,row.status]),[
    ['A','question-generation','success'],['B','literature-feedback','error'],['B','literature-feedback','success'],
  ]);
  for(const row of rows) assert.deepEqual([row.input_tokens,row.cached_input_tokens,row.output_tokens,row.estimated_cost_micros],[100,40,20,'300']);
  mock.assertNoPendingInterceptors();
  console.log('PASS: owned notes and question bank, billed Responses generation and Chat feedback, replay and failed-output accounting.');
} finally {
  await mf.dispose();
  await mock.close();
}
