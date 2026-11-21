// Full browser flow with a real model call:
// generate -> preview -> save to bank -> compose -> answer -> submit ->
// add to mistakes -> redo -> reload and verify persisted records.
//   node scripts/verify_full_flow.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const base = "http://127.0.0.1:5173";
const cookie = "__sites_local_auth=1";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9341;
const profile = path.resolve(".sites-runtime/chrome-full");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync("artifacts", { recursive: true });

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
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
};
async function waitFor(expression, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await evaluate(expression);
    if (value) return value;
    await sleep(1000);
  }
  return null;
}

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
  if (!version) throw new Error("Chrome did not start");
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

  // 1. Open AI tab and fill a real generation request.
  await evaluate(`document.querySelector('[data-ai-action="tab"]')?.click()`);
  await sleep(2000);
  const configured = await evaluate(`(() => {
    const set = (id, value) => {
      const el = document.getElementById(id);
      const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('ai-subject', '日本国别');
    set('ai-difficulty', '进阶');
    set('ai-topic', '日本少子老龄化');
    set('ai-type', 'mc');
    set('ai-count', '3');
    set('ai-minutes', '40');
    return { type: document.getElementById('ai-type').value, count: document.getElementById('ai-count').value, ready: document.getElementById('ai-ready')?.textContent };
  })()`);
  ok("AI form configured for a real request", configured?.type === "mc" && configured?.count === "3", JSON.stringify(configured));

  await evaluate(`document.getElementById('ai-generate')?.click()`);
  const preview = await waitFor(`document.querySelectorAll('.ai-preview-item').length > 0 ? document.querySelectorAll('.ai-preview-item').length : 0`, 120000);
  ok("model response renders in the preview", preview >= 1, String(preview));
  const previewText = await evaluate(`document.getElementById('ai-preview')?.innerText || ''`);
  ok("preview marks AI output as pending review", previewText.includes("AI 生成 · 待审核"), previewText.slice(0, 160));
  ok("preview shows answer and analysis", previewText.includes("答案：") && previewText.includes("解析："), previewText.slice(0, 200));

  // 2. Save to the personal bank.
  await evaluate(`document.querySelector('[data-ai-action="save"]')?.click()`);
  const bankRows = await waitFor(`document.querySelectorAll('#ai-bank .ai-bank-row').length`, 30000);
  ok("questions are saved to the personal bank", bankRows >= 3, String(bankRows));

  // 3. Compose from the bank.
  await evaluate(`document.querySelector('[data-ai-action="compose-bank"]')?.click()`);
  const composed = await waitFor(`location.hash.startsWith('#packet/') && document.querySelectorAll('.flow-mixed-question').length`, 20000);
  const questions = await evaluate(`document.querySelectorAll('.flow-mixed-question').length`);
  ok("bank questions compose a standard packet", composed && questions >= 3, `hash=${await evaluate(`location.hash`)} questions=${questions}`);

  // 4. Answer every question with A, then submit.
  await evaluate(`(() => {
    [...document.querySelectorAll('.flow-mixed-question')].forEach((question, index) => {
      const radios = question.querySelectorAll('input[type="radio"]');
      const radio = radios[Math.min(index, radios.length - 1)];
      if (radio) radio.click();
    });
  })()`);
  await sleep(800);
  await evaluate(`document.querySelector('[data-flow="submit-mixed"]')?.click()`);
  const submitted = await waitFor(`document.querySelector('.hub-result') ? true : false`, 30000);
  const submitText = await evaluate(`document.querySelector('.hub-result')?.innerText || ''`);
  ok("answers are graded and submitted", submitted === true, submitText.slice(0, 160));
  ok("attempt is saved to the cloud", /已保存云端/.test(await evaluate(`document.body.innerText`)), submitText.slice(0, 160));

  // 5. Record mistakes from the submitted packet.
  await evaluate(`document.querySelector('[data-flow="packet-errors"]')?.click()`);
  const mistakeReady = await waitFor(`document.getElementById('mistake-input') ? true : false`, 20000);
  ok("packet opens the mistake workbench", mistakeReady === true);
  await evaluate(`(() => {
    const area = document.getElementById('mistake-input');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(area, '1A、2B、3C');
    area.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(500);
  await evaluate(`document.getElementById('mistake-analyse')?.click()`);
  const mistakePage = await waitFor(`location.hash.startsWith('#mistake/') ? location.hash : ''`, 30000);
  ok("mistake snapshot is archived", !!mistakePage, String(mistakePage));

  // 6. Redo the mistake set.
  await evaluate(`document.querySelector('[data-flow="toggle-redo"]')?.click()`);
  await sleep(800);
  await evaluate(`(() => {
    for (const radio of document.querySelectorAll('[data-redo-answer]')) {
      if (radio.value === 'B') radio.click();
    }
  })()`);
  await sleep(600);
  await evaluate(`document.querySelector('[data-flow="submit-redo"]')?.click()`);
  const redoText = await waitFor(`document.getElementById('mistake-redo-result')?.textContent?.includes('已单列保存') ? document.getElementById('mistake-redo-result').textContent : ''`, 30000);
  ok("redo attempt is saved separately", !!redoText, String(redoText));

  // 7. Reload and verify persistence and archive kinds.
  await send("Page.reload", { ignoreCache: true });
  await sleep(8000);
  await evaluate(`location.hash = '#saved'`);
  await sleep(5000);
  const archiveText = await evaluate(`document.body.innerText`);
  ok("saved archive renders after reload", /训练卷|错题档案|笔试作答/.test(archiveText), archiveText.slice(0, 200));
  const archive = await fetch(base + "/api/archive", { headers: { Cookie: cookie } }).then((response) => response.json());
  const kinds = archive.records.map((record) => record.kind);
  ok("packet, attempt, error set and redo persist in D1", ["packet", "written-attempt", "error-set", "review-attempt"].every((kind) => kinds.includes(kind)), JSON.stringify(kinds));
  const bank = await fetch(base + "/api/question-bank", { headers: { Cookie: cookie } }).then((response) => response.json());
  ok("bank still shows pending review after reload", bank.items?.some((entry) => entry.reviewStatus === "pending"), JSON.stringify(bank.items?.map((entry) => entry.reviewStatus)));

  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("artifacts/full-flow-archive.png", Buffer.from(shot.data, "base64"));
  console.log("screenshot: artifacts/full-flow-archive.png");
} finally {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  child.kill();
}

console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
