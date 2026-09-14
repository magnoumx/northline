#!/usr/bin/env node
import "./lib/load-env.mjs";
import { existsSync, readFileSync } from "node:fs";

const failures = [];
const warnings = [];
const env = process.env;

expect(env.APP_ENV === "production", "APP_ENV must equal production.");
expect(env.NODE_ENV === "production", "NODE_ENV must equal production.");
expect(env.DEMO_CONTENT_MODE === "false", "DEMO_CONTENT_MODE must equal false.");
expect(/^https:\/\/usnorthline\.com\/?$/iu.test(env.NEXT_PUBLIC_SITE_URL ?? ""), "NEXT_PUBLIC_SITE_URL must be https://usnorthline.com.");
const authProvider = (env.AUTH_PROVIDER ?? "standard").trim().toLowerCase();
if (authProvider === "standard") {
  expect(Boolean(env.AUTH_SESSION_SECRET?.trim()), "AUTH_SESSION_SECRET must be stored as a Worker secret for standard authentication.");
} else {
  expect(authProvider === "cloudflare_access", "AUTH_PROVIDER must be standard or cloudflare_access.");
}
expect(Boolean(env.CSRF_SECRET?.trim()), "CSRF_SECRET must be stored as a Worker secret.");
expect(Boolean(env.RATE_LIMIT_SECRET?.trim()), "RATE_LIMIT_SECRET must be stored as a Worker secret.");

if (env.CLOUDFLARE_ACCESS_ENABLED === "true") {
  expect(validValue(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN), "Cloudflare Access team domain is missing or still a placeholder.");
  expect(validValue(env.CLOUDFLARE_ACCESS_AUD), "Cloudflare Access AUD is missing or still a placeholder.");
}
if (env.CAPTCHA_REQUIRED === "true") {
  expect(validValue(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), "Turnstile site key is missing or still a placeholder.");
  expect(Boolean(env.TURNSTILE_SECRET_KEY?.trim()), "TURNSTILE_SECRET_KEY must be stored as a Worker secret.");
}
if (env.FEATURE_EMAIL_DELIVERY === "true") {
  expect(Boolean(env.EMAIL_API_KEY?.trim()), "EMAIL_API_KEY is required while email delivery is enabled.");
  expect(Boolean(env.EMAIL_FROM_ADDRESS?.trim()), "EMAIL_FROM_ADDRESS is required while email delivery is enabled.");
}
if (env.FEATURE_ADSENSE === "true") {
  expect(env.AD_GLOBAL_KILL === "false", "FEATURE_ADSENSE requires AD_GLOBAL_KILL=false.");
  expect(/^ca-pub-\d{10,30}$/u.test(env.ADSENSE_CLIENT_ID ?? ""), "ADSENSE_CLIENT_ID must use the ca-pub-<digits> format.");
}
if (env.AI_ENABLED === "true" && env.AI_GLOBAL_KILL === "false") {
  const enabledProviders = [
    ["Google", env.AI_GOOGLE_ENABLED, env.GOOGLE_AI_API_KEY, env.AI_GOOGLE_MODEL],
    ["OpenAI", env.AI_OPENAI_ENABLED, env.OPENAI_API_KEY, env.AI_OPENAI_MODEL],
    ["Anthropic", env.AI_ANTHROPIC_ENABLED, env.ANTHROPIC_API_KEY, env.AI_ANTHROPIC_MODEL],
  ].filter(([, enabled]) => enabled === "true");
  expect(enabledProviders.length > 0, "AI is operational but no provider is enabled.");
  for (const [label, , key, model] of enabledProviders) {
    expect(Boolean(key?.trim()), `${label} API key is missing.`);
    expect(validValue(model), `${label} model ID is missing or a placeholder.`);
  }
}
const controlledPublication =
  env.FEATURE_AUTO_PUBLISH !== "true" ||
  (env.AUTO_PUBLISH_READINESS_APPROVED === "true" &&
    env.AUTO_PUBLISH_MODE === "approved_only" &&
    Number.isInteger(Number(env.AUTO_PUBLISH_DAILY_LIMIT)) &&
    Number(env.AUTO_PUBLISH_DAILY_LIMIT) >= 1 &&
    Number(env.AUTO_PUBLISH_DAILY_LIMIT) <= 25);
expect(
  controlledPublication,
  "Automatic publication must be disabled or use approved_only mode with readiness approval and a daily limit between 1 and 25.",
);

const config = parseJsonc("wrangler.jsonc");
for (const target of ["preview", "production"]) {
  const targetConfig = config?.env?.[target];
  expect(Boolean(targetConfig), `wrangler.jsonc is missing env.${target}.`);
  const d1 = targetConfig?.d1_databases?.find((item) => item.binding === "DB");
  expect(Boolean(d1), `${target} is missing the DB binding.`);
  expect(validValue(d1?.database_id), `${target} D1 database ID is missing or a placeholder.`);
  for (const binding of ["MEDIA", "MEDIA_QUARANTINE", "ARTICLE_AUDIO"]) {
    expect(Boolean(targetConfig?.r2_buckets?.some((item) => item.binding === binding)), `${target} is missing ${binding} R2 binding.`);
  }
  for (const binding of ["EDITORIAL_QUEUE", "MEDIA_QUEUE", "AD_EVENT_QUEUE"]) {
    expect(Boolean(targetConfig?.queues?.producers?.some((item) => item.binding === binding)), `${target} is missing ${binding} queue producer.`);
  }
}

if (env.ENABLE_SEARCH_INDEXING !== "true") {
  warnings.push("Search indexing is intentionally disabled. Enable it only after real content and SEO gates pass.");
}
if (env.FEATURE_MONITORING !== "true") warnings.push("Monitoring is disabled.");
if (env.FEATURE_BACKUPS !== "true") warnings.push("Automated backups are disabled.");
if (env.FEATURE_EMAIL_DELIVERY !== "true") warnings.push("Email delivery and newsletter confirmation are disabled.");
if (env.AI_ENABLED !== "true" || env.AI_GLOBAL_KILL !== "false") warnings.push("AI execution is disabled or globally killed.");

console.log("\nNorthline production readiness\n");
for (const warning of warnings) console.log(`⚠ ${warning}`);
for (const failure of failures) console.log(`✗ ${failure}`);
if (!failures.length) console.log("✓ No blocking configuration errors detected by this preflight.");
console.log(`\n${failures.length} blocker(s), ${warnings.length} warning(s).\n`);
process.exit(failures.length ? 1 : 0);

function expect(condition, message) {
  if (!condition) failures.push(message);
}
function validValue(value) {
  const normalized = String(value ?? "").trim();
  return Boolean(normalized) && !/REPLACE|PLACEHOLDER|OWNER_EMAIL_HERE|example\.com/iu.test(normalized);
}
function parseJsonc(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(
      readFileSync(path, "utf8")
        .replace(/^\s*\/\/.*$/gmu, "")
        .replace(/\/\*[\s\S]*?\*\//gu, ""),
    );
  } catch {
    failures.push(`${path} is not valid JSONC.`);
    return null;
  }
}
