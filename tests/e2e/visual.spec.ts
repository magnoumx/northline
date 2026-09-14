import { test, expect } from "@playwright/test";

const CAPTURES = [
  { name: "home-desktop", route: "/", viewport: { width: 1440, height: 900 } },
  { name: "home-mobile", route: "/", viewport: { width: 390, height: 844 } },
  { name: "latest-desktop", route: "/latest", viewport: { width: 1440, height: 900 } },
  { name: "about-desktop", route: "/about", viewport: { width: 1440, height: 900 } },
] as const;

test.describe("visual regression", () => {
  for (const capture of CAPTURES) {
    test(capture.name, async ({ page }) => {
      await page.setViewportSize(capture.viewport);
      await page.goto(capture.route);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${capture.name}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});
