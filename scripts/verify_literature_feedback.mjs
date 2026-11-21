// Real DeepSeek literature-feedback check. Signs in with the local mock
// identity, posts a short oral-practice answer and verifies the structured
// feedback (student quote, evidence quote, gap, suggestion, two questions).
// Writes a redacted artifact with the measured latency.
//   node scripts/verify_literature_feedback.mjs [baseUrl]
// Exit codes: 0 success, 3 credentials missing/blocked, 1 failure.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const base = process.argv[2] || "http://127.0.0.1:5173";
const cookies = new Map();

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(pathname, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookies.size ? { Cookie: cookieHeader() } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  for (const line of response.headers.getSetCookie?.() || []) {
    const pair = line.split(";")[0];
    const index = pair.indexOf("=");
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: response.status, json, text };
}

const evidence = "物哀（もののあはれ）指对事物无常的深切感受，并不等同于单纯的悲伤。";
const answer = "我认为物哀不只是悲观主义。它让人看到美会消失，因此更珍惜当下的细节；但若只强调哀伤，就会忽略作品里对生命力的肯定。";
const topic = "《源氏物语》与物哀";
const question = "物哀是否等同于悲观主义？请结合一处文本细节回答。";

const artifact = {
  checkedAt: new Date().toISOString(),
  base,
  topic,
  input: {
    evidenceLength: evidence.length,
    evidenceSha256: createHash("sha256").update(evidence).digest("hex").slice(0, 16),
    answerLength: answer.length,
    answerSha256: createHash("sha256").update(answer).digest("hex").slice(0, 16),
  },
  status: "unknown",
  elapsedMs: null,
  model: null,
  checks: {},
  feedback: null,
  error: null,
};

function writeArtifact() {
  fs.mkdirSync("artifacts", { recursive: true });
  const file = path.join("artifacts", `literature-feedback-${artifact.checkedAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(artifact, null, 2));
  return file;
}

function redact(text, limit = 60) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…（已脱敏，共 ${clean.length} 字）` : clean;
}

try {
  const signin = await request("/signin-with-chatgpt");
  if (signin.status >= 400) throw new Error(`本地登录失败：${signin.status}`);
  const session = await request("/api/session");
  if (!session.json?.authenticated) throw new Error("本地模拟身份未生效，请确认 pnpm dev 正在运行且未设置 YANYUAN_LAN_AUTH=1。");

  const started = Date.now();
  const response = await request("/api/literature/feedback", {
    method: "POST",
    headers: { Origin: base },
    body: { topic, question, evidence, answer },
  });
  artifact.elapsedMs = Date.now() - started;

  if (response.status === 503) {
    artifact.status = "blocked";
    artifact.error = response.json?.error || "尚无可用的默认模型。";
    artifact.checks = { credentials: false };
    const file = writeArtifact();
    console.log(`BLOCKED: ${artifact.error}`);
    console.log(`artifact: ${file}`);
    process.exitCode = 3;
  } else if (response.status !== 200) {
    artifact.status = "failed";
    artifact.error = response.json?.error || response.text.slice(0, 300);
    writeArtifact();
    console.error(`FAIL T${response.status}: ${artifact.error}`);
    process.exitCode = 1;
  } else {
    const feedback = response.json.feedback || "";
    artifact.model = response.json.model || null;
    artifact.feedback = {
      lines: feedback.split("\n\n").map((line) => redact(line)),
      length: feedback.length,
    };
    const quote = /^你的回答 · (.*)$/m.exec(feedback)?.[1] || "";
    const evidenceQuote = /^你提交的依据 · (.*)$/m.exec(feedback)?.[1] || "";
    const questions = feedback.split("\n\n").filter((line) => /^追问 [12] · /.test(line));
    artifact.checks = {
      hasStudentQuote: !!quote && answer.includes(quote),
      hasEvidenceQuote: !!evidenceQuote && evidence.includes(evidenceQuote),
      hasGap: /^证据缺口 · \S/m.test(feedback),
      hasSuggestion: /^修改建议 · \S/m.test(feedback),
      hasTwoQuestions: questions.length === 2,
      quoteRedacted: true,
    };
    artifact.status = Object.values(artifact.checks).every(Boolean) ? "succeeded" : "invalid";
    const file = writeArtifact();
    console.log(`${artifact.status.toUpperCase()}: model=${artifact.model} elapsed=${artifact.elapsedMs}ms`);
    console.log(JSON.stringify(artifact.checks));
    console.log(`artifact: ${file}`);
    if (artifact.status !== "succeeded") process.exitCode = 1;
  }
} catch (error) {
  artifact.status = "failed";
  artifact.error = error.message;
  writeArtifact();
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
