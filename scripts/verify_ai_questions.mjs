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

rejects("unknown subject rejected", () => generationPlan({ subject: "数学", type: "mc", difficulty: "进阶", topic: "x", count: 3 }), /科目/);
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
  assert.deepEqual(Object.keys(AI_TYPES), ["英语", "日本国别", "文学口试"]);
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

console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
