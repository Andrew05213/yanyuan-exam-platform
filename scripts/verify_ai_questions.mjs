// Verifies the AI topic-generation contract without a model or network:
// request planning, prompt constraints, strict JSON parsing and item
// normalization/rejection. Run with:
//   node --experimental-strip-types scripts/verify_ai_questions.mjs
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {
  AI_COUNTS,
  AI_TYPES,
  generationPlan,
  parseGeneration,
  promptFor,
} from "../lib/ai-question-generation.ts";
import { validateBankItem } from "../lib/question-bank-contracts.ts";
import { AI_GENERATION_LIMITS, REQUEST_ID_PATTERN, evaluateQuota, quotaMessage } from "../lib/ai-question-limits.ts";

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}
function rejects(name, fn, pattern) {
  ok(name, () => {
    let message = "";
    try {
      fn();
    } catch (error) {
      message = error.message;
    }
    assert.ok(message, "expected an error");
    if (pattern) assert.match(message, pattern);
  });
}

const passage = "Cities across East Asia are redesigning public space around heat and ageing populations. " .repeat(8);

function readingFixture(count = 3) {
  return JSON.stringify({
    items: [
      {
        title: "城市热浪与公共空间",
        text: passage,
        paragraphs: [passage],
        sourceNote: "AI 生成；非官方真题，未经人工审核。",
        questions: Array.from({ length: count }, (_, index) => ({
          stem: `第 ${index + 1} 题：作者对改造公共空间的态度是什么？`,
          options: ["完全否定", "有条件支持", "漠不关心", "主张立即停止"],
          answer: "B",
          analysis: "文章承认成本压力，但整体支持以降温为目标的改造。",
          tag: "作者态度",
        })),
      },
    ],
  });
}

function mcFixture(count = 3) {
  return JSON.stringify({
    items: Array.from({ length: count }, (_, index) => ({
      title: `日本国别 · 第 ${index + 1} 题`,
      text: "",
      paragraphs: [],
      sourceNote: "AI 生成；非官方真题，未经人工审核。",
      questions: [
        {
          stem: `关于日本近代教育制度，下列说法正确的是（${index + 1}）`,
          options: ["选项一", "选项二", "选项三", "选项四"],
          answer: "C",
          analysis: "依据学制改革的时间线判断。",
          tag: "教育制度",
        },
      ],
    })),
  });
}

function oralFixture(count = 2) {
  return JSON.stringify({
    items: Array.from({ length: count }, (_, index) => ({
      title: `文学口试 · 第 ${index + 1} 题`,
      text: "",
      paragraphs: [],
      sourceNote: "AI 生成；非官方真题，未经人工审核。",
      questions: [
        {
          stem: `请结合一部作品谈谈“物哀”与叙事距离的关系（${index + 1}）`,
          options: [],
          answer: "",
          analysis: "能区分概念、举证并回应反例。",
          tag: "物哀",
          reference: "先界定物哀，再举《源氏物语》例证，最后讨论限度。",
          guide: ["界定概念", "举一个文本细节", "回应反例"],
          followups: ["如果作品并不悲伤，仍可能物哀吗？"],
        },
      ],
    })),
  });
}

const readingPlan = generationPlan({ subject: "英语", type: "reading", difficulty: "进阶", topic: "城市热浪", count: 3 });
ok("reading, country and oral difficulty change the task requirements", ()=>{
 const bands=["基础","进阶","挑战"];
 const reading=bands.map(difficulty=>promptFor(generationPlan({subject:"英语",type:"reading",difficulty,topic:"城市热浪",count:3})));
 for(const [i,[range,skill]] of [["350–500","直接定位"],["550–800","整合两处"],["800–1000","多步推断"]].entries()){
  assert.ok(reading[i].includes(range)&&reading[i].includes(skill));
 }
 for(const [subject,type,count,rules] of [["日本国别","mc",3,["直接定位","易混概念","决定性区别"]],["文学口试","oral",2,["具体例子","补充依据","回应反例"]]]){
  for(const [i,difficulty] of bands.entries()){
   assert.ok(promptFor(generationPlan({subject,type,difficulty,topic:"同一专题",count})).includes(rules[i]));
  }
 }
});
ok("reading plan is accepted", () => assert.equal(readingPlan.section, "reading"));
ok("reading prompt keeps passage and count constraints", () => {
  const prompt = promptFor(readingPlan);
  assert.match(prompt, /550–800/);
  assert.match(prompt, /3 道单选题/);
  assert.match(prompt, /禁止|不得/);
});
ok("country plan selects country section", () => {
  assert.equal(generationPlan({ subject: "日本国别", type: "mc", difficulty: "基础", topic: "教育", count: 3 }).section, "country");
});
ok("oral plan selects oral section", () => {
  assert.equal(generationPlan({ subject: "文学口试", type: "oral", difficulty: "挑战", topic: "物哀", count: 2 }).section, "oral-country");
});

