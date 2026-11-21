import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBackup} from '../app/literature/notes.ts';
import {readDrafts,draftKey} from '../app/literature/drafts.ts';
import {formatReview} from '../app/literature/review-result.ts';
import {readingPaths} from '../app/literature/paths.ts';
import {oralLinks} from '../app/literature/oral-links.ts';
import {researchCatalog} from '../app/literature/research.ts';
const materialSource=readFileSync(new URL('../app/literature/data.ts',import.meta.url),'utf8');
const ids=new Set(researchCatalog.map(w=>w.id).concat([...materialSource.matchAll(/["]?id["]?:\s*"([^"]+)"/g)].map(m=>m[1])));
for(const path of readingPaths)for(const id of path.ids)assert(ids.has(id),id);
const schools=JSON.parse(readFileSync(new URL('../public/schools.json',import.meta.url)));
for(const link of oralLinks){
 assert.deepEqual(schools.oralItems.find(q=>q.id===link.id)?.readingIds,link.works);
 for(const id of link.works)assert(ids.has(id),id);
}
for(const w of researchCatalog)assert(new URL(w.source).protocol==='https:'&&w.guide&&w.question,w.id);
const note={id:'note_test',title:'读书',content:'未保存',status:'在读'};
const map=new Map([[draftKey('A',note.id),JSON.stringify(note)],[draftKey('B','other'),'{}'],[draftKey('A','bad'),'broken']]);
const storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)};
assert.deepEqual(readDrafts(storage,'A'),[note]);assert.deepEqual(readDrafts(storage,'B'),[]);
assert.deepEqual(parseBackup({format:'hezhi-notes-v1',entries:[note]}),[note]);
assert.throws(()=>parseBackup({format:'hezhi-notes-v1',entries:[{...note,tags:42}]}));
const v={quote:'车窗',evidenceQuote:'倒影',strength:'指出视角',gap:'观察者的偏见',suggestion:'补出原句',questions:['倒影改变了什么？','换位后呢？']};
assert.match(formatReview(JSON.stringify(v),'倒影','车窗'),/追问 2/);
assert.throws(()=>formatReview(JSON.stringify(v),'倒影','桥'));
assert.throws(()=>formatReview(JSON.stringify({...v,questions:['a','a']}),'倒影','车窗'));
console.log('PASS: source metadata, reading routes, two-way practice links, scoped draft recovery, backup format and feedback evidence.');
