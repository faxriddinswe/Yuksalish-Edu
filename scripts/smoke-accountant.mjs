import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Existing localhost data is read only. Financial forms are previewed, never saved.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const env = Object.fromEntries(
  readFileSync(`${root}.env.local`, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const base = "http://localhost:3000";
const widths = [1440, 1024, 768, 430, 390, 375, 360, 320];
mkdirSync(`${root}.local/screenshots`, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  const failures = [];
  const financialWrites = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400)
      failures.push({ status: response.status(), path: new URL(response.url()).pathname });
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && !new URL(request.url()).pathname.startsWith("/api/v1/auth/")) {
      financialWrites.push(new URL(request.url()).pathname);
      await route.abort();
    } else await route.continue();
  });
  async function responsive(name) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width}px`).toBe(true);
      if ([1440, 375, 320].includes(width))
        await page.screenshot({ path: `${root}.local/screenshots/accountant-${name}-${width}.png`, fullPage: true });
    }
  }
  await page.goto(`${base}/kirish`);
  await page.getByLabel("Telefon raqamingiz").fill("+998900000003");
  await page.getByLabel("Parol", { exact: true }).fill(env.DEMO_PASSWORD);
  await page.getByRole("button", { name: "Kabinetga kirish", exact: true }).click();
  await expect(page).toHaveURL(`${base}/kabinet`);
  await expect(page.locator(".dashboard-center-banner")).toHaveCount(0);
  for (const section of ["lessons", "schedule", "rooms", "enrollments", "subjects", "courses"])
    await expect(page.locator(`.sidebar a[href="/kabinet/${section}"]`)).toHaveCount(0);
  await responsive("dashboard");
  await expect(page.locator('.mobile-bottom-nav a[href="/kabinet/teachers"]')).toBeVisible();

  await page.goto(`${base}/kabinet/teachers`);
  await page.getByLabel("Ustoz ismi yoki telefoni").fill("dEMo uSTOz 1");
  await expect(page.locator(".teacher-finance-card")).toHaveCount(1);
  await expect(page.locator(".teacher-finance-card")).toContainText("Faol o‘quvchilar");
  await responsive("teachers");
  await page.getByRole("button", { name: "To‘lovlar va tarix" }).click();
  await expect(page.getByRole("heading", { name: "Demo Ustoz 1", exact: true })).toBeVisible();
  await responsive("teacher-history");
  await page.getByRole("button", { name: "Ustozga to‘lov kiritish" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Summa (so‘m)").fill("150000.25");
  await dialog.getByLabel("Izoh / oylik yoki avans").fill("Saqlanmaydigan lokal ko‘rib chiqish");
  await dialog.getByRole("button", { name: "To‘lovni tekshirish" }).click();
  await expect(dialog.getByRole("button", { name: "Tasdiqlash va saqlash" })).toBeVisible();
  await responsive("teacher-preview");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await page.goto(`${base}/kabinet/record-payment`);
  const search = page.getByRole("combobox", { name: "O‘quvchini qidirish" });
  const studentName = "Demo O‘quvchi 0001";
  await search.fill(studentName.toUpperCase());
  await expect(page.getByRole("option", { name: new RegExp(studentName) })).toBeVisible();
  await search.fill(studentName.toLowerCase());
  await expect(page.getByRole("option", { name: new RegExp(studentName) })).toBeVisible();
  await search.press("Enter");
  await expect(page.locator(".selected-student")).toContainText(studentName);
  await page.getByLabel("To‘lov summasi (so‘m)").fill("1000.25");
  await responsive("payment");
  await page.getByRole("button", { name: "To‘lovni tekshirish" }).click();
  await expect(dialog).toContainText(studentName);
  await responsive("payment-preview");
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: "Hisoblar bo‘yicha" }).check();
  await expect(page.locator(".allocation-row").first()).toBeVisible();
  await responsive("payment-allocation");

  await page.goto(`${base}/kabinet/exports`);
  await expect(page.getByRole("heading", { name: "Excel hisobotlar", exact: true })).toBeVisible();
  await expect(page.locator(".accounting-metrics")).toBeVisible();
  const month = `${await page.getByLabel("Hisobot oyi").inputValue()}-01`;
  const response = await page.request.get(`${base}/api/v1/reports/financial/?month=${month}`);
  expect(response.ok()).toBe(true);
  const expected = await response.json();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel yuklab olish", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe(`yuksalish-hisobot-${month}.xlsx`);
  await download.saveAs(`${root}.local/accountant-report.xlsx`);
  expect(readFileSync(`${root}.local/accountant-report.xlsx`).subarray(0, 2).toString()).toBe("PK");
  await expect(page.getByRole("status")).toContainText("Excel hisobot yuklab olindi");
  await responsive("exports");
  await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await expect(page).toHaveURL(`${base}/kirish`);
  expect(financialWrites).toEqual([]);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  writeFileSync(`${root}.local/accountant-report-expected.json`, JSON.stringify(expected, null, 2));
  writeFileSync(`${root}docs/accountant-smoke-result.json`, JSON.stringify({
    checked_at: new Date().toISOString(), base_url: base, passed: true,
    banner_removed: true, education_navigation_hidden: true, teacher_search_exact: true,
    teacher_history_and_unsaved_payment_preview: true,
    student_case_insensitive_keyboard_selection: true,
    manual_payment_and_unsaved_preview: true, explicit_allocations_preserved: true,
    excel_browser_download: true, viewport_widths: widths,
    responsive_views: ["dashboard", "teachers", "teacher-history", "teacher-preview", "payment", "payment-preview", "payment-allocation", "exports"],
    horizontal_overflow: false, javascript_errors: errors, failed_api_responses: failures,
    financial_writes: financialWrites.length,
  }, null, 2));
  process.stdout.write("Accountant standalone smoke passed; financial writes: 0.\n");
} finally {
  await browser.close();
}
