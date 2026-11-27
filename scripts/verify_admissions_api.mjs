import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';

const require=createRequire(import.meta.url);
const {Miniflare}=require(createRequire(require.resolve('wrangler')).resolve('miniflare'));
const root=path.resolve(import.meta.dirname,'..'),server=path.join(root,'dist/server');
const modules=['index.js',...readdirSync(server,{recursive:true}).filter(f=>/\.(m?js)$/.test(f)&&f!=='index.js')];
const mf=new Miniflare({
  modules:modules.map(f=>({type:'ESModule',path:path.join(server,f)})),
  modulesRoot:server,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],
});
async function call(method,user,body,extra={}){
  const response=await mf.dispatchFetch('https://study.test/api/admissions',{
    method,body:body===undefined?undefined:JSON.stringify(body),
    headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@qa.invalid'}:{}),
      ...(body!==undefined?{'Content-Type':'application/json','Origin':'https://study.test'}:{}),...extra},
  });
  return {status:response.status,data:await response.json(),cache:response.headers.get('cache-control')};
}
try{
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync(path.join(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort()){
    for(const sql of readFileSync(path.join(root,'drizzle',file),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  }
  const plan={year:2027,language:'日语',qualification:'confirmed',examRegistration:'yes',schoolIds:['pku','thu'],
    exams:[
      {schoolId:'thu',start:'2027-01-15T10:30',end:'2027-01-15T11:30',location:'北京考点乙',from:'私人考点甲',travelMinutes:45},
      {schoolId:'pku',start:'2027-01-15T09:00',end:'2027-01-15T10:00',location:'私人考点甲',from:'',travelMinutes:null},
    ]};
  assert.equal((await call('GET',null)).status,401);
  assert.equal((await call('POST','A',{...plan,year:1900})).status,400);
  assert.equal((await call('POST','A',{...plan,exams:[{...plan.exams[0],start:'2027-02-29T10:30'}]})).status,400);
  assert.equal((await call('POST','A',plan,{Origin:'https://other.invalid'})).status,403);
  const preview=await call('POST','A',plan);
  assert.equal(preview.status,200,JSON.stringify(preview.data));
  assert.equal(preview.data.analysis.conflicts[0].status,'conflict');
  assert.ok(preview.data.analysis.results.every(x=>x.status==='conditional'&&x.historical));
  assert.equal((await call('GET','A')).data.plan,null);
  const created=await call('PUT','A',{plan,version:null,ownerId:'B'});
  assert.equal(created.status,200,JSON.stringify(created.data));
  assert.match(created.cache,/no-store/);
  assert.equal((await call('GET','B')).data.plan,null);
  assert.equal((await call('PUT','B',{plan,version:created.data.version})).status,409);
  assert.equal((await call('DELETE','B',undefined,{'If-Match':created.data.version})).status,409);
  assert.equal((await call('GET','A')).data.plan.exams[0].travelMinutes,45);
  const updates=await Promise.all([1,2].map(i=>call('PUT','A',{plan:{...plan,language:i===1?'法语':'日语'},version:created.data.version})));
  assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
  const saved=await call('GET','A');
  assert.equal((await call('DELETE','A',undefined,{'If-Match':created.data.version})).status,409);
  assert.equal((await call('DELETE','A',undefined,{'If-Match':saved.data.version})).status,200);
  assert.equal((await call('GET','A')).data.plan,null);
  assert.equal((await db.prepare('SELECT count(*) AS count FROM admissions_plans').first()).count,0);
  console.log('PASS: admission plans validate input, keep historical policies conditional, check schedules, enforce account isolation and version concurrent saves and deletion.');
}finally{await mf.dispose();}
