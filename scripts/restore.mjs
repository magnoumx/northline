#!/usr/bin/env node
import "./lib/load-env.mjs";
// Restore a D1 database from a SQL dump via wrangler.
// Usage:
//   npm run db:restore -- --file=backups/d1.sql           (local)
//   npm run db:restore -- --file=backups/d1.sql --remote  (remote)
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : fallback;
};
const name = value("name", "site-creator-d1");
const remote = args.includes("--remote");
const file = value("file", null);

if (!file) {
  console.error("Restore requires --file=<path-to-sql-dump>");
  process.exit(1);
}
const target = resolve(file);
if (!existsSync(target)) {
  console.error(`Backup file not found: ${target}`);
  process.exit(1);
}
const scope = remote ? "--remote" : "--local";
console.log(`Restoring ${target} into D1 "${name}" (${remote ? "remote" : "local"})`);
console.log("WARNING: this overwrites existing rows. Proceed only on a known-good backup.");
const result = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", name, scope, "--file", target, "--yes"],
  { stdio: "inherit", shell: true },
);
if (result.status !== 0) {
  console.error("Restore failed.");
  process.exit(result.status ?? 1);
}
console.log("Restore complete.");
