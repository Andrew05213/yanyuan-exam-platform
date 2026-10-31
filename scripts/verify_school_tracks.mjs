import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),hub=JSON.parse(read('public/schools.json')),bank=JSON.parse(read('public/bank.json')),wf=JSON.parse(read('public/workflows.json')),diff=JSON.parse(read('public/difficulty.json'));
const ctx=vm.createContext({console,Math,Date,JSON,Number,Set,Map,Error,String,Array,Object});for(const f of ['hub-engine','workflows-engine','difficulty-engine'])vm.runInContext(read('public/'+f+'.js'),ctx);
assert.equal(hub.schools.length,10);assert.equal(hub.oralItems.length,97);assert.equal(hub.writtenExtra.length,50);
for(const s of hub.schools){assert(s.languageIds.length);assert(s.languageIds.includes(s.defaultLanguageId));for(const id of s.languageIds){assert(hub.languages[id]);const p=ctx.HubEngine.oralPool(hub,s.id,id);assert(p.every(q=>!q.countryLanguageId||q.countryLanguageId===id));}}
assert.deepEqual(hub.schools.find(s=>s.id==='thu').languageIds,['ja']);
const jp=ctx.HubEngine.oralPool(hub,'pku','ja'),fr=ctx.HubEngine.oralPool(hub,'pku','fr');assert(jp.some(q=>q.type==='japan'));assert(fr.some(q=>q.type==='france'));assert(!fr.some(q=>q.type==='japan'));assert(!fr.some(q=>q.id==='fr-learning'));
assert.deepEqual(Array.from(jp.filter(q=>!q.countryLanguageId),q=>q.id),Array.from(fr.filter(q=>!q.countryLanguageId),q=>q.id));
assert.equal(ctx.HubEngine.oralPool(hub,'pku','ar').filter(q=>q.countryLanguageId).length,0);
assert.throws(()=>ctx.HubEngine.makeOral({hub,schoolId:'thu',languageId:'fr'}));
const oral=ctx.HubEngine.makeOral({hub,schoolId:'pku',languageId:'fr'});assert.equal(oral.languageId,'fr');assert(oral.items.some(q=>q.type==='france'));assert(!oral.items.some(q=>q.type==='japan'));
for(const id of ['whu','sisu','nju','fudan']){
 const school=hub.schools.find(s=>s.id===id);assert(!school.outlineOnly);assert.equal(school.examStandardStatus,'pending');
 const written=ctx.HubEngine.makeWritten({bank,hub,schoolId:id,subject:'英语',scope:'grammar',count:5});assert.equal(written.count,5);assert.match(written.note,/考试标准待补充/);
 const oral=ctx.HubEngine.makeOral({hub,schoolId:id,languageId:'ja',type:'reading',count:1});assert.equal(oral.count,1);assert.match(oral.note,/考试标准待补充/);
 const session=ctx.HubEngine.makeOral({hub,schoolId:id,languageId:'ja'});assert.equal(session.count,3);assert(session.items.some(q=>q.type==='japan'));
 const mixed=ctx.WorkflowEngine.makePacket({bank,hub,data:wf,config:{...wf.profiles[id],excludeAttempted:false}});assert(mixed.count>0);assert.match(mixed.note,/考试标准待补充/);
 const config=ctx.DifficultyEngine.defaults('英语',id,diff,wf.profiles);config.excludeAttempted=false;const tier=ctx.DifficultyEngine.makePacket(diff,config,hub);assert(tier.count>0);assert.match(tier.note,/考试标准待补充/);
}
console.log('PASS: ten schools, verified language lists, language-specific country filtering, unchanged common pool, missing-stock errors, immutable target snapshots and four new schools generate generic written/oral practice with pending-standard labels.');
