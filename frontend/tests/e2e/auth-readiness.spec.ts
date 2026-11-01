import { test, expect } from "@playwright/test";

test("Skript ishlamasa kirish va faollashtirish maxfiy ma’lumot yubormaydi", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    for (const path of ["/kirish", "/faollashtirish", "/parolni-tiklash"]) {
      await page.goto(path);
      await expect(page.locator("form")).toHaveAttribute("method", "post");
      const inputs = page.locator("form input");
      expect(await inputs.count()).toBeGreaterThan(0);
      for (const input of await inputs.all())
        await expect(input).toBeDisabled();
      await expect(page.locator("form button")).toBeDisabled();
      // Playwright's text matcher intentionally skips noscript content.
      expect(
        await page
          .locator("noscript")
          .evaluate((element) => element.textContent),
      ).toContain("JavaScript");
      expect(new URL(page.url()).search).toBe("");
    }
  } finally {
    await context.close();
  }
});
