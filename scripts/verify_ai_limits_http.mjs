// HTTP checks for AI generation limits, idempotent replay and request-id
// reuse, without calling a model (jobs are seeded directly in local D1).
//   node --experimental-strip-types scripts/verify_ai_limits_http.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { generationPlan } from "../lib/ai-question-generation.ts";

const base = "http://127.0.0.1:5173";
const cookie = "__sites_local_auth=1";
const hash = (value) => createHash("sha256").update(value).digest("hex");

const dbDir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const dbFile = fs
  .readdirSync(dbDir)
  .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
  .map((file) => path.join(dbDir, file))
  .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
const db = new DatabaseSync(dbFile);

async function api(pathname, { method = "GET", body } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: response.status, json, text };
}

const planBody = { subject: "日本国别", type: "mc", difficulty: "进阶", topic: "QA 限流主题", count: 3 };
const plan = generationPlan(planBody);
const requestHash = hash(JSON.stringify(plan));

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

const seeded = [];
function seed({ requestId = randomUUID(), status = "succeeded", result = null, error = null, minutesAgo = 0, owner = "local_seedy", requestHashValue = requestHash }) {
  const id = "gen-" + hash(`${owner}|${requestId}`);
  const stamp = new Date(Date.now() - minutesAgo * 60000).toISOString();
  db.prepare(
    "INSERT INTO ai_question_jobs(id,owner_id,request_hash,status,model,elapsed_ms,result,error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
  ).run(id, owner, requestHashValue, status, "test-model", 1234, result, error, stamp, stamp);
  seeded.push(id);
  return { id, requestId };
}

try {
  const session = await api("/api/session");
  ok("mock session active", session.json?.authenticated === true, session.text);
  const userId = session.json.userId;

  db.prepare("DELETE FROM ai_question_jobs WHERE owner_id=?").run(userId);

  // Validation before any model access.
  const noId = await api("/api/ai-questions", { method: "POST", body: planBody });
  ok("missing requestId rejected", noId.status === 400 && /请求编号/.test(noId.json?.error || ""), `${noId.status} ${noId.text}`);
  const tooMany = await api("/api/ai-questions", { method: "POST", body: { ...planBody, count: 11, requestId: randomUUID() } });
  ok("count above global cap rejected", tooMany.status === 400 && /题量/.test(tooMany.json?.error || ""), `${tooMany.status} ${tooMany.text}`);

  // Rate limit: six rows in the last ten minutes.
  for (let index = 0; index < 6; index += 1) seed({ minutesAgo: index + 1, result: "[]" });
  const limited = await api("/api/ai-questions", { method: "POST", body: { ...planBody, requestId: randomUUID() } });
  ok("rate limit returns 429", limited.status === 429, `${limited.status} ${limited.text}`);
  ok("429 carries retry seconds and limit metadata", limited.json?.retryAfterSeconds > 0 && limited.json?.limit?.maxPerWindow === 6, limited.text);
  ok("429 message explains the window", /请求过于频繁/.test(limited.json?.error || ""), limited.text);

  // Remove the limit rows, then verify idempotent replay of a completed job.
  db.prepare("DELETE FROM ai_question_jobs WHERE owner_id=?").run(userId);
  const replayRequestId = randomUUID();
  seed({ requestId: replayRequestId, status: "succeeded", result: JSON.stringify([{ id: "ai-cached", title: "缓存题" }]) });
  const replay = await api("/api/ai-questions", { method: "POST", body: { ...planBody, requestId: replayRequestId } });
  ok("completed request replays without a model call", replay.status === 200 && replay.json?.deduplicated === true, `${replay.status} ${replay.text}`);
  ok("replay keeps model and elapsed time", replay.json?.model === "test-model" && replay.json?.elapsedMs === 1234, replay.text);
  ok("replay returns stored items", replay.json?.items?.[0]?.id === "ai-cached", replay.text);

  const changed = await api("/api/ai-questions", { method: "POST", body: { ...planBody, topic: "另一个主题", requestId: replayRequestId } });
  ok("reusing a requestId for different content is rejected", changed.status === 409 && /不同内容/.test(changed.json?.error || ""), `${changed.status} ${changed.text}`);

  db.prepare("DELETE FROM ai_question_jobs WHERE owner_id=?").run(userId);
  const pendingRequestId = randomUUID();
  seed({ requestId: pendingRequestId, status: "pending", result: null });
  const pending = await api("/api/ai-questions", { method: "POST", body: { ...planBody, requestId: pendingRequestId } });
  ok("in-flight duplicate asks the client to wait", pending.status === 409 && pending.json?.retryAfterSeconds === 5, `${pending.status} ${pending.text}`);

  // A fresh request either has no provider (503, no row) or reaches an upstream
  // that rejects the credential (502, failed row recorded, still no questions).
  db.prepare("DELETE FROM ai_question_jobs WHERE owner_id=?").run(userId);
  const fresh = await api("/api/ai-questions", { method: "POST", body: { ...planBody, requestId: randomUUID() } });
  const freshRows = db.prepare("SELECT status FROM ai_question_jobs WHERE owner_id=?").all(userId);
  ok(
    "fresh request fails closed with 502/503",
    fresh.status === 503 || fresh.status === 502,
    `${fresh.status} ${fresh.text}`,
  );
  ok(
    "failed upstream attempt is recorded and returns no items",
    fresh.status === 503 ? freshRows.length === 0 : freshRows.length === 1 && freshRows[0].status === "failed" && !fresh.json?.items,
    JSON.stringify(freshRows),
  );
} finally {
  for (const id of seeded) db.prepare("DELETE FROM ai_question_jobs WHERE id=?").run(id);
  db.prepare("DELETE FROM ai_question_jobs WHERE owner_id=?").run("local_seedy");
  db.close();
}

console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
