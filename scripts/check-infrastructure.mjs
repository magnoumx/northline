import "./lib/load-env.mjs";
// Static infrastructure check: verifies wrangler.jsonc declares the bindings
// the Northline Worker depends on. Does NOT require real Cloudflare resources
// to exist — it only confirms the configuration shape is production-ready.
// Run with: npm run infrastructure:check
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_R2 = ["ARTICLE_AUDIO", "MEDIA", "MEDIA_QUARANTINE"];
const EXPECTED_PRODUCERS = [
  "EDITORIAL_QUEUE",
  "EDITORIAL_DLQ",
  "MEDIA_QUEUE",
  "MEDIA_DLQ",
  "AD_EVENT_QUEUE",
  "AD_EVENT_DLQ",
];
const EXPECTED_CONSUMERS = [
  { queue: "northline-editorial", deadLetter: "northline-editorial-dlq" },
];
const EXPECTED_CRONS = ["*/15 * * * *", "0 0 * * *", "0 0 1 * *"];
const EXPECTED_ENVS = ["preview", "production"];

function readWranglerConfig() {
  const raw = readFileSync(resolve("wrangler.jsonc"), "utf8");
  const stripped = raw.replace(/^\s*\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, "");
  return JSON.parse(stripped);
}

function fail(message) {
  console.error(`INFRA CHECK FAILED: ${message}`);
  process.exitCode = 1;
}

const config = readWranglerConfig();
let problems = 0;
const note = (m) => {
  console.log(`  ok: ${m}`);
};
const miss = (m) => {
  problems += 1;
  fail(m);
};

const r2 = (config.r2_buckets ?? []).map((b) => b.binding);
for (const binding of EXPECTED_R2) {
  (r2.includes(binding) ? note : miss)(`R2 binding ${binding} declared`);
}

const producers = (config.queues?.producers ?? []).map((q) => q.binding);
for (const binding of EXPECTED_PRODUCERS) {
  (producers.includes(binding) ? note : miss)(
    `Queue producer ${binding} declared`,
  );
}

const crons = config.triggers?.crons ?? [];
for (const cron of EXPECTED_CRONS) {
  (crons.includes(cron) ? note : miss)(`Cron trigger ${cron} declared`);
}

const consumers = config.queues?.consumers ?? [];
for (const expected of EXPECTED_CONSUMERS) {
  const found = consumers.some(
    (c) =>
      c.queue === expected.queue &&
      c.dead_letter_queue === expected.deadLetter,
  );
  (found ? note : miss)(
    `Queue consumer ${expected.queue} → DLQ ${expected.deadLetter} declared`,
  );
}

for (const envName of EXPECTED_ENVS) {
  (config.env?.[envName] ? note : miss)(
    `Environment override ${envName} declared`,
  );
}

const d1 = (config.d1_databases ?? [])[0];
if (!d1?.binding || d1.binding !== "DB") {
  miss("D1 binding DB declared");
} else if (d1.database_id === "00000000-0000-4000-8000-000000000000") {
  console.log("  warn: D1 database_id is still the zero-UUID placeholder — replace with the real id from `wrangler d1 create` before deploy.");
  note("D1 binding DB declared (placeholder id)");
} else {
  note("D1 binding DB declared with a real-looking id");
}

if (problems === 0) {
  console.log("\nInfrastructure check passed: all expected bindings are declared.");
} else {
  console.error(`\nInfrastructure check failed: ${problems} missing binding(s).`);
}
