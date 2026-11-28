// Shared contracts for AI-generated study questions and the personal bank.
// Used by the generation route, the bank route and the browser-side validator
// (the browser receives the same shapes, so the checks are deliberately plain
// and dependency free).

export const AI_SUBJECTS = ["英语", "日本国别", "文学口试", "语文", "数学"] as const;
export type AiSubject = (typeof AI_SUBJECTS)[number];

export const AI_SECTIONS: Record<AiSubject, string[]> = {
  英语: ["reading", "cloze", "gap-seven", "literary", "writing", "correction", "zh-en", "en-zh", "mc"],
  语文: ["cn-mc","cn-multiple","cn-indefinite","cn-subjective","cn-modern","cn-classical","cn-poem","cn-language","cn-literary","cn-writing"],
  数学: ["math-multiple","math-indefinite","math-mc","math-fill","math-solution"],
  日本国别: ["country"],
  文学口试: ["oral-reading", "oral-country", "oral-speech"],
};

export const AI_DIFFICULTIES = ["基础", "进阶", "挑战"] as const;
export type AiDifficulty = (typeof AI_DIFFICULTIES)[number];

export const REVIEW_STATUS = ["pending", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

export type BankQuestion = {
  id: string;
  stem: string;
  options: string[];
  answer: string;
  analysis: string;
  tag: string;
  reference: string;
  accepted?: string[];
  guide: string[];
  followups: string[];
};

export type BankItem = {
  id: string;
  subject: AiSubject;
  section: string;
  difficulty: AiDifficulty;
  sourceNote: string;
  title: string;
  text: string;
  paragraphs: string[];
  questions: BankQuestion[];
};

export type BankRecord = BankItem & {
  source: "ai";
  reviewStatus: ReviewStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

const MAX_TEXT = 12000;
const MAX_STEM = 1200;
const MAX_OPTION = 400;
const MAX_ANALYSIS = 3000;
const MAX_REFERENCE = 4000;
const MAX_TITLE = 160;
const MAX_TAG = 80;
const MAX_ITEMS = 20;
const MAX_QUESTIONS = 30;

const translationSections = new Set(["zh-en","en-zh"]);
const chinesePassages = new Set(["cn-modern","cn-classical","cn-poem"]);
const subjectiveSections = new Set(["cn-subjective","cn-modern","cn-classical","cn-poem","cn-writing","math-solution"]);
const passageSections = new Set(["reading","cloze","gap-seven",...chinesePassages]);

export class BankContractError extends Error {}

function text(value: unknown, max: number, field: string, { required = true } = {}): string {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw new BankContractError(`${field} 缺失或格式不正确。`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) throw new BankContractError(`${field} 不能为空。`);
  if (trimmed.length > max) throw new BankContractError(`${field} 超过 ${max} 字。`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) throw new BankContractError(`${field} 含有不可见控制字符。`);
  if (/[<>]/.test(trimmed)) throw new BankContractError(`${field} 只能包含纯文本。`);
  return trimmed;
}

function stringList(value: unknown, max: number, field: string, maxLength = 400, { required = false } = {}): string[] {
  if (value === undefined || value === null) {
    if (required) throw new BankContractError(`${field} 缺失。`);
    return [];
  }
  if (!Array.isArray(value)) throw new BankContractError(`${field} 必须是列表。`);
  if (value.length > max) throw new BankContractError(`${field} 超过 ${max} 项。`);
  return value.map((entry, index) => text(entry, maxLength, `${field} 第 ${index + 1} 项`, { required: true }));
}

export function normaliseQuestion(raw: unknown, index: number, section: string): BankQuestion {
  if (!raw || typeof raw !== "object") throw new BankContractError(`第 ${index + 1} 题格式不正确。`);
  const entry = raw as Record<string, unknown>;
  const stem = text(entry.stem, MAX_STEM, `第 ${index + 1} 题题干`);
  const analysis = text(entry.analysis, MAX_ANALYSIS, `第 ${index + 1} 题解析`);
  const tag = text(entry.tag, MAX_TAG, `第 ${index + 1} 题考点`, { required: false });
  const isOral = section.startsWith("oral-");
  if (isOral) {
    return {
      id: `q${index + 1}`,
      stem,
      options: [],
      answer: "",
      analysis,
      tag,
      reference: text(entry.reference, MAX_REFERENCE, `第 ${index + 1} 题参考回答`),
      guide: stringList(entry.guide, 8, `第 ${index + 1} 题思路`, 400, { required: true }),
      followups: stringList(entry.followups, 6, `第 ${index + 1} 题追问`, 400),
    };
  }
  const base = {id:`q${index+1}`,stem,analysis,tag,reference:"",guide:[],followups:[]};
  if(section==="writing"||translationSections.has(section)||subjectiveSections.has(section)){
    return {...base,options:[],answer:"",reference:text(entry.reference,MAX_REFERENCE,"参考答案")};
  }
  if(section==="correction"||section==="math-fill"){
    const accepted=stringList(entry.accepted,8,"可接受答案",section==="math-fill"?240:80,{required:true});
    if(!accepted.length)throw new BankContractError("填空或改错题须给出至少一个可接受答案。");
    return {...base,options:[],answer:"",accepted};
  }
  const seven=section==="gap-seven",size=seven?7:4;
  const options=stringList(entry.options,size,`第 ${index+1} 题选项`,MAX_OPTION,{required:true});
  if(options.length!==size)throw new BankContractError(`第 ${index+1} 题必须正好 ${size} 个选项。`);
  if(new Set(options.map(option=>option.toLowerCase())).size!==size)throw new BankContractError(`第 ${index+1} 题选项重复。`);
  let answer=typeof entry.answer==="string"?entry.answer.trim().toUpperCase():"";
  if(seven){
    if(!/^[A-G]{5}$/.test(answer)||new Set(answer).size!==5)throw new BankContractError("七选五答案须有五个互不重复的 A–G 字母。");
  } else if (section.endsWith("-multiple")||section.endsWith("-indefinite")) {
    const min=section.endsWith("-multiple")?2:1;
    if(!/^[A-D]{1,4}$/.test(answer)||answer.length<min||new Set(answer).size!==answer.length)throw new BankContractError(`选择答案须含 ${min} 至 4 个互不重复的 A–D 字母。`);
    answer=[...answer].sort().join("");
  } else if (!/^[ABCD]$/.test(answer)) {
    throw new BankContractError(`第 ${index+1} 题答案必须是 A/B/C/D。`);
  }
  return {...base,options,answer};
}

export function normaliseItem(raw: unknown, subject: AiSubject, difficulty: AiDifficulty, section: string): BankItem {
  if (!raw || typeof raw !== "object") throw new BankContractError("题目格式不正确。");
  const entry = raw as Record<string, unknown>;
  if (!Array.isArray(entry.questions) || entry.questions.length === 0 || entry.questions.length > MAX_QUESTIONS) {
    throw new BankContractError("每题组必须包含 1 至 30 道小题。");
  }
  const questions = entry.questions.map((question, index) => normaliseQuestion(question, index, section));
  if (new Set(questions.map((question) => question.stem)).size !== questions.length) throw new BankContractError("同一组内题干重复。");
  const id = `ai-${crypto.randomUUID()}`;
  return {
    id,
    subject,
    section,
    difficulty,
    sourceNote: text(entry.sourceNote ?? "AI 生成；非官方真题，未经人工审核。", 200, "来源说明"),
    title: text(entry.title, MAX_TITLE, "题组标题"),
    text: text(entry.text, MAX_TEXT, "阅读原文", { required: false }),
    paragraphs: stringList(entry.paragraphs, 40, "段落", 2000),
    questions: questions.map((question) => ({ ...question, id: `${id}:${question.id}` })),
  };
}

function refersToMissingPassage(stem: string): boolean {
  // “本文” in “日本文学” and “文中” in “日文中” are parts of a subject name.
  return /根据上(?:文|述)|上文|(?<![日英中古译])文中|(?<!日)本文|阅读材料|according to the (?:passage|text)/i.test(stem);
}

function validateMaterial(section:string,passage:string,count:number){
  if(chinesePassages.has(section)){
    const han=(passage.match(/\p{Script=Han}/gu)||[]).length;
    const min=section==="cn-poem"?16:section==="cn-classical"?60:200;
    if(han<min)throw new BankContractError("语文阅读材料缺失、过短或语种不符。");
  }
  if((section.startsWith("math-")||section.startsWith("cn-"))&&!chinesePassages.has(section)&&passage.trim())throw new BankContractError("独立题不得附加无关材料，请把必要条件写入题干。");
  if(section==="reading"&&passage.length<300)throw new BankContractError("阅读原文过短，无法作为完整篇章。");
  if(translationSections.has(section)){
    const hasChinese=/[\p{Script=Han}]/u.test(passage);
    if(passage.length<20||(section==="zh-en"?!hasChinese:hasChinese))throw new BankContractError("翻译原文缺失、过短或语种不符。");
  }
  if(section==="cloze"||section==="gap-seven"){
    const blanks=[...passage.matchAll(/\[(\d+)\]/g)];
    const expected=section==="gap-seven"?5:count;
    if(passage.length<100||blanks.length!==expected||blanks.some((match,i)=>Number(match[1])!==i+1)){
      throw new BankContractError(`正文须依次包含 [1] 至 [${expected}]，每个空号只出现一次。`);
    }
  }
}
export function validateGeneratedItems(raw: unknown, request: { subject: AiSubject; section: string; difficulty: AiDifficulty; count: number }): BankItem[] {
  if (!raw || typeof raw !== "object") throw new BankContractError("模型未返回题目对象。");
  const payload = raw as Record<string, unknown>;
  const list = payload.items;
  if (!Array.isArray(list) || !list.length) throw new BankContractError("模型未返回题目列表。");
  const items = list.map((entry) => normaliseItem(entry, request.subject, request.difficulty, request.section));
  const total = items.reduce((sum, item) => sum + item.questions.length, 0);
  if (total !== request.count) throw new BankContractError(`题量不一致：要求 ${request.count} 题，收到 ${total} 题。`);
  if(passageSections.has(request.section)){
    if(items.length!==1)throw new BankContractError("每次须生成一个完整篇章。");
  }else if(items.some(item=>item.questions.length!==1)){
    throw new BankContractError("该题型每组只能包含一道题。");
  }
  for(const item of items)validateMaterial(item.section,item.text,item.questions.length);
  const sourceIds = items.flatMap((item) => item.questions.map((question) => question.id));
  if (new Set(sourceIds).size !== sourceIds.length) throw new BankContractError("题目编号重复。");
  if (request.section === "country" || request.section === "mc" || request.section === "literary") {
    if (items.some((item) => item.text.trim() || item.paragraphs.length)) {
      throw new BankContractError("知识型客观题不应附阅读材料，请重试。");
    }
    if (items.some((item) => item.questions.some((question) => refersToMissingPassage(question.stem)))) {
      throw new BankContractError("题干引用了不存在的上文，请重试。");
    }
    if (
      request.subject === "日本国别" &&
      items.some((item) =>
        item.questions.some((question) => {
          const kana = (question.stem.match(/[\u3040-\u30ff]/g) || []).length;
          const cjk = (question.stem.match(/[\u4e00-\u9fff]/g) || []).length;
          return cjk === 0 || kana / (kana + cjk) > 0.3;
        }),
      )
    ) {
      throw new BankContractError("日本国别题必须使用中文题干，请重试。");
    }
  }
  if(request.subject==="语文"||request.subject==="数学"){
    const stems=items.flatMap(item=>item.questions.map(q=>q.stem));
    if(new Set(stems).size!==stems.length)throw new BankContractError("题干重复，请重试。");
    if(stems.some(stem=>!/\p{Script=Han}/u.test(stem)))throw new BankContractError("请使用中文题干。");
    if(!chinesePassages.has(request.section)&&stems.some(refersToMissingPassage))throw new BankContractError("题干引用了不存在的上文，请重试。");
    for(const item of items){item.sourceNote="AI 生成；非官方真题，未经人工审核。";item.paragraphs=item.text?item.text.split(/\n\s*\n/):[];}
  }
  const bannedOption = /以上(都|均|皆)|all of the above|none of the above/i;
  if (items.some((item) => item.questions.some((question) => question.options.some((option) => bannedOption.test(option))))) {
    throw new BankContractError("选项不得使用“以上都对/以上都不对”这类无法区分的表述。");
  }
  return items;
}

// Validates an item that is about to be written to (or was read from) the
// personal bank. Unlike normaliseItem it keeps the server-issued ids so
// sourceId stays stable for dedupe and answer history.
export function validateBankItem(raw: unknown): BankItem {
  if (!raw || typeof raw !== "object") throw new BankContractError("题库条目格式不正确。");
  const entry = raw as Record<string, unknown>;
  if (typeof entry.id !== "string" || !/^ai-[a-f0-9-]{36}$/.test(entry.id)) throw new BankContractError("题库编号不正确。");
  const subject = entry.subject as AiSubject;
  if (!AI_SUBJECTS.includes(subject)) throw new BankContractError("题库科目不正确。");
  const difficulty = entry.difficulty as AiDifficulty;
  if (!AI_DIFFICULTIES.includes(difficulty)) throw new BankContractError("题库难度不正确。");
  if (typeof entry.section !== "string" || !AI_SECTIONS[subject].includes(entry.section)) throw new BankContractError("题库题型不正确。");
  if (!Array.isArray(entry.questions) || !entry.questions.length || entry.questions.length > MAX_QUESTIONS) throw new BankContractError("题库题目数量不正确。");
  const section = entry.section;
  const questions = entry.questions.map((question, index) => {
    if (!question || typeof question !== "object") throw new BankContractError(`第 ${index + 1} 题格式不正确。`);
    const value = question as Record<string, unknown>;
    if (value.id !== `${entry.id}:q${index + 1}`) throw new BankContractError(`第 ${index + 1} 题编号不连续。`);
    const normalised = normaliseQuestion(value, index, section);
    return { ...normalised, id: value.id as string };
  });
  const passage=text(entry.text,MAX_TEXT,"阅读原文",{required:false});
  if(!passageSections.has(section)&&questions.length!==1&&!section.startsWith("oral-")){
    throw new BankContractError("该题型每组只能包含一道题。");
  }
  validateMaterial(section,passage,questions.length);
  return {
    id: entry.id,
    subject,
    section,
    difficulty,
    sourceNote: text(entry.sourceNote, 200, "来源说明"),
    title: text(entry.title, MAX_TITLE, "题组标题"),
    text: passage,
    paragraphs: stringList(entry.paragraphs, 40, "段落", 2000),
    questions,
  };
}

export function parseStoredItem(payload: string): BankItem {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    throw new BankContractError("题库条目格式不正确。");
  }
  return validateBankItem(raw);
}
