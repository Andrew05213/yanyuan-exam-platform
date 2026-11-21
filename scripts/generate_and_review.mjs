// Generates real AI questions and writes the full result for human review.
//   node scripts/generate_and_review.mjs <subject> <type> <difficulty> <topic> <count>
// Example:
//   node scripts/generate_and_review.mjs 日本国别 mc 进阶 日本少子老龄化 3
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const [subject, type, difficulty, topic, countArg] = process.argv.slice(2);
if (!subject || !type || !difficulty || !topic || !countArg) {
  console.error("usage: node scripts/generate_and_review.mjs <subject> <type> <difficulty> <topic> <count>");
  process.exit(2);
}
const count = Number(countArg);
const base = "http://127.0.0.1:5173";
const body = { subject, type, difficulty, topic, count, requestId: randomUUID() };
const started = Date.now();
const response = await fetch(base + "/api/ai-questions", {
  method: "POST",
  headers: { Cookie: "__sites_local_auth=1", "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await response.text();
let json = null;
try {
  json = JSON.parse(text);
} catch {
  /* keep text */
}
const elapsedMs = Date.now() - started;

fs.mkdirSync("artifacts", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const artifact = {
  requestedAt: new Date().toISOString(),
  request: body,
  status: response.status,
  elapsedMs,
  model: json?.model || null,
  quota: json?.quota || null,
  error: json?.error || null,
  items: json?.items || [],
};
const file = path.join("artifacts", `generated-${subject}-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(artifact, null, 2));

console.log(`status=${response.status} model=${artifact.model} elapsed=${elapsedMs}ms items=${artifact.items.length}`);
if (artifact.error) console.log("error:", artifact.error);
for (const [index, item] of artifact.items.entries()) {
  console.log(`\n## ${index + 1}. ${item.title} (${item.difficulty})`);
  if (item.text) console.log(`[passage ${item.text.length} chars]`);
  for (const question of item.questions) {
    console.log(`Q: ${question.stem}`);
    question.options.forEach((option, i) => console.log(`  ${"ABCD"[i]}. ${option}`));
    console.log(`答案: ${question.answer}`);
    console.log(`解析: ${question.analysis}`);
    console.log(`考点: ${question.tag}\n`);
  }
}
console.log("artifact:", file);
if (response.status !== 200) process.exitCode = 1;
