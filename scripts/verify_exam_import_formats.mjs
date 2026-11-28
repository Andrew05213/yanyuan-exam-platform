import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../public/exam-import-parser.js';

const question='1. 示例\nA. 甲 B. 乙 C. 丙 D. 丁\n';
const answer=lines=>globalThis.ExamImportParser.parse(question+lines).questions[0].answer;
assert.equal(answer('参考答案：B'),'B');
assert.equal(answer('答案：B\n参考答案：1.B'),'B');
assert.equal(answer('答案：B\n答案：C'),'');
assert.equal(answer('参考答案：1.B 1.C 1.C'),'');
assert.equal(answer('答案：B\n解析：举例\n答案：C'),'B');

const code=readFileSync(new URL('../public/exam-imports.js',import.meta.url),'utf8');
const ui=vm.runInNewContext(code+'\nExamImports');
let message='';
ui.msg=value=>{message=value;};
ui.editor=()=>{};
const original=[{questions:[]}];
ui.groups=original;
const extract=groups=>ui.extract({name:'fixture.json',text:async()=>JSON.stringify({groups})});
for(const invalid of [Array(11).fill({questions:[]}),[null],[{questions:[{kind:'mc',options:42}]}],Array(3).fill({questions:Array(40).fill({kind:'fill'})})]){
 await extract(invalid);
 assert.equal(ui.groups,original);
 assert.match(message,/读取失败/);
}
await extract([{questions:[{kind:'mc',options:['一','二','三','四']}]}]);
assert.equal(ui.groups[0].questions[0].options.length,4);
console.log('PASS: explicit answers, conflicting keys and lossless JSON group validation.');
