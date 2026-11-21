// Inspects one real generation response without saving anything. Prints only
// structure (option counts, answer, lengths), never the key or full content.
//   node scripts/debug_generation.mjs
import fs from "node:fs";
import { generationPlan, promptFor } from "../lib/ai-question-generation.ts";
import { validateGeneratedItems } from "../lib/question-bank-contracts.ts";

const vars = fs.readFileSync(".dev.vars", "utf8");
const pick = (name) => {
  const line = vars.split(/\r?\n/).find((entry) => entry.trim().startsWith(name + "="));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
};
const key = pick("DEEPSEEK_API_KEY");
const base = (pick("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1").replace(/\/$/, "");
const plan = generationPlan({ subject: "日本国别", type: "mc", difficulty: "进阶", topic: "日本少子老龄化", count: 3 });

const started = Date.now();
const response = await fetch(base + "/chat/completions", {
  method: "POST",
  headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
  signal: AbortSignal.timeout(90000),
  body: JSON.stringify({
    model: pick("DEEPSEEK_MODEL"),
    response_format: { type: "json_object" },
    max_tokens: 4000,
    temperature: 0.6,
    thinking: { type: "disabled" },
    messages: [
      { role: "system", content: promptFor(plan) },
      { role: "user", content: JSON.stringify({ subject: plan.subject, type: plan.type.id, topic: plan.topic, difficulty: plan.difficulty, count: plan.count }) },
    ],
  }),
});
const payload = await response.json();
const content = payload.choices?.[0]?.message?.content || "";
console.log(JSON.stringify({
  status: response.status,
  elapsedMs: Date.now() - started,
  finish: payload.choices?.[0]?.finish_reason,
  usage: payload.usage,
  contentLength: content.length,
  contentHead: content.slice(0, 300).replaceAll(key, "[redacted]"),
}, null, 2));
try {
  const parsed = JSON.parse(content);
  console.log(JSON.stringify({
    items: (parsed.items || []).map((item) => ({
      title: item.title,
      textLength: String(item.text || "").length,
      paragraphs: Array.isArray(item.paragraphs) ? item.paragraphs.length : 0,
      questions: (item.questions || []).map((question) => ({
        stemHead: String(question.stem || "").slice(0, 50),
        optionsType: Array.isArray(question.options) ? "array" : typeof question.options,
        optionCount: Array.isArray(question.options) ? question.options.length : null,
        answer: question.answer,
        analysisLength: String(question.analysis || "").length,
      })),
    })),
  }, null, 2));
  try {
    const validated = validateGeneratedItems(parsed, { subject: plan.subject, section: plan.section, difficulty: plan.difficulty, count: plan.count });
    console.log("VALIDATED", validated.length, "items");
  } catch (error) {
    console.log("VALIDATION FAILED:", error.message);
  }
} catch (error) {
  console.log("parse error", error.message);
}
