#!/usr/bin/env node
import "./lib/load-env.mjs";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));
const localConfigPath = ".dev.vars";
const cliOwnerEmail = readArgument("--owner-email");
const cliDomain = readArgument("--domain");
const secretTemplatePath = ".dev.vars.example";
const publicTemplateCandidates = [".env.development.example", ".env.example"];

const generatedLocalSecretNames = [
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
  "ANALYTICS_WRITE_KEY",
];

console.log("\n  Northline guided setup\n");
console.log(`  Node: ${process.version} (project requires Node 22.19 or newer)`);

try {
  ensureLocalConfig();

  const ownerEmail = (cliOwnerEmail ?? await ask("  Owner email (press Enter to leave blank): ")).trim().toLowerCase();
  const domain = (cliDomain ?? await ask("  Final domain without https:// (press Enter to keep localhost): ")).trim();

  if (ownerEmail) {
    replaceEnvValue(localConfigPath, "ADMIN_BOOTSTRAP_EMAIL", ownerEmail);
  }
  if (domain) {
    replaceEnvValue(localConfigPath, "NEXT_PUBLIC_SITE_URL", `https://${domain}`);
  }

  fillEmptyLocalSecrets(localConfigPath, generatedLocalSecretNames);

  console.log("  ✓ Required local secrets are populated in .dev.vars");
  console.log("\n  Next commands:");
  console.log("    npm run env:audit");
  console.log("    npm run validate:env");
  console.log("    npm run db:migrate:local");
  console.log("    npm run db:seed");
  console.log("    npm run dev");
  console.log("\n  Keep optional integrations disabled until their API keys and connection checks are ready.\n");
} catch (error) {
  console.error("\n  Setup failed:");
  console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
}

function ensureLocalConfig() {
  if (existsSync(localConfigPath)) {
    console.log("  ✓ .dev.vars already exists");
    if (existsSync(".env")) {
      console.log("  ⚠ .env also exists. Prefer .dev.vars for Wrangler local development to avoid conflicting values.");
    }
    return;
  }

  const publicTemplatePath = publicTemplateCandidates.find((candidate) => existsSync(candidate));
  if (!publicTemplatePath) {
    throw new Error(
      `No local settings template was found. Expected one of: ${publicTemplateCandidates.join(", ")}.`,
    );
  }

  const publicConfig = readFileSync(publicTemplatePath, "utf8");
  const secretConfig = existsSync(secretTemplatePath)
    ? readFileSync(secretTemplatePath, "utf8")
    : buildFallbackSecretTemplate();

  writeFileSync(
    localConfigPath,
    `${publicConfig.trimEnd()}\n\n# LOCAL SECRETS\n${secretConfig.trim()}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`  ✓ Created .dev.vars from ${publicTemplatePath}`);
  if (!existsSync(secretTemplatePath)) {
    console.log("  ⚠ .dev.vars.example was missing; a safe built-in placeholder template was used.");
  }
}

function buildFallbackSecretTemplate() {
  return generatedLocalSecretNames.map((name) => `${name}=`).join("\n");
}

function fillEmptyLocalSecrets(path, names) {
  let source = readFileSync(path, "utf8");
  for (const name of names) {
    const pattern = new RegExp(`^${escapeRegExp(name)}=(.*)$`, "mu");
    const match = source.match(pattern);
    if (!match) {
      source = `${source.trimEnd()}\n${name}=${createSecret()}\n`;
      continue;
    }
    if (!match[1].trim()) {
      source = source.replace(pattern, `${name}=${createSecret()}`);
    }
  }
  writeFileSync(path, source, { encoding: "utf8", mode: 0o600 });
}

function replaceEnvValue(path, key, value) {
  const source = readFileSync(path, "utf8");
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "mu");
  const replacement = `${key}=${value}`;
  writeFileSync(
    path,
    source.match(pattern) ? source.replace(pattern, replacement) : `${source.trimEnd()}\n${replacement}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function createSecret() {
  return randomBytes(32).toString("hex");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
