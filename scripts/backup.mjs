#!/usr/bin/env node
import "./lib/load-env.mjs";
// Backup a D1 database to a timestamped SQL dump via wrangler.
// Usage:
//   npm run db:backup                 (local, default db)
//   npm run db:backup -- --remote     (remote production db)
//   npm run db:backup -- --name=northline-d1 --remote --out=backups/d1.sql
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : fallback;
};

const name = value("name", "site-creator-d1");
const remote = flag("--remote");
const scope = remote ? "--remote" : "--local";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(value("out-dir", "backups"));
mkdirSync(outDir, { recursive: true });
const out = value("out", `${outDir}/${name}-${stamp}.sql`);

console.log(`Backing up D1 "${name}" (${remote ? "remote" : "local"}) -> ${out}`);
const result = spawnSync(
  "npx",
  ["wrangler", "d1", "export", name, scope, "--output", out],
  { stdio: "inherit", shell: true },
);
if (result.status !== 0) {
  console.error("Backup failed. Ensure wrangler is authenticated and the database exists.");
  process.exit(result.status ?? 1);
}
console.log(`Backup written: ${out}`);