rejects("unknown subject rejected", () => generationPlan({ subject: "物理", type: "mc", difficulty: "进阶", topic: "x", count: 3 }), /科目/);
rejects("subject/type mismatch rejected", () => generationPlan({ subject: "日本国别", type: "reading", difficulty: "进阶", topic: "x", count: 3 }), /题型/);
rejects("too many reading questions rejected", () => generationPlan({ subject: "英语", type: "reading", difficulty: "进阶", topic: "x", count: 99 }), /题量/);
rejects("topic injection rejected", () => generationPlan({ subject: "英语", type: "mc", difficulty: "进阶", topic: "<script>", count: 3 }), /主题/);
rejects("extra request field rejected", () => generationPlan({ subject: "英语", type: "mc", difficulty: "进阶", topic: "x", count: 3, apiKey: "x" }), /字段/);

const readingItems = parseGeneration(readingFixture(3), readingPlan);
ok("reading fixture parsed with stable ids", () => {
  assert.equal(readingItems.length, 1);
  assert.equal(readingItems[0].questions.length, 3);
  assert.match(readingItems[0].id, /^ai-[a-f0-9-]{36}$/);
  assert.equal(readingItems[0].questions[0].id, `${readingItems[0].id}:q1`);
  assert.equal(readingItems[0].questions[0].answer, "B");
});
ok("saved item round-trips through bank validation", () => {
  const stored = JSON.parse(JSON.stringify(readingItems[0]));
  const validated = validateBankItem(stored);
  assert.equal(validated.title, readingItems[0].title);
  assert.equal(validated.questions[2].stem, readingItems[0].questions[2].stem);
});

const mcPlan = generationPlan({ subject: "日本国别", type: "mc", difficulty: "进阶", topic: "教育", count: 3 });
ok("country MCQ fixture parsed", () => assert.equal(parseGeneration(mcFixture(3), mcPlan).length, 3));
const oralPlan = generationPlan({ subject: "文学口试", type: "oral", difficulty: "进阶", topic: "物哀", count: 2 });
ok("oral fixture parsed with guide and followups", () => {
  const items = parseGeneration(oralFixture(2), oralPlan);
  assert.equal(items.length, 2);
  assert.equal(items[0].questions[0].guide.length, 3);
  assert.equal(items[0].questions[0].followups.length, 1);
});

ok("fenced JSON is tolerated", () => parseGeneration("```json\n" + readingFixture(3) + "\n```", readingPlan));
ok("JSON surrounded by prose is recovered", () => parseGeneration("好的，以下是题目：\n" + readingFixture(3) + "\n请核对。", readingPlan));

rejects("count mismatch rejected", () => parseGeneration(readingFixture(4), readingPlan), /题量不一致/);
rejects("three options rejected", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].questions[0].options = ["甲", "乙", "丙"];
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /4 个选项/);
rejects("duplicate options rejected", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].questions[0].options = ["甲", "甲", "乙", "丙"];
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /选项重复/);
rejects("invalid answer rejected", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].questions[0].answer = "E";
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /A\/B\/C\/D/);
rejects("empty analysis rejected", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].questions[0].analysis = " ";
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /解析/);
rejects("HTML rejected", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].questions[0].stem = "<b>题干</b>";
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /纯文本/);
rejects("oral without reference rejected", () => {
  const fixture = JSON.parse(oralFixture(2));
  fixture.items[0].questions[0].reference = "";
  parseGeneration(JSON.stringify(fixture), oralPlan);
}, /参考回答/);
rejects("short reading passage rejected", () => {
  const fixture = JSON.parse(readingFixture(3));
  fixture.items[0].text = "too short";
  parseGeneration(JSON.stringify(fixture), readingPlan);
}, /过短/);
rejects("duplicate stems rejected", () => {
  const fixture = JSON.parse(readingFixture(3));
  fixture.items[0].questions[1].stem = fixture.items[0].questions[0].stem;
  parseGeneration(JSON.stringify(fixture), readingPlan);
}, /重复/);
rejects("tampered bank id rejected", () => {
  const stored = JSON.parse(JSON.stringify(readingItems[0]));
  stored.id = "ai-not-a-uuid";
  validateBankItem(stored);
}, /编号/);
rejects("tampered question id rejected", () => {
  const stored = JSON.parse(JSON.stringify(readingItems[0]));
  stored.questions[0].id = "ai-other:q1";
  validateBankItem(stored);
}, /编号不连续/);

