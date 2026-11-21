// Diagnostic for the configured DeepSeek credential. Prints only status codes
// and upstream error text (never the key). Run:
//   node scripts/diagnose_deepseek.mjs
import fs from "node:fs";

const vars = fs.readFileSync(".dev.vars", "utf8");
const pick = (name) => {
  const line = vars.split(/\r?\n/).find((entry) => entry.trim().startsWith(name + "="));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
};
const key = pick("DEEPSEEK_API_KEY");
const model = pick("DEEPSEEK_MODEL");
const base = (pick("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1").replace(/\/$/, "");

console.log(JSON.stringify({
  keyPresent: !!key,
  keyLength: key.length,
  keyPrefix: key.slice(0, 3) === "sk-" ? "sk-" : "(not sk-)",
  model,
  base,
}));

async function probe(label, url, init = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    let message = text.slice(0, 400);
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.message || message;
    } catch {
      /* keep text */
    }
    if (key && message.includes(key)) message = message.replaceAll(key, "[redacted]");
    console.log(`${label}: status=${response.status} ms=${Date.now() - started} message=${message}`);
    return response.status;
  } catch (error) {
    console.log(`${label}: network-error ms=${Date.now() - started} name=${error.name} message=${error.message} cause=${error.cause?.code || ""}`);
    return 0;
  }
}

const modelStatus = await probe("GET /models", base + "/models");
if (modelStatus === 200) {
  await probe("POST /chat/completions", base + "/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with OK only." }], max_tokens: 5 }),
  });
  await probe("GET /user/balance", "https://api.deepseek.com/user/balance");
}
