// End-to-end check for composing an oral packet from 文学口试 bank items.
//   node scripts/verify_oral_compose.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const base = "http://127.0.0.1:5173";
const cookie = "__sites_local_auth=1";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9338;
const profile = path.resolve(".sites-runtime/chrome-oral");
fs.mkdirSync(profile, { recursive: true });

async function api(pathname, { method = "GET", body } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null, text };
}

function oralItem(title) {
  const id = `ai-${randomUUID()}`;
  return {
    id,
    subject: "文学口试",
    section: "oral-country",
    difficulty: "进阶",
    sourceNote: "AI 生成；非官方真题，未经人工审核。",
    title,
    text: "",
    paragraphs: [],
    questions: [
      {
        id: `${id}:q1`,
        stem: "请结合一部作品，说明“物哀”如何影响叙述者对人物命运的评价。",
        options: [],
        answer: "",
        analysis: "能界定概念、引用文本细节、并讨论反例。",
        tag: "物哀",
        reference: "先说明物哀是对无常的深切感受，再以《源氏物语》中光源氏与紫姬的段落为例，最后指出并非所有悲伤都属于物哀。",
        guide: ["界定概念", "引用一处文本细节", "讨论概念的边界"],
        followups: ["如果作品基调并不悲伤，还可能存在物哀吗？"],
      },
    ],
  };
}

const seeded = [oralItem("AI 文学口试 · 物哀与叙事"), oralItem("AI 文学口试 · 风景与记忆")];
const created = await api("/api/question-bank", { method: "POST", body: { items: seeded } });
assert.equal(created.status, 201, created.text);

let ws;
const send = (() => {
  const fn = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = fn.next++;
      const onMessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        ws.removeEventListener("message", onMessage);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      ws.addEventListener("message", onMessage);
      ws.send(JSON.stringify({ id, method, params }));
    });
  fn.next = 1;
  return fn;
})();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const child = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", `--remote-debugging-port=${port}`, "--remote-allow-origins=*", `--user-data-dir=${profile}`, "--window-size=1440,1400", "about:blank"], { stdio: "ignore" });

let passed = 0;
const ok = (name, condition, detail = "") => {
  if (condition) {
    passed += 1;
    console.log(`ok   ${name}`);
  } else {
    console.error(`FAIL ${name}${detail ? ": " + detail : ""}`);
    process.exitCode = 1;
  }
};

const dbDir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const dbFile = fs.readdirSync(dbDir).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite").map((f) => path.join(dbDir, f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
const db = new DatabaseSync(dbFile);

try {
  let version;
  for (let i = 0; i < 60 && !version; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) version = await response.json();
    } catch {
      /* retry */
    }
    if (!version) await sleep(250);
  }
  if (!version) throw new Error("Chrome CDP did not start");
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCookie", { name: "__sites_local_auth", value: "1", domain: "127.0.0.1", path: "/", httpOnly: true });
  await send("Page.navigate", { url: `${base}/training.html#studio` });
  await sleep(9000);
  await send("Page.reload", { ignoreCache: true });
  await sleep(9000);
  await send("Runtime.evaluate", { expression: `document.querySelector('[data-ai-action="tab"]')?.click()` });
  await sleep(2500);
  const switched = await send("Runtime.evaluate", {
    expression: `(() => {
      const select = document.getElementById('ai-subject');
      select.value = '文学口试';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { value: select.value, bankRows: document.querySelectorAll('#ai-bank .ai-bank-row').length };
    })()`,
    returnByValue: true,
  });
  ok("oral subject selected and bank visible", switched.result.value.value === "文学口试" && switched.result.value.bankRows >= 2, JSON.stringify(switched.result.value));

  await send("Runtime.evaluate", { expression: `document.querySelector('[data-ai-action="compose-bank"]')?.click()` });
  await sleep(5000);
  const after = await send("Runtime.evaluate", {
    expression: `({
      hash: location.hash,
      text: document.body.textContent,
      headings: [...document.querySelectorAll('#screen h1,h2')].map((h) => h.textContent.trim()).slice(0, 8),
    })`,
    returnByValue: true,
  });
  const value = after.result.value;
  ok("oral composition opens a packet page", value.hash.startsWith("#packet/"), value.hash);
  ok("oral packet shows the generated prompt", value.text.includes("物哀") && value.text.includes("追问"), value.text.slice(0, 200));
  const archived = await api("/api/archive?kind=packet");
  const record = archived.json?.records?.find((entry) => value.hash === `#packet/${entry.id}`);
  ok("oral packet persisted to the archive", !!record, archived.text.slice(0, 200));
  if (record) {
    const detail = await api(`/api/archive?id=${record.id}`);
    ok("stored oral packet is schema-1 with items", detail.json?.payload?.schema === 1 && detail.json?.payload?.kind === "oral" && detail.json?.payload?.items?.length === 2, JSON.stringify(detail.json?.payload || {}).slice(0, 200));
    db.prepare("DELETE FROM archive_records WHERE id=?").run(record.id);
  }
} finally {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  child.kill();
  db.prepare(`DELETE FROM question_bank WHERE id IN (${seeded.map(() => "?").join(",")})`).run(...seeded.map((entry) => entry.id));
  db.close();
}

console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