ok("subject matrix covers the three priority areas", () => {
  assert.deepEqual(Object.keys(AI_TYPES), ["英语", "语文", "数学", "日本国别", "文学口试"]);
  assert.equal(AI_COUNTS.reading.options.at(-1), 5);
});

// ---- server-side limits -------------------------------------------------
const now = Date.parse("2026-11-19T12:00:00.000Z");
const row = (minutesAgo, status = "succeeded") => ({ createdAt: new Date(now - minutesAgo * 60000).toISOString(), status });
ok("first request inside quota", () => {
  const decision = evaluateQuota([], now);
  assert.equal(decision.allowed, true);
  assert.equal(decision.remaining, AI_GENERATION_LIMITS.maxPerWindow - 1);
});
ok("per-window limit blocks the 7th request", () => {
  const rows = Array.from({ length: AI_GENERATION_LIMITS.maxPerWindow }, (_, i) => row(i));
  const decision = evaluateQuota(rows, now);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "window");
  assert.ok(decision.retryAfterSeconds > 0 && decision.retryAfterSeconds <= 600);
  assert.match(quotaMessage(decision), /请求过于频繁/);
});
ok("old rows outside the window do not count", () => {
  const rows = Array.from({ length: 5 }, (_, i) => row(20 + i));
  assert.equal(evaluateQuota(rows, now).allowed, true);
});
ok("daily cap blocks after 30 requests", () => {
  const rows = Array.from({ length: AI_GENERATION_LIMITS.maxPerDay }, (_, i) => row(11 + i * 20));
  const decision = evaluateQuota(rows, now);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "daily");
  assert.match(quotaMessage(decision), /今日/);
});
ok("request ids must be unguessable-length tokens", () => {
  assert.equal(REQUEST_ID_PATTERN.test("3f1c2a9e-8d4b-4c7a-9e2f-1a2b3c4d5e6f"), true);
  assert.equal(REQUEST_ID_PATTERN.test("short"), false);
  assert.equal(REQUEST_ID_PATTERN.test("bad id with spaces"), false);
});
rejects("single request cannot exceed the global cap", () => generationPlan({ subject: "英语", type: "mc", difficulty: "进阶", topic: "x", count: 11 }), /题量/);
rejects("reading request cannot exceed 6", () => generationPlan({ subject: "英语", type: "reading", difficulty: "进阶", topic: "x", count: 7 }), /题量/);

rejects("country knowledge questions reject attached passages", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].text = "这是一段不应出现的阅读材料。";
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /不应附阅读材料/);
rejects("country questions must use a Chinese stem", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].questions[0].stem = "次の記述のうち、正しいものはどれか。";
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /中文题干/);
rejects("all-of-the-above options are rejected", () => {
  const fixture = JSON.parse(mcFixture(3));
  fixture.items[0].questions[0].options = ["甲", "乙", "丙", "以上都对"];
  parseGeneration(JSON.stringify(fixture), mcPlan);
}, /以上都对/);

