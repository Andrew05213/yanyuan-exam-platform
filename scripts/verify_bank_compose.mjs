// End-to-end check for the personal-bank composition path:
// seed bank items over HTTP -> open the studio in headless Chrome -> switch to
// the AI tab -> "用我的题库组卷" -> assert a normal packet page was produced and
// persisted through /api/archive. Cleans up its own rows afterwards.
//   node scripts/verify_bank_compose.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const base = "http://127.0.0.1:5173";
const cookie = "__sites_local_auth=1";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9337;
const profile = path.resolve(".sites-runtime/chrome-compose");
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

function item(subject = "英语") {
  const id = `ai-${randomUUID()}`;
  return {
    id,
    subject,
    section: "mc",
    difficulty: "进阶",
    sourceNote: "AI 生成；非官方真题，未经人工审核。",
    title: `QA 组卷条目 ${id.slice(3, 8)}`,
    text: "",
    paragraphs: [],
    questions: [
      {
        id: `${id}:q1`,
        stem: "The new policy will ____ effect next month.",
        options: ["take", "make", "do", "get"],
        answer: "A",
        analysis: "take effect 为固定搭配，表示生效。",
        tag: "固定搭配",
        reference: "",
        guide: [],
        followups: [],
      },
    ],
  };
}

const seeded = [item(), item(), item()];
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
  const before = await send("Runtime.evaluate", {
    expression: `({
      authenticated: !!(typeof PublicApp !== 'undefined' && PublicApp.session?.authenticated),
      bankRows: document.querySelectorAll('#ai-bank .ai-bank-row').length,
      studioUnits: ((typeof TierStudio !== 'undefined' ? TierStudio.data?.items : []) || []).filter((u) => String(u.id).startsWith('ai-bank:')).length,
      storedItems: (window.AIStudio?.state?.bank || []).length,
      bankTotal: (window.AIStudio?.state?.bank || []).filter((r) => r.item?.subject === '英语').length,
    })`,
    returnByValue: true,
  });
  ok("bank items reach the studio UI", before.result.value.bankRows >= 3, JSON.stringify(before.result.value));
  ok("bank items merge into the standard paper catalog", before.result.value.studioUnits >= 3, JSON.stringify(before.result.value));

  await send("Runtime.evaluate", { expression: `document.querySelector('[data-ai-action="compose-bank"]')?.click()` });
  await sleep(5000);
  const after = await send("Runtime.evaluate", {
    expression: `({
      hash: location.hash,
      paper: !!document.querySelector('.flow-mixed-paper'),
      questions: document.querySelectorAll('.flow-mixed-question').length,
      title: document.querySelector('.exam-header h1')?.textContent || null,
      saved: document.querySelector('.hub-cloud-state')?.textContent || null,
      blocks: [...document.querySelectorAll('.flow-section-summary span')].map((s) => s.textContent.trim()),
      note: document.querySelector('.help-note')?.textContent?.slice(0, 120) || null,
    })`,
    returnByValue: true,
  });
  const value = after.result.value;
  ok("composition opens a normal packet page", value.hash.startsWith("#packet/"), value.hash);
  ok("packet renders one question per bank item", value.questions === before.result.value.bankTotal, `${value.questions} vs ${before.result.value.bankTotal}`);
  ok("packet is persisted to the archive", /已保存/.test(value.saved || ""), value.saved);
  ok("packet note states AI generated / pending review", /AI|待审核/.test(value.note || ""), value.note);

  const archived = await api("/api/archive?kind=packet");
  const record = archived.json?.records?.find((entry) => value.hash === `#packet/${entry.id}`);
  ok("archive API returns the composed packet", !!record, archived.text.slice(0, 200));
  if (record) {
    const detail = await api(`/api/archive?id=${record.id}`);
    const payload = detail.json?.payload;
    ok("stored packet is a standard schema-2 written packet", payload?.schema === 2 && payload?.kind === "written");
    ok("stored packet keeps question sourceIds", (payload?.blocks || []).flatMap((b) => b.questions).every((q) => typeof q.sourceId === "string"));
    if (record) {
      const rid = payload?.blocks?.[0]?.questions?.[0]?.sourceId;
      ok("sourceId points back to the bank item", (seeded.some((s) => s.questions[0].id === rid)), String(rid));
      // Remove the composed packet created by this test.
      db.prepare("DELETE FROM archive_records WHERE id=?").run(record.id);
    }
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
