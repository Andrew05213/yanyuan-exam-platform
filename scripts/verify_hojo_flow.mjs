// Real end-to-end literature practice for 《丰饶之海》:
// create a personal material -> open it -> submit evidence/answer to DeepSeek ->
// check quote/suggestion/two followups -> write revision -> save -> reload and
// confirm the note exists. Cleans nothing (the material/note are study content).
//   node scripts/verify_hojo_flow.mjs
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const base = "http://127.0.0.1:5173";
const cookie = "__sites_local_auth=1";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9340;
const profile = path.resolve(".sites-runtime/chrome-hojo");
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync("artifacts", { recursive: true });

const evidence = "《丰饶之海》第四部《天人五衰》结尾，本多在月修寺见到聪子；聪子否认与清显相识，并表示“什么也没有”。（三岛由纪夫《天人五衰》）";
const answer = "这个结尾让前几卷的轮回线索变得不可确证：如果聪子否认清显，读者就无法判断本多此前的转世辨认是真实发生，还是他自己的投射。它把四部曲从“轮回是否发生”转向“本多为何需要轮回”，因此结尾不是给出答案，而是迫使读者重新解释前面的证据。";
const revision = "补充：不可确证不等于轮回被证伪。小说保留了两读：一是本多的辨认确实对应某种转生，二是他把偶然相似误读为证据。结尾的力量在于让两种读法都缺少最终裁判，从而把判断责任交还给读者。";

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
const child = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", `--remote-debugging-port=${port}`, "--remote-allow-origins=*", `--user-data-dir=${profile}`, "--window-size=1440,1200", "about:blank"], { stdio: "ignore" });

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
  await send("Page.navigate", { url: `${base}/literature` });
  await sleep(9000);

  const opened = await evaluate(`(() => {
    const title = [...document.querySelectorAll('h1,h2,h3,button,a')].find((el) => el.textContent.trim() === '丰饶之海');
    const target = title?.closest('button,a') || title;
    target?.click();
    return !!target;
  })()`);
  ok("personal material appears and opens", opened === true);
  await sleep(2500);

  const filled = await evaluate(`(() => {
    const practice = document.querySelector('.practice');
    if (!practice) return { error: 'no practice' };
    practice.open = true;
    const areas = [...practice.querySelectorAll('textarea')];
    const setValue = (element, value) => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setValue(areas[0], ${JSON.stringify(evidence)});
    setValue(areas[1], ${JSON.stringify(answer)});
    return { areas: areas.length, question: practice.querySelector('summary')?.textContent || '' };
  })()`);
  ok("practice form is available", filled?.areas === 3, JSON.stringify(filled));
  await sleep(500);

  await evaluate(`(() => {
    const practice = document.querySelector('.practice');
    [...practice.querySelectorAll('button')].find((b) => b.textContent.includes('提交给 DeepSeek'))?.click();
  })()`);
  const started = Date.now();

  let feedback = "";
  for (let i = 0; i < 50; i += 1) {
    await sleep(1500);
    feedback = await evaluate(`document.querySelector('.practice')?.innerText || ''`);
    if (feedback.includes("追问 1")) break;
  }
  const elapsedMs = Date.now() - started;
  const model = (/^([\w.-]+)\n/.exec(feedback) || [])[1] || null;
  const checks = {
    studentQuote: /你的回答 · \S/.test(feedback),
    evidenceQuote: /你提交的依据 · \S/.test(feedback),
    gap: /证据缺口 · \S/.test(feedback),
    suggestion: /修改建议 · \S/.test(feedback),
    twoQuestions: /追问 1 · \S/.test(feedback) && /追问 2 · \S/.test(feedback),
    quoteFromAnswer: (() => {
      const match = /你的回答 · (.*)/.exec(feedback);
      return !!match && answer.includes(match[1].trim());
    })(),
  };
  ok("feedback shows the student's exact quote", checks.studentQuote && checks.quoteFromAnswer, JSON.stringify(checks));
  ok("feedback shows evidence quote, gap and suggestion", checks.evidenceQuote && checks.gap && checks.suggestion, JSON.stringify(checks));
  ok("feedback contains two distinct follow-up questions", checks.twoQuestions, JSON.stringify(checks));

  await evaluate(`(() => {
    const practice = document.querySelector('.practice');
    const areas = [...practice.querySelectorAll('textarea')];
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(areas[2], ${JSON.stringify(revision)});
    areas[2].dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(700);
  await evaluate(`(() => {
    const practice = document.querySelector('.practice');
    const button = [...practice.querySelectorAll('button')].find((b) => b.textContent.includes('保存到学习档案'));
    button?.click();
  })()`);
  let notice = "";
  for (let i = 0; i < 15; i += 1) {
    await sleep(700);
    notice = await evaluate(`document.body.innerText`);
    if (notice.includes("已保存两稿")) break;
  }
  ok("practice saves with revision", notice.includes("已保存两稿"), notice.slice(-160));

  await send("Page.reload", { ignoreCache: true });
  await sleep(7000);
  await evaluate(`(() => {
    const tab = document.querySelector('[role="tab"][id$="trigger-notes"]');
    if (!tab) return false;
    tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }));
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    tab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }));
    tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
    tab.click();
    return true;
  })()`);
  await sleep(4000);
  const notes = await evaluate(`document.body.innerText`);
  const saved = await fetch(base + "/api/literature/entries", { headers: { Cookie: cookie } }).then((response) => response.json());
  const record = saved.find((entry) => entry.title === "面试复练 · 丰饶之海");
  ok("note persists after reload", notes.includes("面试复练 · 丰饶之海") && !!record, `${notes.slice(0, 120)} / ${record ? "api-ok" : "api-missing"}`);
  ok("saved note keeps feedback and revision", !!record && record.content.includes("AI 反馈") && record.content.includes("复练回答") && record.content.includes("追问 2"), record ? String(record.content.length) : "missing");

  const redact = (text, limit = 60) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length > limit ? `${clean.slice(0, limit)}…（已脱敏，共 ${clean.length} 字）` : clean;
  };
  const artifact = {
    checkedAt: new Date().toISOString(),
    base,
    topic: "《丰饶之海》与轮回",
    question: "系列结尾怎样改变读者对前几卷轮回线索的解释？",
    input: {
      evidenceLength: evidence.length,
      evidenceSha256: createHash("sha256").update(evidence).digest("hex").slice(0, 16),
      answerLength: answer.length,
      answerSha256: createHash("sha256").update(answer).digest("hex").slice(0, 16),
      revisionLength: revision.length,
    },
    status: Object.values(checks).every(Boolean) && !!record ? "succeeded" : "invalid",
    elapsedMs,
    model,
    checks,
    feedback: { lines: feedback.split("\n\n").map((line) => redact(line)), length: feedback.length },
    note: record ? { id: record.id, title: record.title, contentLength: record.content.length } : null,
  };
  const artifactFile = path.join("artifacts", `literature-hojo-${artifact.checkedAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(artifactFile, JSON.stringify(artifact, null, 2));
  console.log(`model=${model} elapsed=${elapsedMs}ms`);
  console.log("artifact:", artifactFile);
  if (artifact.status !== "succeeded") process.exitCode = 1;

  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("artifacts/literature-hojo.png", Buffer.from(shot.data, "base64"));
  console.log("screenshot: artifacts/literature-hojo.png");
} finally {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  child.kill();
}

console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