const awarePlan = generationPlan({ subject: "日本国别", type: "mc", difficulty: "进阶", topic: "物哀", count: 5 });
function awareFixture(firstStem) {
  const fixture = JSON.parse(mcFixture(5));
  const stems = [
    firstStem, "日本文化中，哪种审美概念强调对事物的感受？",
    "在日本文学中，物哀与季节变化有怎样的关联？",
    "日文中，用哪个词指称物哀？", "本居宣长如何理解物哀？",
  ];
  fixture.items.forEach((item, i) => { item.questions[0].stem = stems[i]; });
  return JSON.stringify(fixture);
}
ok("物哀 five-question set accepts 日本文学 and 日本文化", () => {
  assert.equal(parseGeneration(awareFixture("哪部日本文学作品常被用于讨论物哀？"), awarePlan).length, 5);
});
for (const stem of ["根据上文，作者怎样理解日本文化？", "本文如何解读物哀？", "文中哪一处体现了物哀？"]) {
  rejects(stem, () => parseGeneration(awareFixture(stem), awarePlan), /不存在的上文/);
}

let packet;
const studio=runInNewContext(readFileSync(new URL("../public/ai-questions.js",import.meta.url),"utf8")+"\nAIStudio",{
  document:{getElementById:id=>({value:id==="ai-subject"?"英语":40})},
  Hub:{createPacket:value=>{packet=value;}},
});
const basic={id:"basic",subject:"英语",difficulty:"基础"};
const advanced={id:"advanced",subject:"英语",difficulty:"挑战"};
studio.state.bank=[{item:basic},{item:advanced},{item:{id:"other",subject:"日本国别",difficulty:"挑战"}}];
studio.state.items=[basic,{id:"new",subject:"英语",difficulty:"挑战"}];
studio.state.selected=new Set(["basic","new"]);
studio.state.bankTier="挑战";
studio.writtenPacket=items=>Array.from(items,item=>item.id);
await studio.compose("bank");
ok("personal-bank composition uses the chosen subject and difficulty",()=>assert.deepEqual(packet,["advanced"]));
await studio.compose("mixed");
ok("mixed personal-bank composition retains the chosen difficulty",()=>assert.deepEqual(packet,["new","advanced"]));

const catalog=JSON.parse(readFileSync(new URL("../public/difficulty.json",import.meta.url),"utf8"));
const sections=["reading","cloze","gap-seven","literary","writing","correction","zh-en","en-zh"];
const vmContext={
 document:{getElementById:()=>({value:"Fixture"})},
 Hub:{school:"pku",schoolById:()=>({name:"Fixture",track:"英语",short:"Fixture"}),e:String},
};
vmContext.WorkflowEngine=runInNewContext(readFileSync(new URL("../public/workflows-engine.js",import.meta.url),"utf8")+"\nWorkflowEngine",vmContext);
const writingStudio=runInNewContext(readFileSync(new URL("../public/ai-questions.js",import.meta.url),"utf8")+"\nAIStudio",vmContext);
function fixtureFor(section){
 const unit=catalog.items.find(item=>item.section===section);
 const item={title:unit.title,text:unit.text??"",questions:unit.questions.map(q=>({...q}))};
 if(section==="reading"){
  item.text=passage;
  item.questions=JSON.parse(readingFixture(3)).items[0].questions;
 }
 if(section==="cloze"){
  item.text="Students investigated a public problem before writing a report that explained their reasoning. "
   +Array.from({length:5},(_,i)=>"["+(i+1)+"]").join(" ");
  item.questions=JSON.parse(mcFixture(5)).items.map(unit=>unit.questions[0]);
 }
 if(section==="gap-seven"){
  const q=item.questions[0];
  q.options=Object.values(q.paragraphs);
  q.answer=q.accepted[0];
 }
 if(["zh-en","en-zh"].includes(section))item.text=item.questions[0].text;
 if(section==="writing")item.questions[0].reference="The discussion began with a shared problem and ended with a proposal.";
 return item;
}
const englishItems=sections.flatMap(section=>{
 const fixture=fixtureFor(section);
 const plan=generationPlan({subject:"英语",type:section,difficulty:"进阶",count:fixture.questions.length,topic:"城市生活"});
 const result=parseGeneration(JSON.stringify({items:[fixture]}),plan);
 ok(section+" survives AI generation and personal bank validation",()=>assert.deepEqual(validateBankItem(result[0]),result[0]));
 return result;
});
ok("AI questions from all eight sections make one valid paper",()=>{
 const packet=writingStudio.writtenPacket(englishItems,"英语",60);
 assert.deepEqual(Array.from(packet.blocks,b=>b.kind),sections);
 assert.match(packet.blocks[1].text,/\[4\].*\[8\]/s);
 assert.equal(Object.keys(packet.blocks[2].questions[0].paragraphs).length,7);
 assert.equal(packet.blocks[4].questions[0].kind,"writing");
 assert.equal(packet.blocks[5].questions[0].kind,"fill");
 assert.match(packet.blocks[6].questions[0].text,/\p{Script=Han}/u);
 assert.equal(packet.blocks[7].questions[0].kind,"translation");
});
rejects("seven options require five distinct answers",()=>{
 const fixture=fixtureFor("gap-seven");
 fixture.questions[0].answer="AAAAB";
 return parseGeneration(JSON.stringify({items:[fixture]}),generationPlan({subject:"英语",type:"gap-seven",difficulty:"进阶",count:1,topic:"衔接"}));
},/不重复/);


