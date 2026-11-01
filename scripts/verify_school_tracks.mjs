import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),hub=JSON.parse(read('public/schools.json')),bank=JSON.parse(read('public/bank.json')),wf=JSON.parse(read('public/workflows.json')),diff=JSON.parse(read('public/difficulty.json'));
const ctx=vm.createContext({console,Math,Date,JSON,Number,Set,Map,Error,String,Array,Object});for(const f of ['hub-engine','workflows-engine','difficulty-engine'])vm.runInContext(read('public/'+f+'.js'),ctx);
assert.equal(hub.schools.length,10);assert.equal(hub.oralItems.length,319);assert.equal(hub.writtenExtra.length,50);
for(const s of hub.schools){assert(s.languageIds.length);assert(s.languageIds.includes(s.defaultLanguageId));for(const id of s.languageIds){assert(hub.languages[id]);const p=ctx.HubEngine.oralPool(hub,s.id,id);assert(p.every(q=>!q.countryLanguageId||q.countryLanguageId===id));}}
assert.deepEqual(hub.schools.find(s=>s.id==='thu').languageIds,['ja']);
const jp=ctx.HubEngine.oralPool(hub,'pku','ja'),fr=ctx.HubEngine.oralPool(hub,'pku','fr');assert(jp.some(q=>q.type==='japan'));assert(fr.some(q=>q.type==='france'));assert(!fr.some(q=>q.type==='japan'));assert(!fr.some(q=>q.id==='fr-learning'));
assert.deepEqual(Array.from(jp.filter(q=>!q.countryLanguageId),q=>q.id),Array.from(fr.filter(q=>!q.countryLanguageId),q=>q.id));
assert(ctx.HubEngine.oralPool(hub,'pku','ar').filter(q=>q.countryLanguageId).length>=6);
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
console.log('PASS: ten schools, configured language lists, language-specific country filtering, unchanged common pool, quota errors, immutable target snapshots and four new schools generate generic written/oral practice with pending-standard labels.');


// Every advertised school/language must generate country-only and combined practice.
const catalog=JSON.parse(read('content/school-tracks.json'));
assert.deepEqual(hub.schools,catalog.schools);
assert.deepEqual(hub.languages,catalog.languages);
assert.deepEqual(hub.schools.find(s=>s.id==='pku').languageIds,['es','de','fr','ja','ar','ko','hi','he','sa-pi','ru','ur']);
assert.equal(hub.schools[0].languagePolicy.trainingListSource.officiallyVerified,false);
const ids=new Set(hub.oralItems.map(q=>q.id));assert.equal(ids.size,hub.oralItems.length);
let pairs=0;
for(const school of hub.schools)for(const lang of school.languageIds){
 const type=hub.languages[lang].countryType,pool=ctx.HubEngine.oralPool(hub,school.id,lang),country=pool.filter(q=>q.type===type);
 assert(country.length>=6,school.id+'/'+lang+' lacks stock');
 for(const level of ['基础','进阶','挑战']){
  const p=ctx.HubEngine.makeOral({hub,schoolId:school.id,languageId:lang,type,level,count:1});
  assert.equal(p.items.length,1);assert.equal(p.items[0].countryLanguageId,lang);assert.equal(p.items[0].level,level);
 }
 const p=ctx.HubEngine.makeOral({hub,schoolId:school.id,languageId:lang,type,count:5});
 assert.equal(p.count,5);assert.equal(new Set(p.items.map(q=>q.id)).size,5);
 assert(p.items.every(q=>q.countryLanguageId===lang));
 const session=ctx.HubEngine.makeOral({hub,schoolId:school.id,languageId:lang});
 assert(session.items.some(q=>q.countryLanguageId===lang));
 assert(session.items.every(q=>!q.countryLanguageId||q.countryLanguageId===lang));
 assert.equal(session.languageId,lang);
 const copy=p.items[0].title;p.items[0].title='snapshot edit';assert(country.some(q=>q.title===copy));
 assert(country.every(q=>q.guide.length>=3&&q.followups.length>=2&&q.reference&&q.source));pairs++;
}
// Legacy packets keep their target ID; an old selection removed from PKU falls back.
const dom={};const ui=vm.createContext({Hub:{data:hub,school:'pku',schoolById:id=>hub.schools.find(s=>s.id===id)},HubEngine:ctx.HubEngine,document:{querySelector:s=>dom[s]||null}});
vm.runInContext(read('public/school-tracks.js')+';globalThis.Tracks=SchoolTracks;',ui);
ui.Tracks.choices.pku='pt';assert.equal(ui.Tracks.language('pku'),'ja');
ui.Tracks.choices.pku='es';assert.equal(ui.Tracks.language('pku'),'es');
dom['#hub-type']={value:'country-es'};dom['#hub-count']={value:'5'};dom['#hub-studio [name="level"]']={value:'基础'};dom['#hub-pool-info']={};
ui.Tracks.syncOralCount();assert.equal(dom['#hub-count'].value,'2');assert(!dom['#hub-count'].innerHTML.includes('value="5"'));assert.equal(dom['#hub-count'].disabled,false);
dom['#hub-type'].value='session';ui.Tracks.syncOralCount();assert.equal(dom['#hub-count'].disabled,true);
dom['#hub-type'].value='country-es';dom['#hub-studio [name="level"]'].value='all';ui.Tracks.syncOralCount();assert.equal(dom['#hub-count'].disabled,false);assert(dom['#hub-count'].innerHTML.includes('value="5"'));
console.log(`PASS: ${pairs} school/language pairs, country-only samples, all-level sessions, three difficulty bands, unique IDs, target isolation, legacy selection fallback and stock-aware count controls.`);
