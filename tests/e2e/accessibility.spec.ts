import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VIEWPORTS = [
  { name: "320", width: 320, height: 700 },
  { name: "360", width: 360, height: 780 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 860 },
  { name: "768", width: 768, height: 900 },
  { name: "1024", width: 1024, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

const THEMES = ["light", "dark"] as const;

async function applyTheme(page: import("@playwright/test").Page, theme: string) {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("northline-reader-prefs", JSON.stringify({ theme: t }));
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = t;
  }, theme);
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`homepage a11y @ ${viewport.name} ${theme}`, () => {
      test.use({ viewport });

      test("has no WCAG 2.1 AA violations", async ({ page }) => {
        await applyTheme(page, theme);
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(
          results.violations,
          JSON.stringify(results.violations, null, 2),
        ).toEqual([]);
      });
    });
  }
}

const KEY_ROUTES = ["/latest", "/trending", "/about", "/corrections", "/privacy"];

test.describe("key routes a11y @ 1440 light", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const route of KEY_ROUTES) {
    test(`${route} has no WCAG 2.1 AA violations`, async ({ page }) => {
      await applyTheme(page, "light");
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([]);
    });
  }
});
