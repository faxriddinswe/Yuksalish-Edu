import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { tashkentDay } from "../../src/lib/formatting/calendar";

async function login(page: Page, phone: string) {
  await page.goto("/kirish");
  await page.getByLabel("Telefon raqamingiz").fill(phone);
  await page
    .getByLabel("Parol", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page
    .getByRole("button", { name: "Kabinetga kirish", exact: true })
    .click();
  await expect(page).toHaveURL(/\/kabinet$/);
}
async function post(page: Page, path: string, data: unknown) {
  const session = await (
    await page.request.get("/api/v1/auth/session/")
  ).json();
  const response = await page.request.post(`/api/v1/${path}`, {
    data,
    headers: { "X-CSRFToken": session.csrfToken },
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return response.json();
}
async function responsive(page: Page) {
  for (const width of [1440, 1024, 768, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px overflow`,
    ).toBe(true);
  }
}

test("Buxgalter paneli, ustoz to‘lovlari, tez to‘lov va haqiqiy Excel yuklash", async ({
  page,
}, testInfo) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const stamp = Date.now();
  const studentName = `Azizbek Aliyev ${stamp}`;
  const note = `E2E ustoz avansi ${stamp}`;
  const today = tashkentDay();
  const month = `${today.slice(0, 7)}-01`;
  await login(page, "+998900000001");
  const student = await post(page, "students/", {
    full_name: studentName,
    registered_on: today,
    status: "ACTIVE",
  });
  const subjects = await (
    await page.request.get("/api/v1/subjects/?page_size=50")
  ).json();
  await post(page, "billing/invoices/opening-balance/", {
    student: student.id,
    subject: subjects.results[0].id,
    month,
    amount: "300000.00",
    due_date: today,
    as_of: today,
    reason: "Faqat E2E bazasidagi hisob",
  });
  await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await login(page, "+998900000003");
  await expect(page.locator(".dashboard-center-banner")).toHaveCount(0);
  const blocked = [
    "enrollments",
    "lessons",
    "schedule",
    "rooms",
    "subjects",
    "courses",
  ];
  for (const section of blocked)
    await expect(
      page.locator(`.sidebar a[href="/kabinet/${section}"]`),
    ).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Kabinet menyusini ochish" }).click();
  for (const section of blocked)
    await expect(
      page.locator(`.mobile-drawer a[href="/kabinet/${section}"]`),
    ).toHaveCount(0);
  await page.getByRole("button", { name: "Menyuni yopish" }).click();
  await expect(
    page.locator('.mobile-bottom-nav a[href="/kabinet/teachers"]'),
  ).toBeVisible();
  await page.goto("/kabinet/lessons");
  await expect(
    page.getByRole("heading", { name: "Kirishga ruxsat yo‘q" }),
  ).toBeVisible();
  await page.goto("/kabinet/teachers");
  await page.getByLabel("Ustoz ismi yoki telefoni").fill("demo ustoz 1");
  const card = page.locator(".teacher-finance-card").filter({
    has: page.getByRole("heading", { name: "Demo Ustoz 1", exact: true }),
  });
  await expect(card).toBeVisible();
  await expect(page.locator(".teacher-finance-card")).toHaveCount(1);
  await expect(card).toContainText("Faol o‘quvchilar");
  await responsive(page);
  await page.screenshot({
    path: testInfo.outputPath("accountant-teachers-320.png"),
    fullPage: true,
  });
  await card.getByRole("button", { name: "To‘lovlar va tarix" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Ustoz 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ustozga to‘lov kiritish" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Summa (so‘m)").fill("137500.25");
  await dialog.getByLabel("Izoh / oylik yoki avans").fill(note);
  await responsive(page);
  await dialog.getByRole("button", { name: "To‘lovni tekshirish" }).click();
  let attempts = 0;
  await page.route("**/api/v1/billing/teacher-payments/", async (route) => {
    if (route.request().method() === "POST" && ++attempts === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Tasdiqlash va saqlash" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Tasdiqlash va saqlash" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Ustoz to‘lovi saqlandi",
  );
  await page.unroute("**/api/v1/billing/teacher-payments/");
  const payouts = await (
    await page.request.get(
      `/api/v1/billing/teacher-payments/?search=Demo%20Ustoz%201&month=${month}&page_size=50`,
    )
  ).json();
  expect(
    payouts.results.filter((row: { note: string }) => row.note === note),
  ).toHaveLength(1);
  await expect(
    page.locator(".teacher-payout-row").filter({ hasText: note }),
  ).toContainText("137 500");
  await responsive(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  await page.goto("/kabinet/record-payment");
  const search = page.getByRole("combobox", { name: "O‘quvchini qidirish" });
  await search.fill(studentName.toUpperCase());
  await expect(
    page.getByRole("option", { name: new RegExp(studentName) }),
  ).toBeVisible();
  await search.fill(studentName.toLowerCase());
  await expect(
    page.getByRole("option", { name: new RegExp(studentName) }),
  ).toBeVisible();
  await search.press("Enter");
  await expect(page.locator(".selected-student")).toContainText(studentName);
  await page.getByLabel("To‘lov summasi (so‘m)").fill("125000.50");
  await responsive(page);
  await page.screenshot({
    path: testInfo.outputPath("accountant-payment-320.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "To‘lovni tekshirish" }).click();
  await expect(dialog).toContainText(studentName);
  await expect(dialog).toContainText("125 000");
  await dialog.getByRole("button", { name: "Tasdiqlash va saqlash" }).click();
  await expect(page.getByRole("status")).toContainText("to‘lov saqlandi");
  const payments = await (
    await page.request.get(`/api/v1/billing/payments/?student=${student.id}`)
  ).json();
  expect(payments.count).toBe(1);
  expect(payments.results[0].amount).toBe("125000.50");
  const options = await (
    await page.request.get(
      `/api/v1/billing/payments/options/?student=${student.id}`,
    )
  ).json();
  expect(options.balance).toBe("174999.50");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  await page.goto("/kabinet/exports");
  await page
    .getByLabel("O‘quvchi ismi yoki telefoni")
    .fill(studentName.toLowerCase());
  await expect(page.locator(".accounting-metrics").first()).toContainText(
    "125 000",
  );
  await responsive(page);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Excel yuklab olish", exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe(`yuksalish-hisobot-${month}.xlsx`);
  const filename = testInfo.outputPath("accountant-report.xlsx");
  await download.saveAs(filename);
  const bytes = readFileSync(filename);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(bytes.length).toBeGreaterThan(3000);
  await page.screenshot({
    path: testInfo.outputPath("accountant-exports-320.png"),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});
