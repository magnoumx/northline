#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve(process.argv[2] ?? ".env.production");
const outputPath = resolve(process.argv[3] ?? "outputs/northline-production-runtime.json");
const extraJsonPaths = process.argv.slice(4).map((path) => resolve(path));
if (!existsSync(sourcePath)) {
  console.error(`Missing ${sourcePath}. Copy .env.production.minimal.example to .env.production and fill it first.`);
  process.exit(1);
}

const values = parseEnv(readFileSync(sourcePath, "utf8"));
for (const extraPath of extraJsonPaths) {
  if (!existsSync(extraPath)) {
    console.error(`Missing extra runtime JSON file: ${extraPath}`);
    process.exit(1);
  }
  let extra;
  try {
    extra = JSON.parse(readFileSync(extraPath, "utf8"));
  } catch {
    console.error(`Invalid JSON in ${extraPath}.`);
    process.exit(1);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === "string" && value.trim()) values[key] = value;
  }
}
const placeholders = [];
const runtime = {};
for (const [key, value] of Object.entries(values)) {
  const normalized = value.trim();
  if (!normalized) continue;
  if (/REPLACE|PLACEHOLDER|OWNER_EMAIL_HERE|example\.com/iu.test(normalized)) {
    placeholders.push(key);
    continue;
  }
  runtime[key] = normalized;
}

if (placeholders.length) {
  console.error(`Replace placeholder values before creating the runtime bundle: ${placeholders.join(", ")}`);
  process.exit(1);
}

const mandatory = [
  "APP_ENV",
  "NEXT_PUBLIC_SITE_URL",
  "DEMO_CONTENT_MODE",
  "AUTH_PROVIDER",
  "CLOUDFLARE_ACCESS_TEAM_DOMAIN",
  "CLOUDFLARE_ACCESS_AUD",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "AUTH_SESSION_SECRET",
  "CSRF_SECRET",
  "RATE_LIMIT_SECRET",
  "TURNSTILE_SECRET_KEY",
];
const missing = mandatory.filter((key) => !runtime[key]);
if (missing.length) {
  console.error(`Missing production runtime values: ${missing.join(", ")}`);
  process.exit(1);
}
if (runtime.APP_ENV !== "production" || runtime.DEMO_CONTENT_MODE !== "false") {
  console.error("The runtime bundle only accepts APP_ENV=production and DEMO_CONTENT_MODE=false.");
  process.exit(1);
}

const maximum = 124;
const count = Object.keys(runtime).length;
if (count > maximum) {
  console.error(`The runtime bundle contains ${count} variables. Reduce it below ${maximum} before deployment.`);
  process.exit(1);
}
mkdirSync(resolve(outputPath, ".."), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(runtime, null, 2)}\n`, { mode: 0o600 });
console.log(`Created ${outputPath} with ${count} runtime values.`);
console.log("Treat this file as a secret. Upload with Wrangler, then delete it after storing a protected backup.");

function parseEnv(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
