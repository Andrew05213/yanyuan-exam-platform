// Real DeepSeek AI-question generation check. Requires a configured key on the
// server. Saves a redacted artifact with latency and structural checks.
//   node scripts/verify_ai_questions_live.mjs [baseUrl]
// Exit codes: 0 success, 3 credentials missing/blocked, 1 failure.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const base = process.argv[2] || "http://127.0.0.1:5173";
const cookies = new Map();
const cookieHeader = () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");

async function request(pathname, { method = "GET", body } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookies.size ? { Cookie: cookieHeader() } : {}) },
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

const artifact = {
  checkedAt: new Date().toISOString(),
  base,
  status: "unknown",
  elapsedMs: null,
  model: null,
  count: 0,
  checks: {},
  preview: [],
  error: null,
};

function writeArtifact() {
  fs.mkdirSync("artifacts", { recursive: true });
  const file = path.join("artifacts", `ai-questions-live-${artifact.checkedAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(artifact, null, 2));
  return file;
}

const redact = (text, limit = 40) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
};

try {
  await request("/signin-with-chatgpt");
  const session = await request("/api/session");
  if (!session.json?.authenticated) throw new Error("本地模拟身份未生效。");

  const status = await request("/api/ai-questions");
  if (!status.json?.ready) {
    artifact.status = "blocked";
    artifact.error = status.json?.message || "模型未配置。";
    const file = writeArtifact();
    console.log(`BLOCKED: ${artifact.error}`);
    console.log(`artifact: ${file}`);
    process.exitCode = 3;
    process.exit();
  }

  const body = { subject: "日本国别", type: "mc", difficulty: "进阶", topic: "日本近代教育制度", count: 3, requestId: randomUUID() };
  const started = Date.now();
  const response = await request("/api/ai-questions", { method: "POST", body });
  artifact.elapsedMs = Date.now() - started;

  if (response.status !== 200) {
    artifact.status = response.status === 409 || response.status === 502 ? "failed" : "failed";
    artifact.error = response.json?.error || response.text.slice(0, 300);
    writeArtifact();
    console.error(`FAIL T${response.status}: ${artifact.error}`);
    process.exitCode = 1;
  } else {
    const items = response.json.items || [];
    const questions = items.flatMap((item) => item.questions);
    artifact.model = response.json.model;
    artifact.count = questions.length;
    artifact.quota = response.json.quota || null;
    artifact.checks = {
      countMatches: questions.length === body.count,
      stableSourceIds: new Set(questions.map((question) => question.id)).size === questions.length,
      fourOptions: questions.every((question) => Array.isArray(question.options) && question.options.length === 4),
      answersInAbcd: questions.every((question) => /^[ABCD]$/.test(question.answer)),
      analysisPresent: questions.every((question) => question.analysis && question.analysis.trim()),
      markedPending: response.json.reviewStatus === "pending",
      quotaReported: Number.isSafeInteger(response.json.quota?.remaining),
      noInlineHtml: questions.every((question) => !/[<>]/.test(question.stem + question.analysis)),
    };
    artifact.preview = items.map((item) => ({
      title: item.title,
      questions: item.questions.map((question) => ({
        stem: redact(question.stem),
        answer: question.answer,
        options: question.options.length,
        analysisLength: question.analysis.length,
      })),
    }));
    artifact.status = Object.values(artifact.checks).every(Boolean) ? "succeeded" : "invalid";
    const file = writeArtifact();
    console.log(`${artifact.status.toUpperCase()}: model=${artifact.model} count=${artifact.count} elapsed=${artifact.elapsedMs}ms`);
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
