import { test, expect } from "@playwright/test";

test.describe("reflow at 200% zoom (640 CSS px)", () => {
  test.use({ viewport: { width: 640, height: 800 } });

  test("homepage does not require horizontal scrolling", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll, "Content reflows without horizontal scroll at 200% zoom").toBe(false);
  });
});

test.describe("first-class navigation smoke", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const routes = [
    "/latest",
    "/trending",
    "/about",
    "/corrections",
    "/ownership",
    "/privacy",
    "/terms",
    "/ai-policy",
    "/editorial-standards",
  ];

  for (const route of routes) {
    test(`${route} responds 200 and renders a heading`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }
});
