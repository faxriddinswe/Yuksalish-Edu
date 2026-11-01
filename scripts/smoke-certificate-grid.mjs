import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const base = "http://localhost:3000";
const widths = [1440, 1024, 768, 540, 430, 390, 360, 320];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
mkdirSync(`${root}.local/screenshots`, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], failed = [], writes = [], layouts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/(api|media)\//.test(new URL(response.url()).pathname))
      failed.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  await page.route("**/api/v1/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes.push(route.request().method());
      await route.abort();
    } else await route.continue();
  });
  const subjects = await (await page.request.get(`${base}/api/v1/public/subjects/`)).json();
  const english = subjects.results.find((subject) => subject.slug === "english");
  expect(english).toBeTruthy();
  const response = await page.request.get(`${base}/api/v1/public/achievements/?subject=${english.id}&page_size=40`);
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.count).toBe(40);
  expect(data.results).toHaveLength(40);
  expect(data.results.every((item) => item.is_sample && item.score === "57 ball · B2")).toBe(true);
  expect(new Set(data.results.map((item) => item.image)).size).toBe(1);
  for (const [name, path, selector] of [
    ["home", "/", ".results-band .certificate-gallery"],
    ["english", `/natijalar?subject=${english.id}`, ".certificate-gallery"],
  ]) {
    await page.goto(`${base}${path}`);
    const gallery = page.locator(selector);
    const cards = gallery.locator(".achievement-card");
    await expect(cards).toHaveCount(40);
    await expect(cards.first()).toContainText("Abdulatif Qulmirzayev");
    await expect(cards.first()).toContainText("Ingliz tili");
    await expect(cards.first()).toContainText("57 ball · B2");
    await expect(cards.first()).toContainText("Ko‘rsatilmagan");
    await expect(cards.first().locator(".certificate-sample")).toHaveText("Namuna");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await cards.first().scrollIntoViewIfNeeded();
      await expect.poll(() => cards.first().getByRole("img").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
      const columns = await gallery.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(width >= 1024 ? 4 : width >= 540 ? 2 : 1);
      const frame = await cards.first().locator(".certificate-preview").boundingBox();
      expect(frame.width / frame.height).toBeCloseTo(3 / 4, 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      layouts.push({ name, width, columns, image_ratio: Number((frame.width / frame.height).toFixed(3)) });
      if ([1440, 390].includes(width))
        await page.screenshot({ path: `${root}.local/screenshots/certificate-grid-${name}-${width}.png` });
    }
  }
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(writes).toEqual([]);
  writeFileSync(`${root}docs/certificate-grid-smoke-result.json`, JSON.stringify({
    passed: true, checked_at: new Date().toISOString(), base_url: base,
    english_cards: 40, home_cards: 40, shared_images: 1, layouts,
    javascript_errors: errors, unexpected_failures: failed, business_writes: writes.length,
  }, null, 2) + "\n");
  process.stdout.write("Certificate grid smoke passed: 40 cards, 4/2/1 columns, 3:4 frames; business writes: 0.\n");
} finally {
  await browser.close();
}
