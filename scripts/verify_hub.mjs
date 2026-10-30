import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const root=new URL('../',import.meta.url);
const bank=JSON.parse(fs.readFileSync(new URL('public/bank.json',root),'utf8'));
const hub=JSON.parse(fs.readFileSync(new URL('public/schools.json',root),'utf8'));
const context=vm.createContext({Math,Date,JSON,Number,Set,Map,Error,String,Array,Object});
vm.runInContext(fs.readFileSync(new URL('public/hub-engine.js',root),'utf8'),context);
const E=context.HubEngine;
assert.equal(hub.schools.length,6);
assert.equal(new Set(hub.oralItems.map(x=>x.id)).size,hub.oralItems.length);
assert.equal(hub.oralItems.filter(q=>q.type==='reading').length,5);
for(const q of hub.oralItems){
  assert(q.guide.length>=3&&q.followups.length>=2&&q.reference.length>30,q.id+' needs substantive support');
  assert(q.schoolIds.every(s=>hub.schools.some(x=>x.id===s)),q.id+' unknown school');
  if(q.type==='reading')assert(q.source.url&&q.source.kind==='真实作家原文');
}
let seed=17;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let n=0;n<40;n++)for(const school of hub.schools){
  const p=E.makeOral({hub,schoolId:school.id,rng});
  assert.equal(p.items.length,school.oralRecipe.length);
  assert.equal(new Set(p.items.map(x=>x.id)).size,p.items.length);
  assert.deepEqual(Array.from(p.items,q=>q.type),school.oralRecipe);
  assert(p.items.every(q=>q.schoolIds.includes(school.id)));
  if(school.id==='speit')assert.notEqual(p.items.find(q=>q.type==='zh-en').id.slice(6),p.items.find(q=>q.type==='en-zh').id.slice(6),'Opposite translations must not use the same passage in one session');
  for(const subject of school.subjects){
    const p=E.makeWritten({bank,hub,schoolId:school.id,subject,count:subject==='语文'?25:20,rng});
    const qs=p.blocks.flatMap(b=>b.questions);
    assert.equal(qs.length,p.count);
    assert.equal(qs.reduce((n,q)=>n+q.points,0),100);
    assert.equal(new Set(qs.map(q=>q.sourceId)).size,qs.length);
    assert.deepEqual(Array.from(qs,q=>q.id),Array.from({length:p.count},(_,i)=>i+1));
    const correct=Object.fromEntries(qs.map(q=>[q.id,q.answer]));
    assert.equal(E.grade(p,correct).score,100);
    assert.equal(E.grade(p,{}).score,0);
    if(subject==='语文'){
      assert(p.blocks.some(b=>b.source.includes('鲁迅')&&b.title.includes('在酒楼上')));
      assert(p.blocks.some(b=>b.source.includes('芥川')&&b.title.includes('鼻子')));
    }
    if(subject==='英语')assert(p.blocks.some(b=>b.type==='reading'&&b.questions.length===5&&b.text));
  }
}
for(const scope of ['grammar','reading','cloze']){
  const count=scope==='cloze'?15:10;
  const p=E.makeWritten({bank,hub,schoolId:'speit',subject:'英语',scope,count,rng});
  assert.equal(p.blocks.flatMap(b=>b.questions).length,count);
  if(scope==='cloze')assert(p.blocks[0].text.length>400);
}
assert.throws(()=>E.makeWritten({bank,hub,schoolId:'speit',subject:'语文',count:25}));
assert.throws(()=>E.makeWritten({bank,hub,schoolId:'pku',subject:'英语',scope:'reading',count:7}));
assert.throws(()=>E.makeWritten({bank,hub,schoolId:'pku',subject:'数学',count:99}));
assert.throws(()=>E.makeOral({hub,schoolId:'pku',type:'france',count:1}));
assert.throws(()=>E.makeOral({hub,schoolId:'speit',level:'基础'}));
// Verify independently computed supplemental mathematical results.
const m=Object.fromEntries(hub.writtenExtra.filter(q=>q.subject==='数学').map(q=>[q.id,q]));
assert.equal(m.m01.options['ABCD'.indexOf(m.m01.answer)],'32');
let surjections=0;for(let n=0;n<3**5;n++){let k=n,seen=new Set();for(let i=0;i<5;i++){seen.add(k%3);k=Math.floor(k/3);}if(seen.size===3)surjections++;}
assert.equal(surjections,150);
let lattice=0;for(let x=0;x<=4;x++)for(let y=0;y<=4;y++)if(x+y<=4)lattice++;
assert.equal(lattice,15);
assert.equal(hub.writtenExtra.length,50);
console.log(`PASS: ${hub.schools.length} school profiles, ${hub.oralItems.length} supported oral tasks; 240 full oral sessions; written selection, passage integrity, grading, quota failures and supplemental math.`);
const uiContext=vm.createContext({crypto:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)},Uint8Array,Map,URL,Date,Set,String,JSON,Number,Array,Object});
vm.runInContext(fs.readFileSync(new URL('public/hub.js',root),'utf8'),uiContext);
const ids=vm.runInContext('Array.from({length:100},()=>Hub.id("packet"))',uiContext);
assert.equal(new Set(ids).size,100);
assert(ids.every(id=>/^packet-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)));
console.log('PASS: UUIDs also work in non-secure local previews without crypto.randomUUID.');
