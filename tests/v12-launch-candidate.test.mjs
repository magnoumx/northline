import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Cloudflare outbound fetches use the edge-supported redirect mode", () => {
  for (const path of [
    "lib/auth/cloudflare-access.ts",
    "lib/ai/providers.ts",
    "lib/connectors/gdelt.ts",
    "lib/connectors/google-trends.ts",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /redirect:\s*["']error["']/u, path);
  }
  assert.match(read("tests/ai/providers.test.ts"), /toBe\("manual"\)/u);
});

test("U.S. discovery combines Google Trends and GDELT without synthetic stories", () => {
  assert.equal(existsSync("lib/connectors/google-trends.ts"), true);
  const executor = read("lib/jobs/executors.ts");
  assert.match(executor, /GoogleTrendsConnector/u);
  assert.match(executor, /GdeltTrendConnector/u);
  assert.match(executor, /GOOGLE_TRENDS/u);
  assert.match(executor, /GDELT/u);
  assert.doesNotMatch(executor, /INSERT INTO articles[\s\S]*GoogleTrendsConnector/u);
});

test("Anthropic research can use bounded web search and preserves citations", () => {
  const providers = read("lib/ai/providers.ts");
  const config = read("lib/ai/config.ts");
  assert.match(providers, /web_search_20260318/u);
  assert.match(providers, /max_uses/u);
  assert.match(providers, /Sources consulted/u);
  assert.match(config, /AI_ANTHROPIC_WEB_SEARCH_MAX_USES/u);
  assert.match(config, /allowedDomains/u);
  assert.match(config, /blockedDomains/u);
});

test("automatic publication remains human-approved, low-risk, and rate limited", () => {
  const executor = read("lib/jobs/executors.ts");
  const environment = read(".env.production.minimal.example");
  assert.match(executor, /state = 'APPROVED'/u);
  assert.match(executor, /sensitive = 0/u);
  assert.match(executor, /risk_level = 'LOW'/u);
  assert.match(executor, /human_approval_required = 0/u);
  assert.match(executor, /AUTO_PUBLISH_ALLOWED_CATEGORIES/u);
  assert.match(executor, /system:autopublish/u);
  assert.match(environment, /^FEATURE_AUTO_PUBLISH=true$/m);
  assert.match(environment, /^AUTO_PUBLISH_MODE=approved_only$/m);
  assert.match(environment, /^AUTO_PUBLISH_DAILY_LIMIT=5$/m);
});

test("Google Search and AdSense integrations stay behind launch controls", () => {
  const layout = read("app/layout.tsx");
  const adsense = read("components/google-adsense.tsx");
  const adsTxt = read("app/ads.txt/route.ts");
  assert.match(layout, /GOOGLE_SITE_VERIFICATION/u);
  assert.match(adsense, /FEATURE_ADSENSE/u);
  assert.match(adsense, /AD_GLOBAL_KILL/u);
  assert.match(adsense, /ca-pub-/u);
  assert.match(adsTxt, /pub-/u);
  assert.match(read("scripts/validate-environment.mjs"), /GOOGLE_SEARCH_LAUNCH_APPROVED/u);
});

test("owner bootstrap works with remote D1 and Windows shells", () => {
  const bootstrap = read("scripts/admin-bootstrap.mjs");
  assert.doesNotMatch(bootstrap, /BEGIN(?:\s+TRANSACTION)?;/u);
  assert.doesNotMatch(bootstrap, /COMMIT;/u);
  assert.match(bootstrap, /process\.platform === "win32" \? "npx\.cmd" : "npx"/u);
  assert.match(bootstrap, /--file/u);
});

test("V12 operations documentation exists", () => {
  for (const path of [
    "docs/v12/LAUNCH_STEPS_AR.md",
    "docs/v12/GOOGLE_SEO_AND_ADSENSE.md",
    "docs/v12/AUTOMATION_POLICY.md",
    "docs/v12/ANTHROPIC_AND_TRENDS_SETUP_AR.md",
  ]) {
    assert.equal(existsSync(path), true, `${path} must exist`);
  }
});
