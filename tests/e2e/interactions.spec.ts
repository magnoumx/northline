import { test, expect } from "@playwright/test";

test.describe("article page", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("renders a developing story with headline and reading content", async ({ page }) => {
    const response = await page.goto("/story/neighborhood-batteries-heat-grid");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("main")).toContainText(/batteries|grid|heat/i);
  });
});

test.describe("protected workspace gates", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("newsroom shows the sign-in gate, not editorial data", async ({ page }) => {
    await page.goto("/newsroom");
    await expect(page.locator("h1")).toContainText(/sign in to open newsroom os/i);
    await expect(page.getByText(/protected editorial workspace/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in securely/i })).toBeVisible();
  });

  test("advertiser portal shows the sign-in gate", async ({ page }) => {
    await page.goto("/advertiser");
    await expect(page.locator("h1")).toContainText(/sign in before opening commercial records/i);
    await expect(page.getByText(/protected advertiser workspace/i)).toBeVisible();
  });
});

test.describe("client interactions", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("header renders the custom n monogram and only it", async ({ page }) => {
    await page.goto("/");
    const monogram = page.locator(".masthead .northline-monogram");
    await expect(monogram).toBeVisible();
    await expect(page.locator(".masthead .brand-mark__word")).toHaveCount(0);
  });

  test("search dialog opens, accepts a query, and navigates to results", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /search northline/i }).click();
    const dialog = page.locator("dialog.search-dialog");
    await expect(dialog).toHaveAttribute("open", "", { timeout: 10_000 });
    const input = dialog.locator("#site-search");
    await input.click();
    await input.fill("grid reliability");
    await input.press("Enter");
    await page.waitForURL(/\/search\?q=/, { timeout: 10_000 });
    expect(page.url()).toContain("q=grid");
  });

  test("theme toggle flips the document theme", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const initial = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.getByRole("button", { name: /switch to (light|dark) theme/i }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme), {
        timeout: 8_000,
      })
      .not.toBe(initial);
  });
});
