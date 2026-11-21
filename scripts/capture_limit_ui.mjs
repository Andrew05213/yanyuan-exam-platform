// Demonstrates the 429 UI: seeds quota rows, opens the AI panel, clicks
// generate, captures the countdown state and a screenshot.
//   node scripts/capture_limit_ui.mjs
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const base = "http://127.0.0.1:5173";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9339;
const profile = path.resolve(".sites-runtime/chrome-limit");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync("artifacts", { recursive: true });

const dir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const file = fs.readdirSync(dir).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite").map((f) => path.join(dir, f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
const db = new DatabaseSync(file);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const seeded = [];
for (let index = 0; index < 6; index += 1) {
  const id = "seed-" + randomUUID();
  const stamp = new Date(Date.now() - (index + 1) * 60000).toISOString();
  db.prepare("INSERT INTO ai_question_jobs(id,owner_id,request_hash,status,model,elapsed_ms,result,error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id, "local_seedy", hash(id), "succeeded", "seed", 1, "[]", null, stamp, stamp);
  seeded.push(id);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const child = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", `--remote-debugging-port=${port}`, "--remote-allow-origins=*", `--user-data-dir=${profile}`, "--window-size=1440,1200", "about:blank"], { stdio: "ignore" });
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
  await send("Runtime.evaluate", { expression: `document.querySelector('[data-ai-action="tab"]')?.click()` });
  await sleep(2000);
  await send("Runtime.evaluate", {
    expression: `(() => {
      const topic = document.getElementById('ai-topic');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(topic, '限流测试主题');
      topic.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('ai-generate')?.click();
    })()`,
  });
  await sleep(4000);
  const state = await send("Runtime.evaluate", {
    expression: `({
      status: document.getElementById('ai-status')?.textContent || null,
      button: document.getElementById('ai-generate')?.textContent || null,
      disabled: document.getElementById('ai-generate')?.disabled ?? null,
      error: document.getElementById('ai-error')?.textContent?.trim() || null,
    })`,
    returnByValue: true,
  });
  console.log(JSON.stringify(state.result.value, null, 2));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("artifacts/studio-ai-limit.png", Buffer.from(shot.data, "base64"));
  console.log("screenshot: artifacts/studio-ai-limit.png");
} finally {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  child.kill();
  for (const id of seeded) db.prepare("DELETE FROM ai_question_jobs WHERE id=?").run(id);
  db.close();
}
