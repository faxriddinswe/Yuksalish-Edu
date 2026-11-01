import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const env = Object.fromEntries(readFileSync(`${root}.env.local`, "utf8").split("\n")
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const base = "http://localhost:3000";
const widths = [1440, 1024, 768, 430, 390, 375, 360, 320];
mkdirSync(`${root}.local/screenshots`, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], failedResponses = [], writes = [], checks = {};
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400)
      failedResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  await page.route("**/api/v1/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method()) && !new URL(route.request().url()).pathname.startsWith("/api/v1/auth/")) {
      writes.push(new URL(route.request().url()).pathname);
      await route.abort();
    } else await route.continue();
  });
  async function login(phone) {
    await page.goto(`${base}/kirish`);
    await page.getByLabel("Telefon raqamingiz").fill(phone);
    await page.getByLabel("Parol", { exact: true }).fill(env.DEMO_PASSWORD);
    await page.getByRole("button", { name: "Kabinetga kirish", exact: true }).click();
    await expect(page).toHaveURL(`${base}/kabinet`);
  }
  async function logout() {
    await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
    await page.waitForURL(`${base}/kirish`);
  }
  async function apiStatus(path, status) {
    const response = await page.request.get(`${base}/api/v1/${path}`);
    expect(response.status(), path).toBe(status);
    return response;
  }
  async function responsive(name) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: ${width}px`).toBe(true);
      if ([1440, 375].includes(width)) await page.screenshot({ path: `${root}.local/screenshots/${name}-${width}.png` });
    }
  }
  await login("+998900000001");
  for (const path of ["staff/", "reports/financial/", "audit/", "content/settings/"])
    await apiStatus(path, 200);
  checks.owner_full_overview = true;
  await logout();

  await login("+998900000002");
  await apiStatus("staff/", 200);
  await apiStatus("content/settings/", 200);
  await apiStatus("reports/financial/", 403);
  await apiStatus("billing/teacher-payments/", 403);
  await page.goto(`${base}/kabinet/staff`);
  await page.getByRole("button", { name: "Yangi yozuv", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox", { name: "Rahbar", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("checkbox", { name: "Buxgalter", exact: true })).toBeVisible();
  await responsive("administrator-account-preview");
  await page.keyboard.press("Escape");
  await page.goto(`${base}/kabinet/settings`);
  await expect(page.getByRole("button", { name: "O‘zgarishlarni saqlash" })).toBeVisible();
  await page.goto(`${base}/kabinet/achievements`);
  await page.getByRole("button", { name: "Yangi yozuv", exact: true }).click();
  await expect(dialog.getByLabel("Shaxsiy ma’lumotlari tozalangan rasm")).toBeVisible();
  await responsive("administrator-certificate-preview");
  await page.keyboard.press("Escape");
  await page.goto(`${base}/kabinet/invoices`);
  await expect(page.getByLabel("O‘quvchini tanlang", { exact: true })).toBeVisible();
  checks.administrator_accounts_site_content_and_student_lookup = true;
  checks.administrator_finance_denied = true;
  await logout();

  await login("+998900000003");
  await apiStatus("staff/", 403);
  await apiStatus("content/settings/", 403);
  await apiStatus("reports/financial/", 200);
  await apiStatus("billing/teacher-payments/", 200);
  await page.goto(`${base}/kabinet/reports`);
  await expect(page.getByRole("heading", { name: "Moliyaviy hisobot", exact: true })).toBeVisible();
  await page.goto(`${base}/kabinet/staff`);
  await expect(page.getByRole("heading", { name: "Kirishga ruxsat yo‘q" })).toBeVisible();
  checks.accountant_finance_allowed_technical_management_denied = true;
  await logout();

  await page.goto(`${base}/natijalar`);
  const subjects = await (await apiStatus("public/subjects/?page_size=100", 200)).json();
  const results = await (await apiStatus("public/achievements/?page_size=100", 200)).json();
  await expect(page.locator(".subject-results-section")).toHaveCount(subjects.count);
  const perSubject = await Promise.all(subjects.results.map(async (subject) => {
    const response = await apiStatus(`public/achievements/?subject=${subject.id}&page_size=40`, 200);
    return (await response.json()).results.length;
  }));
  await expect(page.locator(".achievement-card")).toHaveCount(perSubject.reduce((sum, count) => sum + count, 0));
  for (const image of await page.locator(".achievement-card img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await responsive("certificates-public");
  const templateSlots = ["english", "uzbek", "math", "chemistry", "biology", "history", "korean"].reduce((sum, slug) => {
    const data = JSON.parse(readFileSync(`${root}certificates/${slug}/certificates.json`, "utf8"));
    expect(data.certificates).toHaveLength(slug === "english" ? 40 : 10);
    return sum + data.certificates.length;
  }, 0);
  expect(templateSlots).toBe(100);
  checks.public_subject_sections = subjects.count;
  checks.existing_public_certificates = results.count;
  checks.certificate_template_slots = templateSlots;
  for (const [path, parameter, heading] of [
    ["kurslar", "subject", /yo‘nalishni toping/],
    ["ustozlar", "subjects", /yoningizdagi ustozlar/],
    ["natijalar", "subject", /haqiqiy yutuqlar/],
  ]) {
    const query = new URLSearchParams({
      [parameter]: String(subjects.results[0].id),
      search: "Mavjud emas — pagination regressiya",
      page: "999999",
    });
    await page.goto(`${base}/${path}?${query}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByLabel("Qidirish", { exact: true })).toHaveValue(query.get("search"));
    await expect(page.getByRole("link", { name: subjects.results[0].name, exact: true })).toHaveAttribute("aria-current", "page");
  }
  checks.public_pagination_recovers_with_filters = true;
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
  expect(failedResponses).toEqual([]);
  writeFileSync(`${root}docs/roles-certificates-smoke-result.json`, JSON.stringify({
    passed: true, checked_at: new Date().toISOString(), base_url: base, checks,
    viewport_widths: widths, horizontal_overflow: false, javascript_errors: errors,
    unexpected_api_failures: failedResponses, business_writes: writes.length,
  }, null, 2) + "\n");
  process.stdout.write("Roles and certificates standalone smoke passed; business writes: 0.\n");
} finally {
  await browser.close();
}
