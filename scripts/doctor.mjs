#!/usr/bin/env node
import "./lib/load-env.mjs";
import { existsSync, readFileSync } from "node:fs";

const env = process.env;
const checks = [];
const check = (name, state, detail, blocking = false) => checks.push({ name, state, detail, blocking });
const configured = (key) => Boolean(env[key]?.trim());
const enabled = (key) => env[key] === "true";

console.log("\n  Northline Doctor\n");
check("Local environment file", existsSync(".env") || existsSync(".dev.vars") ? "ok" : "warn", existsSync(".env") || existsSync(".dev.vars") ? "found" : "run npm run setup");
check("APP_ENV", configured("APP_ENV") ? "ok" : "warn", env.APP_ENV ?? "defaults to development");
check("Site URL", configured("NEXT_PUBLIC_SITE_URL") ? "ok" : "fail", env.NEXT_PUBLIC_SITE_URL ?? "missing", true);
check("Session signing secret", configured("AUTH_SESSION_SECRET") ? "ok" : "fail", configured("AUTH_SESSION_SECRET") ? "configured" : "run npm run secrets:generate", true);
check("D1 binding", wranglerHasD1() ? "ok" : "fail", wranglerHasD1() ? "declared in wrangler.jsonc" : "missing DB binding", true);

integration("OpenAI", "AI_OPENAI_ENABLED", "OPENAI_API_KEY");
integration("Anthropic", "AI_ANTHROPIC_ENABLED", "ANTHROPIC_API_KEY");
integration("Google AI", "AI_GOOGLE_ENABLED", "GOOGLE_AI_API_KEY");
integration("Google OAuth", "AUTH_OAUTH_GOOGLE_ENABLED", "AUTH_OAUTH_GOOGLE_CLIENT_ID", "AUTH_OAUTH_GOOGLE_CLIENT_SECRET");
integration("Email", "FEATURE_EMAIL_DELIVERY", "EMAIL_PROVIDER", "EMAIL_API_KEY", "EMAIL_FROM_ADDRESS");
integration("Monitoring", "FEATURE_MONITORING", "SENTRY_DSN");
integration("Cloudflare Access", "CLOUDFLARE_ACCESS_ENABLED", "CLOUDFLARE_ACCESS_AUD", "CLOUDFLARE_ACCESS_TEAM_DOMAIN");
integration("AdSense", "FEATURE_ADSENSE", "ADSENSE_CLIENT_ID");

if (enabled("ADMIN_BOOTSTRAP_ENABLED")) {
  check("Owner bootstrap email", configured("ADMIN_BOOTSTRAP_EMAIL") ? "ok" : "fail", env.ADMIN_BOOTSTRAP_EMAIL ?? "missing", true);
  check("Owner bootstrap token", /^[a-f0-9]{64}$/iu.test(env.ADMIN_BOOTSTRAP_TOKEN ?? "") ? "ok" : "fail", configured("ADMIN_BOOTSTRAP_TOKEN") ? "must be 64 hex characters" : "missing", true);
}

for (const item of checks) {
  const icon = item.state === "ok" ? "✓" : item.state === "warn" ? "⚠" : "✗";
  console.log(`  ${icon} ${item.name}: ${item.detail}`);
}
const blockers = checks.filter((item) => item.state === "fail" && item.blocking).length;
console.log(`\n  ${blockers ? `${blockers} blocking issue(s)` : "No baseline blockers detected"}. Optional disabled integrations are not failures.\n`);
process.exit(blockers ? 1 : 0);

function integration(name, flag, ...keys) {
  if (!enabled(flag)) {
    check(name, "warn", `disabled (${flag}=false)`);
    return;
  }
  const missing = keys.filter((key) => !configured(key));
  check(name, missing.length ? "fail" : "ok", missing.length ? `missing ${missing.join(", ")}` : "configured", true);
}
function wranglerHasD1() {
  try {
    const raw = readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, "");
    const config = JSON.parse(raw);
    return Boolean(config.d1_databases?.some((item) => item.binding === "DB"));
  } catch { return false; }
}
