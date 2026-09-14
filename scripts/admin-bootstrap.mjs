#!/usr/bin/env node
import "./lib/load-env.mjs";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const env = process.env;
const execute = process.argv.includes("--execute");
const remote = process.argv.includes("--remote");
const databaseName = env.D1_DATABASE_NAME?.trim() || (remote ? "northline-production" : "northline-development");

console.log("\n  Northline Owner Bootstrap\n");
if (env.ADMIN_BOOTSTRAP_ENABLED !== "true") {
  console.log("  Bootstrap is disabled. Set ADMIN_BOOTSTRAP_ENABLED=true only for the one-time owner creation.\n");
  process.exit(0);
}

const email = normalizeEmail(env.ADMIN_BOOTSTRAP_EMAIL ?? "");
const username = (env.ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const token = (env.ADMIN_BOOTSTRAP_TOKEN ?? "").trim();
const errors = [];
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) errors.push("ADMIN_BOOTSTRAP_EMAIL must be a real email address.");
if (!/^[a-zA-Z0-9_.-]{3,40}$/u.test(username)) errors.push("ADMIN_BOOTSTRAP_USERNAME must be 3–40 safe characters.");
if (!/^[a-f0-9]{64}$/iu.test(token)) errors.push("ADMIN_BOOTSTRAP_TOKEN must be exactly 64 hexadecimal characters.");
if (errors.length) {
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

const now = Date.now();
const suffix = randomBytes(8).toString("hex");
const ownerId = `usr_owner_${suffix}`;
const accountId = `acct_magic_${suffix}`;
const auditId = `auth_audit_${suffix}`;
const tokenHash = createHash("sha256").update(token).digest("hex");
const metadata = JSON.stringify({ method: "admin_bootstrap", token_hash: tokenHash });

const sql = `-- Northline one-time owner bootstrap\n-- Intentionally transaction-free for Wrangler D1 remote compatibility.\n\nINSERT INTO users (id, email, display_name, role, status, created_at, updated_at)\nVALUES (${q(ownerId)}, ${q(email)}, ${q(username)}, 'Owner', 'active', ${now}, ${now})\nON CONFLICT(email) DO UPDATE SET\n  display_name = excluded.display_name,\n  role = 'Owner',\n  status = 'active',\n  updated_at = excluded.updated_at;\n\nINSERT INTO auth_accounts (id, user_id, provider, provider_account_id, email_verified_at, created_at, updated_at)\nSELECT ${q(accountId)}, id, 'magic_link', email, ${now}, ${now}, ${now}\nFROM users WHERE lower(email) = ${q(email)}\nON CONFLICT(provider, provider_account_id) DO UPDATE SET\n  email_verified_at = excluded.email_verified_at,\n  disabled_at = NULL,\n  updated_at = excluded.updated_at;\n\nINSERT OR IGNORE INTO auth_security_profiles (user_id, failed_login_count, created_at, updated_at)\nSELECT id, 0, ${now}, ${now} FROM users WHERE lower(email) = ${q(email)};\n\nINSERT INTO user_roles (user_id, role_id, organization_id, granted_by_id, granted_at, revoked_at)\nSELECT u.id, 'role_owner', NULL, u.id, ${now}, NULL\nFROM users u\nWHERE lower(u.email) = ${q(email)}\n  AND NOT EXISTS (\n    SELECT 1 FROM user_roles ur\n    WHERE ur.user_id = u.id AND ur.role_id = 'role_owner'\n      AND ur.organization_id IS NULL AND ur.revoked_at IS NULL\n  );\n\nINSERT INTO auth_audit_events (id, user_id, event, decision, reason, metadata_json, occurred_at)\nSELECT ${q(auditId)}, id, 'BOOTSTRAP_OWNER', 'ALLOW', 'ONE_TIME_BOOTSTRAP', ${q(metadata)}, ${now}\nFROM users WHERE lower(email) = ${q(email)};\n\n`;

mkdirSync(resolve("outputs"), { recursive: true });
const sqlPath = resolve("outputs", "bootstrap-owner.sql");
writeFileSync(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
try { chmodSync(sqlPath, 0o600); } catch {}
console.log(`  ✓ Wrote reviewed bootstrap SQL to ${sqlPath}`);
console.log(`  ✓ Owner email: ${email}`);
console.log(`  ✓ Target database: ${databaseName} (${remote ? "remote" : "local"})`);

if (execute) {
  const args = ["wrangler", "d1", "execute", databaseName, remote ? "--remote" : "--local", "--file", sqlPath];
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  console.log(`  → Executing: ${npxCommand} ${args.join(" ")}`);
  execFileSync(npxCommand, args, { stdio: "inherit", shell: process.platform === "win32" });
  console.log("\n  ✓ Owner records created or repaired.");
  console.log("  IMPORTANT: disable ADMIN_BOOTSTRAP_ENABLED and clear ADMIN_BOOTSTRAP_TOKEN now.");
  console.log("  Sign-in is controlled by the configured authentication provider. For production, keep Cloudflare Access and MFA enabled.\n");
} else {
  console.log("\n  Review the SQL, then run:");
  console.log(`    npm run admin:bootstrap -- --execute${remote ? " --remote" : ""}`);
  console.log("  No database change was made in this dry run.\n");
}

function normalizeEmail(value) { return value.trim().toLowerCase(); }
function q(value) { return `'${String(value).replaceAll("'", "''")}'`; }
