// Headless Chrome driver for local UI verification. Injects the mock-auth
// cookie (HttpOnly, so document.cookie cannot set it), opens the studio page,
// clicks the AI tab, reports a few DOM facts and writes a screenshot.
//   node scripts/capture_studio.mjs <out.png> [url]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] || "artifacts/studio-ai.png";
const url = process.argv[3] || "http://127.0.0.1:5173/training.html#studio";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9335;
const profile = path.resolve(".sites-runtime/chrome-cdp");
fs.mkdirSync(profile, { recursive: true });

const child = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${profile}`,
    "--window-size=1440,1200",
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error("timeout waiting for Chrome");
}

let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = send.next++;
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
}
send.next = 1;

try {
  const version = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    return response.ok ? response.json() : null;
  });
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCookie", { name: "__sites_local_auth", value: "1", domain: "127.0.0.1", path: "/", httpOnly: true });
  const cookies = await send("Network.getCookies", { urls: [url] });
  console.log("cookies:", JSON.stringify(cookies.cookies));
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:5173/signin-with-chatgpt?return_to=/training.html%23studio" });
  await sleep(2500);
  await send("Page.navigate", { url });
  await sleep(6000);
  await send("Page.reload", { ignoreCache: true });
  await sleep(9000);
  await send("Runtime.evaluate", { expression: "document.querySelector('[data-ai-action=\"tab\"]')?.click()" });
  await sleep(1200);
  const diagnostics = await send("Runtime.evaluate", {
    expression: `(async () => {
      const panel = document.getElementById('ai-studio');
      const status = document.getElementById('ai-ready');
      const generate = document.getElementById('ai-generate');
      const bank = document.getElementById('ai-bank');
      const session = window.PublicApp?.session;
      let probe = null;
      try { probe = await (await fetch('/api/session')).json(); } catch (error) { probe = { error: String(error) }; }
      return {
        title: document.title,
        authenticated: !!session?.authenticated,
        view: location.hash,
        panel: !!panel,
        panelHidden: panel?.hidden ?? null,
        tabs: [...document.querySelectorAll('.flow-tabs button')].map((b) => b.textContent.trim()),
        ready: status?.textContent || null,
        generateDisabled: generate?.disabled ?? null,
        bankText: (bank?.textContent || '').trim().slice(0, 120),
        error: document.getElementById('ai-error')?.textContent?.trim() || '',
        scripts: [...document.scripts].map((s) => s.src.split('/').pop()).filter(Boolean),
        probe,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log(JSON.stringify(diagnostics.result.value, null, 2));
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`screenshot: ${out}`);
} finally {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  child.kill();
}
