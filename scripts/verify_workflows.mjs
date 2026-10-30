import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const bank=JSON.parse(read('public/bank.json')),hub=JSON.parse(read('public/schools.json')),data=JSON.parse(read('public/workflows.json'));
const ctx=vm.createContext({Math,Date,JSON,Number,Set,Map,Error,String,Array,Object});
vm.runInContext(read('public/hub-engine.js'),ctx);vm.runInContext(read('public/workflows-engine.js'),ctx);const E=ctx.WorkflowEngine;
let seed=137;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
for(const profile of Object.values(data.profiles))for(let trial=0;trial<15;trial++){
 const packet=E.makePacket({bank,hub,data,config:profile,state:{},rng});
 const qs=packet.blocks.flatMap(b=>b.questions);assert.equal(qs.length,packet.count);assert.equal(qs.reduce((n,q)=>n+q.points,0),100);assert.equal(new Set(qs.map(q=>q.sourceId)).size,qs.length);
 const answers=Object.fromEntries(qs.filter(q=>!['writing','translation'].includes(q.kind)).map(q=>[q.id,q.kind==='mc'?q.answer:q.accepted[0]]));
 const manual=Object.fromEntries(qs.filter(q=>['writing','translation'].includes(q.kind)).map(q=>[q.id,q.points]));
 assert.equal(E.grade(packet,answers,manual).total,100);
 if(qs.some(q=>q.kind==='writing'||q.kind==='translation'))assert.equal(E.grade(packet,answers).total,null,'Never invent a total before subjective grading');
 for(const block of packet.blocks.filter(b=>b.kind==='cloze'))for(const q of block.questions)assert(block.text.includes('['+q.id+']'),'Cloze text must match global question numbers');
 if(profile.schoolId==='speit')assert.equal(packet.blocks.filter(b=>b.kind==='fill').flatMap(b=>b.questions).length,20);
 const used=qs.map(q=>q.sourceId),pools=E.pools({bank,hub,data,config:{...profile,excludeAttempted:true},state:{attemptedIds:used}});assert(!Object.values(pools).flat().some(item=>(item.questions||[item]).some(q=>used.includes(q.sourceId))));
}
const sample=E.makePacket({bank,hub,data,config:data.profiles.pku,rng}),mc=sample.blocks.flatMap(b=>b.questions).filter(q=>q.kind==='mc');
const input=mc.slice(0,3).map(q=>q.id+'ABCD'.split('').find(a=>a!==q.answer)).join('、');
const errors=E.parseErrors(input,sample);assert.equal(errors.entries.length,3);assert.equal(errors.unreported,sample.count-3);
assert.equal(E.parseErrors(mc[0].id+mc[0].answer,sample).entries.length,0,'A reported correct option is not a mistake');
assert.throws(()=>E.parseErrors('999A',sample));assert.throws(()=>E.parseErrors('3B、3C',sample));assert.throws(()=>E.parseErrors('3B extra',sample));
const adjusted=E.parseAdjustment('阅读2篇、语法填空20题、不要作文、45分钟、不重复',data.profiles.speit);assert.equal(adjusted.config.readingCount,2);assert.equal(adjusted.config.fillCount,20);assert.equal(adjusted.config.writingCount,0);assert.equal(adjusted.config.minutes,45);assert.equal(adjusted.unhandled,'');
const unknown=E.parseAdjustment('阅读2篇，并加入莎士比亚戏剧表演',data.profiles.pku);assert(unknown.unhandled.includes('莎士比亚'),'Unknown instructions must remain visible');
console.log('PASS: 90 school-specific mixed papers, numbering/weights, objective vs subjective scores, non-silent deduplication, strict quick-error parsing, and reviewed adjustments.');
