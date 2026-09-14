#!/usr/bin/env node
// Run Lighthouse against key public routes on the local site and record real
// performance / accessibility / best-practices / SEO scores.
// Usage: npm run perf            (builds + starts the site, audits, writes reports)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const ROUTES = ["/", "/latest", "/about"];
const outDir = resolve("outputs", "lighthouse");
mkdirSync(outDir, { recursive: true });

function waitForServer(url, timeoutMs = 90_000) {
  const start = Date.now();
  return new Promise((resolvePromise, rejectPromise) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok || res.status === 200) return resolvePromise();
      } catch {
        /* not up yet */
      }
      if (Date.now() - start > timeoutMs) {
        return rejectPromise(new Error("Server did not start in time"));
      }
      setTimeout(tick, 1_500);
    };
    tick();
  });
}

async function main() {
  console.log("Starting local site for Lighthouse...");
  const server = spawn("npm", ["run", "dev"], {
    stdio: "ignore",
    shell: true,
    detached: false,
  });
  let chrome;
  try {
    await waitForServer(BASE);
    console.log("Site is up. Launching Chrome...");
    chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    });
    const options = {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2 },
    };
    const summary = [];
    for (const route of ROUTES) {
      const url = `${BASE}${route}`;
      const result = await lighthouse(url, options);
      const { lhr } = result;
      const categories = lhr.categories;
      const scores = {
        route,
        performance: Math.round(categories.performance.score * 100),
        accessibility: Math.round(categories.accessibility.score * 100),
        bestPractices: Math.round(categories["best-practices"].score * 100),
        seo: Math.round(categories.seo.score * 100),
        lcp: lhr.audits["largest-contentful-paint"]?.displayValue ?? "n/a",
        cls: lhr.audits["cumulative-layout-shift"]?.displayValue ?? "n/a",
        tbt: lhr.audits["total-blocking-time"]?.displayValue ?? "n/a",
      };
      summary.push(scores);
      const safe = route === "/" ? "home" : route.replaceAll("/", "_");
      writeFileSync(resolve(outDir, `${safe}.json`), JSON.stringify(lhr, null, 2));
      writeFileSync(resolve(outDir, `${safe}.html`), result.report);
      console.log(`\n${route}`);
      console.log(`  performance ${scores.performance} · a11y ${scores.accessibility} · bp ${scores.bestPractices} · seo ${scores.seo}`);
      console.log(`  LCP ${scores.lcp} · CLS ${scores.cls} · TBT ${scores.tbt}`);
    }
    writeFileSync(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(`\nReports written to ${outDir}`);
  } finally {
    try {
      await chrome?.kill();
    } catch {
      /* ignore */
    }
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error("Lighthouse run failed:", error);
  process.exitCode = 1;
});
