#!/usr/bin/env node
// Offline D1 migration applier for local development on machines where
// `wrangler d1 migrations apply --local` cannot start the Workers runtime.
// It mirrors wrangler's ledger and ordering exactly, so a later wrangler run
// (for example lan/start-built.sh on Linux) sees the same d1_migrations rows.
//
// Usage:
//   node scripts/apply-d1-migrations.mjs --db <path.sqlite> [--dir drizzle]
//
// The D1 sqlite file for `pnpm dev` lives under
//   .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
// and is created on the first request that touches the DB binding.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const dbPath = value("db");
const migrationsDir = path.resolve(value("dir") || "drizzle");
const table = value("table") || "d1_migrations";

if (!dbPath) {
  console.error("Missing --db <path.sqlite>");
  process.exit(2);
}
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(2);
}

const db = new DatabaseSync(dbPath);
db.exec(
  `CREATE TABLE IF NOT EXISTS ${table}(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
	);`,
);

const applied = new Set(
  db.prepare(`SELECT name FROM ${table}`).all().map((row) => row.name),
);

const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

let count = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip    ${file}`);
    continue;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  const statements = sql
    .split(/-->\s*statement-breakpoint/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  db.exec("BEGIN");
  try {
    for (const statement of statements) db.exec(statement);
    db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(file);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    console.error(`failed  ${file}: ${error.message}`);
    process.exit(1);
  }
  console.log(`applied ${file}`);
  count += 1;
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((row) => row.name);
console.log(`\n${count} migration(s) applied. Tables: ${tables.join(", ")}`);
db.close();
