import assert from 'node:assert/strict';
import {validEntry,parseBackup} from '../app/literature/notes.ts';
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
console.log('PASS: legacy backups, arbitrary language labels, cross-language notes and metadata validation.');
