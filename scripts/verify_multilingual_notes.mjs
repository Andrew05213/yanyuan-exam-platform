import assert from 'node:assert/strict';
import {validEntry,parseBackup,workReadingNote,workNotePrefix} from '../app/literature/notes.ts';
const legacy={id:'note_legacy',title:'原笔记',content:'原文',status:'在读'};
assert.ok(validEntry(legacy));
const note={...legacy,language:'ไทย',sourceLanguage:'العربية / 日本語',discipline:'经济学'};
assert.ok(validEntry(note));
assert.deepEqual(parseBackup({format:'hezhi-notes-v1',entries:[legacy,note]}),[legacy,note]);
assert.ok(validEntry({...note,language:null,sourceLanguage:'',discipline:null}));
for(const field of ['language','sourceLanguage','discipline']){
 assert.equal(validEntry({...note,[field]:123}),false);
 assert.equal(validEntry({...note,[field]:'a'.repeat(101)}),false);
}

const work={id:'test-work',title:'作品标题'};
const original={...note,id:work.id,title:work.title};
const archived={...original,folder:'archived'};
const independent={...note,id:'note_other',workId:work.id,title:'另一个观点'};
const attempt={...note,id:'note_interview',workId:work.id,title:work.title,tags:'面试复练'};
const legacyReplacement={...note,id:'note_replacement',workId:work.id,title:work.title,status:'已读'};
const replacement={...legacyReplacement,id:workNotePrefix+'replacement',title:'换了标题的作品笔记'};
assert.equal(workReadingNote([replacement,original],work),original);
assert.equal(workReadingNote([independent,attempt,archived],work),archived);
assert.equal(workReadingNote([independent,attempt,legacyReplacement,archived],work),legacyReplacement);
assert.equal(workReadingNote([independent,replacement,{...original,folder:'trash'}],work),replacement);
assert.equal(workReadingNote([{...replacement,folder:'trash'},{...original,folder:'trash'}],work),undefined);
console.log('PASS: legacy backups, multilingual metadata and work reading notes across archive, trash and replacement.');
