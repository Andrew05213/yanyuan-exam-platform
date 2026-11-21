// HTTP verification for the personal question bank (owner-scoped D1 table).
// Requires `pnpm dev` already running on 127.0.0.1:5173 with local mock auth.
//   node scripts/verify_question_bank_http.mjs [baseUrl]
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const base = process.argv[2] || "http://127.0.0.1:5173";
const cookieJar = new Map();
let cookieHeader = "";

function remember(response) {
  const cookies = response.headers.getSetCookie?.() || [];
  for (const line of cookies) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    cookieJar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  cookieHeader = [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(pathname, { method = "GET", body, origin, authenticated = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (origin) {
    headers.Origin = origin;
    headers["Sec-Fetch-Site"] = "cross-site";
  }
  if (authenticated && cookieHeader) headers.Cookie = cookieHeader;
  const response = await fetch(base + pathname, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  remember(response);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON responses are reported as-is */
  }
  return { status: response.status, json, text, headers: response.headers };
}

const dbDir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const dbFile = fs
  .readdirSync(dbDir)
  .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
  .map((file) => path.join(dbDir, file))
  .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
if (!dbFile) throw new Error("No local D1 sqlite file found. Start pnpm dev first.");
const db = new DatabaseSync(dbFile);

let passed = 0;
function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`ok   ${name}`);
  } else {
    console.error(`FAIL ${name}${detail ? ": " + detail : ""}`);
    process.exitCode = 1;
  }
}

function makeItem(id = `ai-${randomUUID()}`, overrides = {}) {
  return {
    id,
    subject: "英语",
    section: "mc",
    difficulty: "进阶",
    sourceNote: "AI 生成；非官方真题，未经人工审核。",
    title: "QA 题库条目",
    text: "",
    paragraphs: [],
    questions: [
      {
        id: `${id}:q1`,
        stem: "The committee ____ the proposal after a long debate.",
        options: ["turned down", "turned up", "turned in", "turned over"],
        answer: "A",
        analysis: "turn down 表示拒绝；其余为出现、上交、翻转。",
        tag: "动词短语",
        reference: "",
        guide: [],
        followups: [],
      },
    ],
    ...overrides,
  };
}

const signin = await request("/signin-with-chatgpt", { authenticated: false });
ok("mock sign-in sets a session cookie", signin.status < 400 && cookieJar.size > 0, `status ${signin.status}`);
const session = await request("/api/session");
ok("session reports the local user", session.json?.authenticated === true, session.text);
const userId = session.json?.userId;

const anonymous = await fetch(base + "/api/question-bank");
ok("anonymous bank read is 401", anonymous.status === 401, `status ${anonymous.status}`);

const initial = await request("/api/question-bank");
ok("bank list starts as JSON", initial.status === 200 && Array.isArray(initial.json?.items), initial.text);

const item = makeItem();
const created = await request("/api/question-bank", { method: "POST", body: { items: [item] } });
ok("valid item saved", created.status === 201, `${created.status} ${created.text}`);

const listed = await request("/api/question-bank");
const stored = listed.json?.items?.find((entry) => entry.id === item.id);
ok("saved item is listed for its owner", !!stored && stored.item?.questions?.[0]?.answer === "A", listed.text);
ok("saved item is marked pending review", stored?.reviewStatus === "pending");
ok("saved item carries owner scope in D1", (() => {
  const row = db.prepare("SELECT owner_id FROM question_bank WHERE id=?").get(item.id);
  return row?.owner_id === userId;
})(), userId);

const resaved = await request("/api/question-bank", { method: "POST", body: { items: [item] } });
ok("re-saving the same item is idempotent and bumps revision", resaved.status === 201);
const afterResave = (await request("/api/question-bank")).json?.items?.find((entry) => entry.id === item.id);
ok("revision increased after re-save", afterResave?.revision === 2, String(afterResave?.revision));

const approved = await request("/api/question-bank", {
  method: "PUT",
  body: { id: item.id, expectedRevision: 2, reviewStatus: "approved" },
});
ok("review state can be approved", approved.status === 200 && approved.json?.reviewStatus === "approved", approved.text);
const stale = await request("/api/question-bank", {
  method: "PUT",
  body: { id: item.id, expectedRevision: 1, reviewStatus: "pending" },
});
ok("stale review update is rejected", stale.status === 409, `${stale.status} ${stale.text}`);

const crossSite = await request("/api/question-bank", {
  method: "POST",
  body: { items: [makeItem()] },
  origin: "https://evil.example",
});
ok("cross-site save is rejected", crossSite.status === 403, `${crossSite.status} ${crossSite.text}`);

const badItem = makeItem();
badItem.questions[0].options = ["甲", "乙", "丙"];
const invalid = await request("/api/question-bank", { method: "POST", body: { items: [badItem] } });
ok("invalid options rejected", invalid.status === 400, `${invalid.status} ${invalid.text}`);

const tooMany = await request("/api/question-bank", { method: "POST", body: { items: Array.from({ length: 21 }, () => makeItem()) } });
ok("batch larger than 20 rejected", tooMany.status === 400, `${tooMany.status}`);

// Cross-owner probing: seed a foreign row directly, then try to read/overwrite it.
const foreignId = `ai-${randomUUID()}`;
const foreignItem = makeItem(foreignId);
const now = new Date().toISOString();
db.prepare(
  "INSERT INTO question_bank(id,owner_id,subject,section,difficulty,source,review_status,payload,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
).run(foreignId, "other-user", "英语", "mc", "进阶", "ai", "pending", JSON.stringify(foreignItem), 1, now, now);
try {
  const foreignList = (await request("/api/question-bank")).json?.items?.map((entry) => entry.id) || [];
  ok("another user's item is not listed", !foreignList.includes(foreignId));
  const overwrite = await request("/api/question-bank", { method: "POST", body: { items: [makeItem(foreignId)] } });
  ok("another user's id cannot be overwritten", overwrite.status === 409, `${overwrite.status} ${overwrite.text}`);
  const foreignDelete = await request(`/api/question-bank?id=${foreignId}&revision=1`, { method: "DELETE" });
  ok("another user's item cannot be deleted", foreignDelete.status === 409, `${foreignDelete.status}`);
  ok("foreign row still owned by other-user", db.prepare("SELECT owner_id FROM question_bank WHERE id=?").get(foreignId)?.owner_id === "other-user");
} finally {
  db.prepare("DELETE FROM question_bank WHERE id=?").run(foreignId);
}

const current = (await request("/api/question-bank")).json?.items?.find((entry) => entry.id === item.id);
const removed = await request(`/api/question-bank?id=${item.id}&revision=${current.revision}`, { method: "DELETE" });
ok("owner can delete their item", removed.status === 200, `${removed.status} ${removed.text}`);
ok("deleted item is gone", !((await request("/api/question-bank")).json?.items || []).some((entry) => entry.id === item.id));

db.close();
console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
