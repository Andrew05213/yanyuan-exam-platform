// Exports personal literature notes and materials to a JSON file, separate from
// any source archive. The auth cookie is read from --cookie or HEZHI_COOKIE and
// is never written to the output.
//   node scripts/export_personal_data.mjs --base http://127.0.0.1:5173 \
//     --cookie "__sites_local_auth=1" --out ../versions/personal-export.json
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = (value("base") || "http://127.0.0.1:5173").replace(/\/$/, "");
const cookie = value("cookie") || process.env.HEZHI_COOKIE || "";
const out = value("out");
if (!cookie) {
  console.error("Missing --cookie or HEZHI_COOKIE");
  process.exit(2);
}
if (!out) {
  console.error("Missing --out");
  process.exit(2);
}

async function get(pathname) {
  const response = await fetch(base + pathname, { headers: { Cookie: cookie } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} -> ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const entries = await get("/api/literature/entries");
const materials = await get("/api/literature/materials");
const payload = {
  exportedAt: new Date().toISOString(),
  base,
  format: "hezhi-literature-export-v1",
  counts: { entries: entries.length, materials: materials.length },
  entries,
  materials,
};
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`entries=${entries.length} materials=${materials.length} -> ${path.resolve(out)}`);
