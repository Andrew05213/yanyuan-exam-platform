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

const {parsePages}=globalThis.ExamImportParser;
const acrossPages=parsePages([
 '1. 跨页题\nA. 甲\nB. 乙\n第 1 页',
 'C. 丙\nD. 丁\n2. 另一题\nA. 春 B. 夏 C. 秋 D. 冬',
 '参考答案\n1. B\n2 C'
]);
assert.deepEqual(acrossPages.questions.map(q=>[q.sourcePage,q.answer]),[[1,'B'],[2,'C']]);
assert.deepEqual(acrossPages.questions[0].options,['甲','乙','丙','丁']);
const repeated=parsePages([
 '1. 第一节\nA. 甲 B. 乙 C. 丙 D. 丁',
 '1. 第二节\nA. 春 B. 夏 C. 秋 D. 冬\n答案：D',
 '答案汇总：1.B'
]);
assert.deepEqual(repeated.questions.map(q=>[q.sourcePage,q.answer]),[[1,''],[2,'D']]);
assert.ok(repeated.warnings.some(item=>item.includes('原题号重复')));
assert.equal(parsePages([question,'Answer key\n1. B 1. D']).questions[0].answer,'');

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
let saved;
const pdfUI=vm.runInNewContext(code+'\nExamImports',{
 readExamPdf:async()=>[
  '1. 第一节\nA. 甲 B. 乙 C. 丙 D. 丁\n答案：B',
  '1. 第二节\nA. 春 B. 夏 C. 秋 D. 冬\n答案：D'
 ],
 ExamImportParser:globalThis.ExamImportParser
});
pdfUI.record={id:'sample',revision:1,filename:'test.pdf',groups:[]};
pdfUI.controller=new AbortController();
pdfUI.request=async(query,body)=>{saved=JSON.parse(JSON.stringify(body));};
pdfUI.load=async()=>{};
await pdfUI.extractPdf({});
assert.equal(saved.approved,false);
assert.deepEqual(saved.groups.map(g=>[g.locator,g.questions[0].sourceNumber,g.questions[0].sourcePage]),[['第1页',1,1],['第2页',1,2]]);
assert.equal(saved.groups[0].pdfPages.length,2);
console.log('PASS: cross-page PDF questions, multiline keys, repeated numbering and lossless JSON validation.');
