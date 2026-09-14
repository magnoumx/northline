#!/usr/bin/env node
import "./lib/load-env.mjs";
import { existsSync, readFileSync } from "node:fs";

const env = process.env;
const checks = [];
const add = (group, key, required, note, state = valueState(key)) => {
  checks.push({ group, key, required, note, state });
};
const on = (key) => env[key] === "true";

add("Core", "APP_ENV", true, "development, preview, test, or production");
add("Core", "NEXT_PUBLIC_SITE_URL", true, "Public canonical origin");
add("Core", "AUTH_SESSION_SECRET", true, "Generate with npm run secrets:generate");
add("Core", "RATE_LIMIT_SECRET", env.APP_ENV === "production", "Server-only secret");
add("Core", "CSRF_SECRET", on("FEATURE_EDITORIAL_WRITES") || env.APP_ENV === "production", "Server-only secret");
add("Core", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", env.APP_ENV === "production" && env.CAPTCHA_REQUIRED !== "false", "Public Turnstile sitekey");
add("Core", "TURNSTILE_SECRET_KEY", env.APP_ENV === "production" && env.CAPTCHA_REQUIRED !== "false", "Server-side Turnstile secret");

add("Owner", "ADMIN_BOOTSTRAP_ENABLED", false, "Enable once, then disable");
if (on("ADMIN_BOOTSTRAP_ENABLED")) {
  add("Owner", "ADMIN_BOOTSTRAP_EMAIL", true, "Real, verified owner email");
  add("Owner", "ADMIN_BOOTSTRAP_USERNAME", true, "Display username");
  add("Owner", "ADMIN_BOOTSTRAP_TOKEN", true, "One-time 64-char token");
}

if (on("CLOUDFLARE_ACCESS_ENABLED")) {
  add("Cloudflare Access", "CLOUDFLARE_ACCESS_AUD", true, "Application Audience tag");
  add("Cloudflare Access", "CLOUDFLARE_ACCESS_TEAM_DOMAIN", true, "team.cloudflareaccess.com");
}

if (on("AUTH_OAUTH_GOOGLE_ENABLED")) {
  add("Google OAuth", "AUTH_OAUTH_GOOGLE_CLIENT_ID", true, "OAuth Web Client ID");
  add("Google OAuth", "AUTH_OAUTH_GOOGLE_CLIENT_SECRET", true, "OAuth client secret");
}

for (const [flag, group, key] of [
  ["AI_OPENAI_ENABLED", "OpenAI", "OPENAI_API_KEY"],
  ["AI_ANTHROPIC_ENABLED", "Anthropic", "ANTHROPIC_API_KEY"],
  ["AI_GOOGLE_ENABLED", "Google AI", "GOOGLE_AI_API_KEY"],
  ["FEATURE_EMAIL_DELIVERY", "Email", "EMAIL_API_KEY"],
  ["FEATURE_MONITORING", "Monitoring", "SENTRY_DSN"],
  ["FEATURE_ADSENSE", "AdSense", "ADSENSE_CLIENT_ID"],
]) {
  if (on(flag)) add(group, key, true, `Required because ${flag}=true`);
}

const wrangler = loadWrangler();
const d1 = wrangler?.d1_databases?.find((entry) => entry.binding === "DB");
checks.push({
  group: "Cloudflare bindings",
  key: "DB binding",
  required: true,
  state: d1 && !isPlaceholder(d1.database_id) ? "configured" : d1 ? "placeholder" : "missing",
  note: "D1 lives in wrangler.jsonc, not DATABASE_URL",
});
for (const binding of ["MEDIA", "MEDIA_QUARANTINE", "ARTICLE_AUDIO"]) {
  const item = wrangler?.r2_buckets?.find((entry) => entry.binding === binding);
  checks.push({
    group: "Cloudflare bindings",
    key: `R2 ${binding}`,
    required: on("FEATURE_OBJECT_STORAGE") || (binding === "ARTICLE_AUDIO" && on("FEATURE_ARTICLE_AUDIO")),
    state: item && !isPlaceholder(item.bucket_name) ? "configured" : item ? "placeholder" : "missing",
    note: "R2 binding in wrangler.jsonc",
  });
}

let failures = 0;
console.log("\nNorthline environment audit\n");
let currentGroup = "";
for (const check of checks) {
  if (check.group !== currentGroup) {
    currentGroup = check.group;
    console.log(`${currentGroup}:`);
  }
  const pass = check.state === "configured" || (!check.required && check.state !== "placeholder");
  if (!pass && check.required) failures += 1;
  const icon = pass ? "✓" : check.required ? "✗" : "·";
  const requirement = check.required ? "required" : "optional";
  console.log(`  ${icon} ${check.key}: ${check.state} (${requirement}) — ${check.note}`);
}

console.log("\nKnown contract notes:");
console.log("  • DATABASE_URL is unused by the current D1 runtime.");
console.log("  • Secrets belong in .dev.vars locally and Cloudflare Worker secrets in deployment.");
console.log("  • Non-secret editorial/model choices may be changed in Newsroom Settings.");
console.log("  • D1, R2 and Queue resource names/IDs belong in wrangler.jsonc bindings.");
console.log(`\nResult: ${failures === 0 ? "no required-value blockers detected" : `${failures} required blocker(s)`}.\n`);
process.exit(failures ? 1 : 0);

function valueState(key) {
  const value = env[key]?.trim();
  if (!value) return "missing";
  if (isPlaceholder(value)) return "placeholder";
  return "configured";
}
function isPlaceholder(value) {
  const text = String(value ?? "").toLowerCase();
  return !text || text.includes("paste_") || text.includes("your-") || text.includes("yourdomain") || text.includes("replace_with") || /^0{8}-0{4}-4?0{3}-8?0{3}-0{12}$/u.test(text);
}
function loadWrangler() {
  if (!existsSync("wrangler.jsonc")) return null;
  try {
    return JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, ""));
  } catch {
    return null;
  }
}
