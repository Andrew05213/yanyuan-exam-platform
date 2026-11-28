// Pure planning/prompt/parse logic for AI topic generation. This module has no
// Cloudflare runtime imports so it can be unit tested with plain Node.
import {
  AI_DIFFICULTIES,
  AI_SUBJECTS,
  BankContractError,
  validateGeneratedItems,
  type AiDifficulty,
  type AiSubject,
  type BankItem,
} from "./question-bank-contracts.ts";
import { AI_GENERATION_LIMITS } from "./ai-question-limits.ts";

export const AI_TYPES: Record<AiSubject, { id: string; label: string; section: string }[]> = {
  英语: [
    { id: "reading", label: "英语阅读：完整篇章 + 小题", section: "reading" },
    { id: "cloze", label: "完形填空", section: "cloze" },
    { id: "gap-seven", label: "七选五", section: "gap-seven" },
    { id: "literary", label: "英语文学与文化常识", section: "literary" },
    { id: "writing", label: "作文", section: "writing" },
    { id: "correction", label: "改错", section: "correction" },
    { id: "zh-en", label: "中翻英", section: "zh-en" },
    { id: "en-zh", label: "英翻中", section: "en-zh" },
    { id: "mc", label: "词汇语法：单项选择", section: "mc" },
  ],
  语文: [
    { id: "cn-modern", label: "现代文阅读（简答）", section: "cn-modern" },
    { id: "cn-classical", label: "文言文阅读（理解与翻译）", section: "cn-classical" },
    { id: "cn-poem", label: "古诗词鉴赏（简答）", section: "cn-poem" },
    { id: "cn-language", label: "语言文字运用（单选）", section: "cn-language" },
    { id: "cn-literary", label: "文学文化常识（单选）", section: "cn-literary" },
    { id: "cn-writing", label: "语文作文", section: "cn-writing" },
  ],
  数学: [
    { id: "math-mc", label: "数学单项选择", section: "math-mc" },
    { id: "math-fill", label: "数学填空", section: "math-fill" },
    { id: "math-solution", label: "数学解答与证明", section: "math-solution" },
  ],
  日本国别: [{ id: "mc", label: "日本国别：单项选择", section: "country" }],
  文学口试: [{ id: "oral", label: "文学口试：问答与追问", section: "oral-country" }],
};

export const AI_COUNTS: Record<string, { min: number; max: number; options: number[] }> = {
  "cn-modern": { min: 2, max: 4, options: [2,3,4] },
  "cn-classical": { min: 2, max: 4, options: [2,3,4] },
  "cn-poem": { min: 1, max: 3, options: [1,2,3] },
  "cn-language": { min: 3, max: 10, options: [3,5,10] },
  "cn-literary": { min: 3, max: 10, options: [3,5,10] },
  "cn-writing": { min: 1, max: 2, options: [1,2] },
  "math-mc": { min: 3, max: 10, options: [3,5,10] },
  "math-fill": { min: 3, max: 10, options: [3,5,10] },
  "math-solution": { min: 1, max: 5, options: [1,2,3,5] },
  reading: { min: 3, max: 6, options: [3, 4, 5] },
  cloze: { min: 5, max: 10, options: [5, 8, 10] },
  "gap-seven": { min: 1, max: 1, options: [1] },
  literary: { min: 1, max: 5, options: [1, 3, 5] },
  writing: { min: 1, max: 2, options: [1, 2] },
  correction: { min: 1, max: 5, options: [1, 3, 5] },
  "zh-en": { min: 1, max: 2, options: [1, 2] },
  "en-zh": { min: 1, max: 2, options: [1, 2] },
  mc: { min: 1, max: 10, options: [3, 5, 10] },
  oral: { min: 1, max: 5, options: [1, 2, 3] },
};

const difficultyRules = {
  基础: {reading:"350–500", skill:"直接定位一处证据或应用一条常见规则。题干只考一个知识点，干扰项对应常见误解。", oral:"解释一个概念，用一个具体例子说明，追问聚焦原论点。"},
  进阶: {reading:"550–800", skill:"整合两处信息、跨句推断，或比较两个易混概念。干扰项在局部成立，但可用完整语境排除。", oral:"比较两个文本细节或观点，用具体证据解释差异，追问要求补充依据。"},
  挑战: {reading:"800–1000", skill:"检验隐含假设、论证边界或多步推断。干扰项应有合理表象，解析必须说明决定性区别。", oral:"评估竞争性解释，引用具体依据并回应反例，追问要求说明论点的适用边界。"},
} satisfies Record<AiDifficulty,{reading:string;skill:string;oral:string}>;

