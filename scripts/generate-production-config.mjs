#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else {
    args.set(key, "true");
  }
}

const rl = createInterface({ input, output });
const ask = async (name, message, fallback = "") => {
  const supplied = args.get(name);
  if (supplied !== undefined) return supplied.trim();
  if (!input.isTTY) return fallback;
  const answer = (await rl.question(`${message}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  return answer || fallback;
};

const domain = normalizeDomain(await ask("domain", "Final public domain", "example.com"));
const newsroomHost = normalizeDomain(
  await ask("newsroom-domain", "Protected newsroom hostname", `newsroom.${domain}`),
);
const email = (await ask("owner-email", "Real owner email", "owner@example.com")).toLowerCase();
const username = await ask("username", "Owner username", "owner");
const teamDomain = normalizeTeamDomain(
  await ask("access-team-domain", "Cloudflare Access team domain (blank until created)", ""),
);
const audience = await ask("access-aud", "Cloudflare Access AUD tag (blank until created)", "");
await rl.close();

mkdirSync("outputs", { recursive: true });

const generatedSecrets = {
  ADMIN_BOOTSTRAP_TOKEN: secret(),
  AUTH_SESSION_SECRET: secret(),
  AUTH_MFA_ENCRYPTION_KEY: secret(),
  CONFIG_ENCRYPTION_KEY: secret(),
  RATE_LIMIT_SECRET: secret(),
  CSRF_SECRET: secret(),
  CRON_SECRET: secret(),
  WEBHOOK_SIGNING_SECRET: secret(),
  NEWSLETTER_CONFIRMATION_SECRET: secret(),
  NEWSLETTER_UNSUBSCRIBE_SECRET: secret(),
  AD_TOKEN_SECRET: secret(),
  AD_EVENT_HASH_SECRET: secret(),
  AD_LEAD_HASH_SECRET: secret(),
  BACKUP_ENCRYPTION_KEY: secret(),
  ANALYTICS_WRITE_KEY: secret(),
};

const secretPath = "outputs/northline-production-generated-secrets.json";
writeFileSync(secretPath, `${JSON.stringify(generatedSecrets, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
try { chmodSync(secretPath, 0o600); } catch {}

const vars = `# Northline production non-secret configuration.\n# Generated ${new Date().toISOString()}\nNODE_ENV=production\nAPP_ENV=production\nNEXT_PUBLIC_SITE_URL=https://${domain}\nDEMO_CONTENT_MODE=false\nENABLE_SEARCH_INDEXING=false\nROBOTS_ALLOW_INDEXING=false\n\nAPP_NAME=Northline\nAPP_SHORT_NAME=Northline\nAPP_TAGLINE=Know what happened, why it matters and what comes next.\nAPP_LOGO=/brand/logo.svg\nAPP_WORDMARK=/brand/wordmark.svg\nAPP_FAVICON=/brand/logo.svg\nAPP_SOCIAL_HANDLE=@usnorthline\nD1_DATABASE_NAME=northline-production\n\nAUTH_PROVIDER=cloudflare_access\nAUTH_MAGIC_LINK_ENABLED=false\nAUTH_ALLOW_REGISTRATION=false\nAUTH_OAUTH_GOOGLE_ENABLED=false\nAUTH_STAFF_MFA_REQUIRED=true\nAUTH_MFA_PROVIDER=cloudflare_access\nAUTH_SESSION_TTL_MINUTES=720\nAUTH_SESSION_ROTATION_MINUTES=60\nAUTH_COOKIE_NAME=northline_session\nADMIN_BOOTSTRAP_ENABLED=true\nADMIN_BOOTSTRAP_USERNAME=${escapeEnv(username)}\nADMIN_BOOTSTRAP_EMAIL=${escapeEnv(email)}\n\nCLOUDFLARE_ACCESS_ENABLED=${teamDomain && audience ? "true" : "false"}\nCLOUDFLARE_ACCESS_TEAM_DOMAIN=${escapeEnv(teamDomain)}\nCLOUDFLARE_ACCESS_AUD=${escapeEnv(audience)}\n\nCAPTCHA_PROVIDER=turnstile\nCAPTCHA_REQUIRED=true\nNEXT_PUBLIC_TURNSTILE_SITE_KEY=\n\nFEATURE_EDITORIAL_WRITES=true\nFEATURE_INTERNAL_LINKS=true\nFEATURE_DURABLE_JOBS=true\nFEATURE_OBJECT_STORAGE=true\nFEATURE_SOURCE_ACQUISITION=false\nFEATURE_SCHEDULED_INGESTION=true\nFEATURE_TREND_CONNECTORS=true\nCONNECTORS_ENABLED=true\nCONNECTORS_GLOBAL_KILL=false\nTREND_GDELT_ENABLED=true\nTREND_RSS_ENABLED=false\nSEARCH_CONNECTOR_ENABLED=false\n\nAI_ENABLED=false\nAI_GLOBAL_KILL=true\nAI_PROVIDER_ORDER=anthropic,google,openai,local\nAI_GOOGLE_ENABLED=false\nAI_OPENAI_ENABLED=false\nAI_ANTHROPIC_ENABLED=false\nAI_LOCAL_ENABLED=false\nAI_GOOGLE_MODEL=\nAI_GOOGLE_INPUT_USD_PER_MILLION_TOKENS=\nAI_GOOGLE_OUTPUT_USD_PER_MILLION_TOKENS=\nAI_GOOGLE_CAPABILITIES=classify,summarize,extract,research_synthesis,outline,draft,fact_review,copy_review,seo_review\nAI_OPENAI_MODEL=\nAI_OPENAI_INPUT_USD_PER_MILLION_TOKENS=\nAI_OPENAI_OUTPUT_USD_PER_MILLION_TOKENS=\nAI_OPENAI_CAPABILITIES=classify,summarize,extract,research_synthesis,outline,draft,fact_review,copy_review,seo_review\nAI_ANTHROPIC_MODEL=\nAI_ANTHROPIC_INPUT_USD_PER_MILLION_TOKENS=\nAI_ANTHROPIC_OUTPUT_USD_PER_MILLION_TOKENS=\nAI_ANTHROPIC_CAPABILITIES=classify,summarize,extract,research_synthesis,outline,draft,fact_review,copy_review,seo_review\nAI_DAILY_BUDGET_USD=5\nAI_MONTHLY_BUDGET_USD=100\nAI_PER_STORY_BUDGET_USD=1\nAI_PER_TASK_BUDGET_USD=0.30\nAI_MAX_CONTEXT_TOKENS=24000\nAI_MAX_OUTPUT_TOKENS=4000\nAI_MAX_REVISIONS=2\nAI_MAX_CONCURRENT_JOBS=2\nAI_MAX_RETRIES=2\nAI_PROMPT_VERSION=v12-launch\nAI_POLICY_VERSION=v12-approved-only\n\nFEATURE_ARTICLE_AUDIO=false\nARTICLE_AUDIO_GLOBAL_KILL=true\nARTICLE_AUDIO_PLAYBACK_ENABLED=false\nBROWSER_SPEECH_FALLBACK_ENABLED=true\nTTS_PROVIDER_ORDER=google,openai,elevenlabs,browser\nTTS_GOOGLE_ENABLED=false\nTTS_OPENAI_ENABLED=false\nTTS_ELEVENLABS_ENABLED=false\nTTS_OUTPUT_FORMAT=MP3\nTTS_CHUNK_MAX_CHARACTERS=3500\nTTS_DAILY_BUDGET_USD=2\nTTS_PER_ARTICLE_BUDGET_USD=0.50\nTTS_MAX_ARTICLE_CHARACTERS=30000\nTTS_REGENERATION_COOLDOWN=3600\n\nFEATURE_EMAIL_DELIVERY=false\nEMAIL_PROVIDER=resend\nEMAIL_FROM_ADDRESS=news@${domain}\nAUTH_EMAIL_FROM=news@${domain}\nSALES_NOTIFICATION_EMAIL=${escapeEnv(email)}\nNEWSLETTER_DOUBLE_OPT_IN=true\nNEWSLETTER_CONFIRMATION_TTL_HOURS=24\n\nANALYTICS_PROVIDER=first_party\nANALYTICS_RETENTION_DAYS=90\n\nFEATURE_MONITORING=false\nLOG_LEVEL=info\nSECURITY_ALERT_EMAIL=${escapeEnv(email)}\n\nFEATURE_BACKUPS=false\nBACKUP_PROVIDER=r2\nBACKUP_BUCKET=northline-backups\nBACKUP_RETENTION_DAYS=35\nBACKUP_RPO_HOURS=24\nBACKUP_RTO_HOURS=4\n\nAD_GLOBAL_KILL=true\nFEATURE_DIRECT_ADS=false\nFEATURE_ADSENSE=false\nFEATURE_GOOGLE_AD_MANAGER=false\nFEATURE_ADVERTISER_PORTAL=false\nFEATURE_SPONSORED_CONTENT=false\nFEATURE_AFFILIATE_LINKS=false\nFEATURE_PAID_MEMBERSHIP=false\nFEATURE_AUTO_PUBLISH=false\nAUTO_PUBLISH_READINESS_APPROVED=false\nFEATURE_ASK_STORY=false\nFEATURE_PERSONALIZATION=true\n\nDEFAULT_CONSENT_REGION=US\nCSP_REPORT_ONLY=true\nTRUSTED_TYPES_ENFORCE=false\n\n# Protected newsroom host requested during generation:\n# https://${newsroomHost}\n`;
const varsPath = "outputs/northline-production-vars.env";
writeFileSync(varsPath, vars, { encoding: "utf8" });

const missing = `# Values Northline cannot generate for you\n\nPUBLIC_DOMAIN=${domain}\nNEWSROOM_DOMAIN=${newsroomHost}\nOWNER_EMAIL=${email}\n\n# Cloudflare Access\nCLOUDFLARE_ACCESS_TEAM_DOMAIN=${teamDomain || "<create in Zero Trust>"}\nCLOUDFLARE_ACCESS_AUD=${audience || "<copy Application Audience tag>"}\n\n# Cloudflare resource IDs/names\nPRODUCTION_D1_DATABASE_ID=<wrangler d1 create output>\nPREVIEW_D1_DATABASE_ID=<wrangler d1 create output>\n\n# Public / external credentials\nNEXT_PUBLIC_TURNSTILE_SITE_KEY=<Turnstile widget sitekey>\nTURNSTILE_SECRET_KEY=<Turnstile widget secret>\nEMAIL_API_KEY=<Resend sending-only API key>\nGOOGLE_AI_API_KEY=<Google AI Studio key>\nOPENAI_API_KEY=<OpenAI project key, optional initially>\nANTHROPIC_API_KEY=<Anthropic project/workspace key, optional initially>\nYOUTUBE_API_KEY=<Google Cloud YouTube Data API key, optional>\nSENTRY_DSN=<Sentry project DSN, recommended>\nNEWS_API_KEY=<licensed news provider key, optional>\nEVENT_REGISTRY_API_KEY=<optional>\nADSENSE_CLIENT_ID=<only after site approval>\n`;
writeFileSync("outputs/northline-values-you-must-get.txt", missing, "utf8");

console.log(`Created ${secretPath}`);
console.log(`Created ${varsPath}`);
console.log("Created outputs/northline-values-you-must-get.txt");
console.log("\nUpload generated internal secrets after reviewing them:");
console.log("  npx wrangler secret bulk outputs/northline-production-generated-secrets.json --env production");
console.log("\nDo not upload or commit the generated secrets file. Delete it after the secrets are stored and backed up securely.");

function secret() {
  return randomBytes(32).toString("hex");
}
function normalizeDomain(value) {
  return value.trim().replace(/^https?:\/\//iu, "").replace(/\/$/u, "");
}
function normalizeTeamDomain(value) {
  return value.trim().replace(/^https?:\/\//iu, "").replace(/\/$/u, "");
}
function escapeEnv(value) {
  if (!/[\s#"']/u.test(value)) return value;
  return JSON.stringify(value);
}
