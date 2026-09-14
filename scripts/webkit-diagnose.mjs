import { webkit, chromium } from "@playwright/test";

const server = process.argv[2] ?? "http://localhost:3000";

for (const [name, type] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await type.launch();
  const page = await browser.newPage();
  const errors = [];
  const consoleMsgs = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") consoleMsgs.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(server, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label^="Search Northline"]');
    const theme = document.querySelector('[aria-label^="Switch to"]');
    return {
      hasSearchBtn: !!btn,
      searchBtnAria: btn?.getAttribute("aria-label"),
      themeBtnAria: theme?.getAttribute("aria-label"),
      dataTheme: document.documentElement.dataset.theme,
      reactMarker: !!document.querySelector("[data-reactroot], #__next, #__vinext"),
      scripts: [...document.scripts].map((s) => s.src || "inline").slice(0, 5),
    };
  });
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(info, null, 2));
  console.log("errors:", errors.slice(0, 5));
  console.log("console:", consoleMsgs.slice(0, 5));
  await browser.close();
}