export type GenerationPlan = {
  subject: AiSubject;
  type: { id: string; label: string; section: string };
  section: string;
  difficulty: AiDifficulty;
  topic: string;
  count: number;
  focus?: string;
  words?: string;
};

export function generationPlan(body: unknown): GenerationPlan {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BankContractError("请求格式不正确。");
  const source = body as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.some((key) => !["subject", "topic", "difficulty", "type", "count", "focus", "words"].includes(key))) throw new BankContractError("请求字段不正确。");
  const subject = source.subject as AiSubject;
  if (!AI_SUBJECTS.includes(subject)) throw new BankContractError("请选择支持的科目。");
  const type = AI_TYPES[subject].find((entry) => entry.id === source.type);
  if (!type) throw new BankContractError("请选择该科目下的题型。");
  if (!AI_DIFFICULTIES.includes(source.difficulty as AiDifficulty)) throw new BankContractError("请选择基础、进阶或挑战。");
  const topic = typeof source.topic === "string" ? source.topic.trim() : "";
  if (!topic || topic.length > 60 || /[<>\u0000-\u001f]/.test(topic)) throw new BankContractError("请填写 1 至 60 字的主题。");
  const count = Number(source.count);
  const range = AI_COUNTS[type.id];
  const maxCount = Math.min(range.max, AI_GENERATION_LIMITS.maxCountPerRequest);
  if (!Number.isSafeInteger(count) || count < range.min || count > maxCount) throw new BankContractError(`题量须为 ${range.min} 至 ${maxCount} 题。`);
  const focus=source.focus ?? "", words=source.words ?? "";
  if(typeof focus!=="string" || focus.length>100 || /[<>\x00-\x1f]/.test(focus)) throw new BankContractError("能力要求限 100 字纯文本。");
  if(typeof words!=="string" || (words && (type.id!=="reading" || !["350–500","550–800","800–1000"].includes(words)))) throw new BankContractError("阅读篇幅无效。");
  return { ...(focus ? {focus} : {}), ...(words ? {words} : {}), subject, type, section: type.section, difficulty: source.difficulty as AiDifficulty, topic, count };
}

