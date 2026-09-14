import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const required = [
  "drizzle/0012_v13_autonomous_newsroom.sql",
  "lib/editorial/autonomous-newsroom.ts",
  "lib/jobs/executors.ts",
  "app/api/newsroom/autonomous/status/route.ts",
  "app/api/newsroom/autonomous/run/route.ts",
  "components/newsroom/autonomous-workspace.tsx",
  "components/google-adsense.tsx",
  "components/google-ad-slot.tsx",
  "app/ads.txt/route.ts",
  "app/story-image/[slug]/route.ts",
  "scripts/configure-final-autonomous-newsroom.ps1",
  "scripts/final-launch.ps1",
  "FINAL_SETUP_AR.md",
];
for (const file of required) {
  assert.equal(existsSync(join(root, file)), true, `Missing required file: ${file}`);
}

for (const forbidden of [
  ".dev.vars",
  ".dev.vars.generated",
  ".env",
  ".env.local",
  "node_modules",
  "dist",
  "outputs",
  "backups",
]) {
  assert.equal(existsSync(join(root, forbidden)), false, `Forbidden package artifact: ${forbidden}`);
}

const wrangler = readFileSync(join(root, "wrangler.jsonc"), "utf8");
const batchSizes = [...wrangler.matchAll(/"max_batch_size"\s*:\s*(\d+)/gu)].map(
  (match) => Number(match[1]),
);
assert.ok(batchSizes.length >= 3, "Queue consumers are missing from Wrangler config.");
assert.ok(batchSizes.every((size) => size <= 2), "Paid AI queue concurrency is too high.");

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(typeof packageJson.scripts?.["final:launch"], "string");
assert.equal(typeof packageJson.scripts?.["test:v13:autonomous"], "string");

const sensitiveNames = new Set([".dev.vars", ".dev.vars.generated", ".env", ".env.local"]);
const suspicious = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if ([".git", "node_modules", "dist", ".next", ".wrangler"].includes(entry)) continue;
    const full = join(directory, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(full);
      continue;
    }
    if (sensitiveNames.has(entry)) suspicious.push(relative(root, full));
  }
}
walk(root);
assert.deepEqual(suspicious, [], `Sensitive runtime files found: ${suspicious.join(", ")}`);

console.log("Northline final package check passed.");
console.log(`Required implementation files: ${required.length}`);
console.log(`Queue max batch sizes: ${batchSizes.join(", ")}`);