const newSpecs=[["语文","cn-modern","现代文阅读（简答）",[2,3,4]],["语文","cn-classical","文言文阅读（理解与翻译）",[2,3,4]],["语文","cn-poem","古诗词鉴赏（简答）",[1,2,3]],["语文","cn-language","语言文字运用（单选）",[3,5,10]],["语文","cn-literary","文学文化常识（单选）",[3,5,10]],["语文","cn-writing","语文作文",[1,2]],["数学","math-mc","数学单项选择",[3,5,10]],["数学","math-fill","数学填空",[3,5,10]],["数学","math-solution","数学解答与证明",[1,2,3,5]]];
for(const [subject,type,label,counts] of newSpecs){
 const count=counts[0],plan=generationPlan({subject,type,difficulty:"进阶",topic:"专题训练",count});
 const reading=["cn-modern","cn-classical","cn-poem"].includes(type),mc=["cn-language","cn-literary","math-mc"].includes(type),fill=type==="math-fill";
 const material=reading?"清晨的校园里，树影与微风交织，作者细察身边的景物并探讨人与自然的关系。".repeat(12):"";
 const question=i=>({stem:"请分析第"+(i+1)+"题的依据与结论",analysis:"列出关键依据并验证结论。",tag:"考点",options:mc?["甲","乙","丙","丁"]:[],answer:mc?"B":"",...(fill?{accepted:["1/2","0.5"]}:!mc?{reference:"首先梳理条件，其次推导结论，最后进行检验。"}:{})});
 const raw={items:reading?[{title:label,text:material,questions:Array.from({length:count},(_,i)=>question(i))}]:Array.from({length:count},(_,i)=>({title:label,text:"",questions:[question(i)]}))};
 const items=parseGeneration(JSON.stringify(raw),plan);
 ok(label+" generates and round-trips through bank and written packet",()=>{
  assert.equal(items.length,reading?1:count);
  assert.equal(items[0].subject,subject);
  assert.deepEqual(validateBankItem(items[0]),items[0]);
  const packet=writingStudio.writtenPacket(items,subject,60);
  assert.equal(packet.subject,subject);
  assert.equal(packet.count,count);
  assert.equal(packet.blocks[0].questions[0].kind,mc?"mc":fill?"fill":"writing");
  assert.match(promptFor(plan),/原创/);
 });
 if(reading)rejects(label+" rejects absent reading material",()=>parseGeneration(JSON.stringify({items:[{...raw.items[0],text:""}]}),plan),/材料/);
 if(fill){const packet=writingStudio.writtenPacket(items,subject,60);ok("math fill accepts explicit equivalents, not punctuation-stripped variants",()=>{assert.equal(vmContext.WorkflowEngine.grade(packet,{1:"0.5"}).correct,1);assert.equal(vmContext.WorkflowEngine.grade(packet,{1:"0.5."}).correct,0);});}
 if(!mc&&!fill){const broken=JSON.parse(JSON.stringify(raw));delete broken.items[0].questions[0].reference;rejects(label+" rejects missing reference",()=>parseGeneration(JSON.stringify(broken),plan),/参考答案/);}
}
rejects("Chinese subject cannot use English cloze",()=>generationPlan({subject:"语文",type:"cloze",difficulty:"进阶",topic:"阅读",count:5}),/题型/);

console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