export function promptFor(plan: GenerationPlan): string {
  const constraints: string[] = [];
  const rubric = difficultyRules[plan.difficulty];
  const section=plan.section;
  const instructions:Record<string,string>={
    cloze:`生成一篇完整英文完形，正文放 text，按顺序写明 [1] 至 [${plan.count}]，每个空号恰好出现一次；questions 按空号顺序提供对应的四个选项、唯一答案及中文逐空解析。只输出一个题组。`,
    "gap-seven":"生成一个题组。text 放完整英文短文，按顺序写明 [1] 至 [5]，每个空号出现一次。questions 只含一个条目，options 放 A 到 G 的七个完整候选句，answer 为五个不重复的大写字母（依空的顺序，无空格），analysis 逐空说明前后文衔接；两个干扰项不得同样成立。",
    literary:"每组一题，四个英文选项、唯一答案、中文解析。考查英美文学或英语使用地区的文化常识，给出能核验的原作、章节、机构或出版物名称与年份，勿虚构网址或引文。text 为空。",
    writing:"每组一题。stem 用英文给出写作主题、清楚的任务要求及字数，reference 放英文范文，analysis 放中文写作要点，options 为空数组，answer 为空字符串，text 为空字符串。",
    correction:"每组仅一道英文句子改错。stem 明确要求替换一个错误的词，accepted 填所有可接受的替换词组成的数组，analysis 用中文指出原词及语法原因。options 为空数组，answer 和 text 均为空字符串。",
    "zh-en":"每组一题，stem 要求译成英文。text 放一段原创中文短文，reference 放自然准确的英文参考译文，analysis 用中文讲解表达与难点。options 为空数组，answer 为空字符串。",
    "en-zh":"每组一题，stem 要求译成中文。text 放一段原创英文短文，reference 放自然准确的中文参考译文，analysis 用中文讲解表达与难点。options 为空数组，answer 为空字符串。",
  };
  if(plan.subject==="语文"||plan.subject==="数学"){
    const common="题干、解析、考点均用中文。题目原创，禁止冒充官方真题或虚构作者、引文、出处。数学式采用清晰的纯文本或 Unicode（x²、√、≤、≥、≠，分数用括号），不得使用 ASCII 尖括号或 HTML。写全作答所需条件，答案独立复核。";
    const subjectRules=plan.subject==="数学"?{
      基础:"高考中档：基本概念和常见变形。",
      进阶:"高考压轴或保送校考：多条件综合、参数分类、严谨讨论定义域。",
      挑战:"强基或竞赛入门：构造、证明、非套路迁移，不以繁琐计算冒充难度。"
    }:{
      基础:"高考基础：直接文本依据、常规语用与文史知识。",
      进阶:"高考较难或保送校考：比较文本、论证结构、语言效果、跨句推断。",
      挑战:"高难度保送训练：深层语义、文史辨析、批判性论证及竞争性解释。"
    };
    const rules:Record<string,string>={
      "cn-modern":"原创完整中文现代文约 500–900 字，text 存全文。每小题有独立采分点，涵盖主旨、结构、语言或论证；参考答案引用文本证据。",
      "cn-classical":"原创文言风格训练短文约 180–350 字，注明原创模拟材料而非古籍引文；考文意、实词、句式和句子翻译，解析含语境及关键字。",
      "cn-poem":"原创古诗词风格模拟材料（不得署真实作者名），考意象、手法、情感或结构，参考答案引用具体词句。",
      "cn-language":"语言文字运用单选，考词语、病句、衔接、修辞或语义；短材料放 stem，四项仅一项符合题意。",
      "cn-literary":"文学文化常识单选，事实稳定可核查，避免争议性年代和虚构出处。",
      "cn-writing":"中文作文题含材料、任务和明确字数；reference 给原创范文或完整示范提纲，analysis 给立意与采分点。",
      "math-mc":"四个不同选项，唯一正确答案；独立复算或代入检查全部选项，解析列出关键推导。",
      "math-fill":"单空填空，accepted 列出核对过的等价文本（如 1/2 与 0.5），不得混淆精确值和近似值。analysis 含推导、定义域及检验。",
      "math-solution":"解答或证明，reference 给完整逐步解答，analysis 给采分点；检查定义域、边界、必要与充分性，独立复算，证明不得循环。"
    };
    const reading=["cn-modern","cn-classical","cn-poem"].includes(section);
    const fill=section==="math-fill",mc=["cn-language","cn-literary","math-mc"].includes(section);
    const shape=mc?"options 正好四项，answer 为 A/B/C/D。":fill?"options 为 []、answer 为空串、accepted 为非空字符串数组。":"options 为 []、answer 为空串、reference 为非空中文参考解答（含证据或推导）。";
    return [
      "你是外语保送备考的语文与数学原创命题助手。只输出 JSON 对象，不要 Markdown。",
      `科目：${plan.subject}；题型：${plan.type.label}；主题：${plan.topic}；难度：${plan.difficulty}。`,
      common,subjectRules[plan.difficulty],rules[section],shape,
      reading?`只输出一个题组，text 为完整材料，questions 恰好 ${plan.count} 道简答题。`:`输出 ${plan.count} 个题组，每组恰好一题，text 与 paragraphs 为空。`,
      'JSON 结构：{"items":[{"title":"题组标题","text":"","paragraphs":[],"sourceNote":"AI 生成；非官方真题，未经人工审核。","questions":[{"stem":"题干","options":[],"answer":"","analysis":"解析与采分点","tag":"考点","reference":"参考解答","accepted":[]}]}]}',
      "选择题不需要 reference/accepted；简答、作文、证明题不需要 accepted；填空题不需要 reference。不要重复题干；给出答案后自行复核。",
      ...(plan.focus?["重点考查："+plan.focus]:[])
    ].join("\n");
  }
  if (instructions[section]) {
    constraints.push(`围绕“${plan.topic}”准备 ${plan.count} ${section==="gap-seven"?"篇":"题"}练习。`,instructions[section]);
  } else if (section === "reading") {
    constraints.push(
      `生成 1 篇 ${plan.words || rubric.reading} 词的英语文章，主题为“${plan.topic}”；围绕文章生成 ${plan.count} 道单选题，考查项目应与本档标准一致。`,
      "原文放在 text（纯文本，段落之间用空行分隔），也可同时给出 paragraphs 数组；题干与选项用英文，解析用中文。",
      "每题只能有一个正确答案，干扰项不得也能由原文推出；不得使用“以上都对 / 以上都不对 / all of the above / none of the above”。",
      "解析必须引用原文中的具体词句或段落作为依据，不能只写“根据文章”。",
    );
  } else if (plan.section === "mc" || plan.section === "country") {
    const isCountry = plan.subject === "日本国别";
    constraints.push(
      isCountry
        ? `本次是日本国别笔试客观题（中文），不是口试，也不是日语阅读理解。围绕“${plan.topic}”生成 ${plan.count} 道日本社会、文化、政治、经济或历史知识单选题，难度为“${plan.difficulty}”。`
        : `本次是英语词汇语法笔试客观题，不是口试。围绕“${plan.topic}”生成 ${plan.count} 道英语词汇语法单选题，难度为“${plan.difficulty}”。`,
      `必须输出 ${plan.count} 个题组，每个题组的 questions 恰好 1 题；不得把多题合并进一个题组。`,
      isCountry
        ? "题干、四个选项和解析全部使用中文（必要的日文专有名词可保留）；不得输出日文文章、日文题干或要求阅读日文原文。"
        : "题干和选项使用英文，解析使用中文。",
      "每题须独立可答。直接点明作品、概念或历史事件，题干需要的背景写在该题内。不要要求考生参考未提供的文章或材料。text 与 paragraphs 必须为空字符串或空数组，不得附阅读文章。",
      "每道题 options 必须正好 4 个互不相同的选项，answer 只能是 A/B/C/D；不得输出空 options，不得输出 reference、guide、followups 字段。",
      "每题只有一个正确选项；干扰项必须明确错误，不得出现两个都成立的选项；解析要说明正确项依据，并指出主要干扰项为何错误。",
    );
  } else {
    constraints.push(
      `本次是口试，不是笔试选择题。围绕“${plan.topic}”生成 ${plan.count} 道中文学术面试口试题，难度为“${plan.difficulty}”。`,
      "每题包含题干 stem、参考回答 reference、评分要点 analysis、2–3 条思路 guide、1–2 个追问 followups。",
    );
  }
  return [
    "你为外语保送备考设计训练题。只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。",
    `所有题目使用${plan.subject === "英语" ? "英文题干与中文解析" : "中文题干与中文解析"}，除非题目本身需要引用外文术语。`,
    `难度要求（${plan.difficulty}）：${plan.type.id==="oral"?rubric.oral:rubric.skill}`,
    "难度由理解与推理要求区分，不以生僻字词、题干长度或冷僻事实代替难度。",
    'JSON 结构：{"items":[{"title":"题组标题","text":"阅读原文或空串","paragraphs":["自然段"],"sourceNote":"AI 生成；非官方真题，未经人工审核。","questions":[{"stem":"题干","options":["A项","B项","C项","D项"],"answer":"B","analysis":"中文解析","tag":"考点"}]}]}',
    ...(instructions[section]?[]:["客观题必须正好 4 个互不相同的选项，answer 只能是 A/B/C/D；口试题把 options 写为空数组、answer 写空串，并使用 reference、guide、followups 字段。"]),
    "所有文字必须是纯文本，不得包含 HTML 标签、脚本、答案以外的多余字段；不得杜撰真实考试真题来源。",
    "在解析末尾给出本题可核查的事实或原文依据。涉及政策或统计时标明适用年份和机构；无把握时改出稳定知识题。不得虚构网址、引文、论文或院校考情。",
    ...(plan.focus ? ["用户指定的训练能力："+plan.focus] : []),
    ...constraints,
  ].join("\n");
}

export function upstreamError(status: number): string {
  if (status === 401 || status === 403) return "DeepSeek 拒绝了凭据，请管理员检查服务端密钥。";
  if (status === 402) return "DeepSeek 账户余额不足，请充值后重试。";
  if (status === 429) return "DeepSeek 请求受限，请稍后再试。";
  return "DeepSeek 服务暂时不可用，请稍后重试。";
}

export function readContent(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new BankContractError("模型没有返回内容。");
  if (payload.choices[0].finish_reason !== "stop") throw new BankContractError("模型输出被截断，请减少题量后重试。");
  return content;
}

export function parseJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new BankContractError("模型返回的不是有效 JSON。");
  }
}

export function parseGeneration(content: string, plan: GenerationPlan): BankItem[] {
  return validateGeneratedItems(parseJson(content), plan);
}
