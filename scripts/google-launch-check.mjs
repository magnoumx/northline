#!/usr/bin/env node
import "./lib/load-env.mjs";
import { existsSync, readFileSync } from "node:fs";

const env = process.env;
const blockers = [];
const warnings = [];

requireFile("app/sitemap.ts");
requireFile("app/news-sitemap.xml/route.ts");
requireFile("app/robots.ts");
requireFile("app/ads.txt/route.ts");
for (const route of ["about", "privacy", "terms", "corrections", "ownership", "editorial-standards", "contact"]) {
  requireFile(`app/${route}/page.tsx`);
}

if (env.ENABLE_SEARCH_INDEXING === "true") {
  requireExact("GOOGLE_SEARCH_LAUNCH_APPROVED", "true");
  requireValue("GOOGLE_SITE_VERIFICATION");
  requireExact("ROBOTS_ALLOW_INDEXING", "true");
} else {
  warnings.push("Search indexing is still disabled, which is correct until real content and launch review are complete.");
}

if (env.FEATURE_ADSENSE === "true") {
  requireExact("AD_GLOBAL_KILL", "false");
  if (!/^ca-pub-\d{10,30}$/u.test(env.ADSENSE_CLIENT_ID ?? "")) {
    blockers.push("ADSENSE_CLIENT_ID must use ca-pub-<digits>.");
  }
  if (env.ENABLE_SEARCH_INDEXING !== "true") {
    blockers.push("AdSense should not be enabled while public search indexing is disabled.");
  }
} else {
  warnings.push("AdSense is disabled. Enable it only after Google approves the public production site.");
}

const layout = read("app/layout.tsx");
const story = read("components/structured-data.tsx");
if (!layout.includes("GOOGLE_SITE_VERIFICATION")) blockers.push("Google site verification metadata is missing.");
if (!/NewsArticle|Article/iu.test(story)) warnings.push("Confirm NewsArticle structured data is rendered by the story page implementation.");

console.log("\nNorthline Google launch check\n");
for (const warning of warnings) console.log(`⚠ ${warning}`);
for (const blocker of blockers) console.log(`✗ ${blocker}`);
if (!blockers.length) console.log("✓ Google launch controls are internally consistent.");
console.log(`\n${blockers.length} blocker(s), ${warnings.length} warning(s).\n`);
process.exit(blockers.length ? 1 : 0);

function requireFile(path) {
  if (!existsSync(path)) blockers.push(`Missing required public route or file: ${path}`);
}
function requireValue(key) {
  const value = env[key]?.trim() ?? "";
  if (!value || /REPLACE|PLACEHOLDER|example\.com/iu.test(value)) blockers.push(`${key} is missing or still a placeholder.`);
}
function requireExact(key, expected) {
  if (env[key] !== expected) blockers.push(`${key} must equal ${expected}.`);
}
function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
