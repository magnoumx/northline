#!/usr/bin/env node
import "./lib/load-env.mjs";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, writeFileSync } from "node:fs";

const outputPath = process.argv.includes("--write") ? ".dev.vars.generated" : null;
const force = process.argv.includes("--force");
const names = [
  "ADMIN_BOOTSTRAP_TOKEN",
  "AUTH_SESSION_SECRET",
  "AUTH_MFA_ENCRYPTION_KEY",
  "CONFIG_ENCRYPTION_KEY",
  "RATE_LIMIT_SECRET",
  "CSRF_SECRET",
  "CRON_SECRET",
  "WEBHOOK_SIGNING_SECRET",
  "NEWSLETTER_CONFIRMATION_SECRET",
  "NEWSLETTER_UNSUBSCRIBE_SECRET",
  "AD_TOKEN_SECRET",
  "AD_EVENT_HASH_SECRET",
  "AD_LEAD_HASH_SECRET",
  "BACKUP_ENCRYPTION_KEY",
];

const generated = names.map((name) => `${name}=${randomBytes(32).toString("hex")}`);
const content = [
  "# Generated Northline secrets. Do not commit this file.",
  `# Generated at ${new Date().toISOString()}`,
  ...generated,
  "",
].join("\n");

if (!outputPath) {
  console.log(content);
  console.log("Run `npm run secrets:generate -- --write` to create .dev.vars.generated with mode 0600.");
  process.exit(0);
}

if (existsSync(outputPath) && !force) {
  console.error(`${outputPath} already exists. Pass --force only when you intend to rotate every value.`);
  process.exit(1);
}

writeFileSync(outputPath, content, { encoding: "utf8", mode: 0o600 });
try { chmodSync(outputPath, 0o600); } catch {}
console.log(`Created ${outputPath}. Copy only the values you need into .dev.vars or Cloudflare secrets.`);
console.log("Rotate these values before production if the generated file was shared or uploaded anywhere.");
