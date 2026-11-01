import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

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

test("Administrator vazifalari, moliyaviy chegaralar va 4 ustunli 40 ta sertifikat", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const stamp = Date.now().toString();
  const name = `Sinov xodimi ${stamp}`;
  await login(page, "+998900000002");
  await page.goto("/kabinet/staff");
  await page.getByRole("button", { name: "Yangi yozuv", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ism va familiya", { exact: false }).fill(name);
  await dialog
    .getByLabel("Telefon", { exact: false })
    .fill(`+99893${stamp.slice(-7)}`);
  await expect(
    dialog.getByRole("checkbox", { name: "Rahbar", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("checkbox", { name: "O‘qituvchi", exact: true })
    .check();
  await dialog.getByRole("checkbox", { name: "Faol akkaunt" }).check();
  await dialog.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Qidirish", { exact: true }).fill(name);
  let row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Tafsilot" }).click();
  await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("checkbox", { name: "O‘qituvchi", exact: true })
    .uncheck();
  await dialog
    .getByRole("checkbox", { name: "Buxgalter", exact: true })
    .check();
  await dialog.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Buxgalter");
  await row.getByRole("button", { name: "Tafsilot" }).click();
  await page
    .getByRole("button", { name: "Yozuvni o‘chirish", exact: true })
    .click();
  await page
    .getByRole("button", { name: "O‘chirishni tasdiqlash", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Yozuv o‘chirildi");
  expect(
    (
      await page.request.get(
        "/api/v1/staff/?search=" + encodeURIComponent(name),
      )
    ).ok(),
  ).toBe(true);
  expect((await page.request.get("/api/v1/reports/financial/")).status()).toBe(
    403,
  );
  expect(
    (await page.request.get("/api/v1/billing/teacher-payments/")).status(),
  ).toBe(403);
  await page.goto("/kabinet/settings");
  await expect(
    page.getByRole("button", { name: "O‘zgarishlarni saqlash" }),
  ).toBeVisible();
  const subjects = (
    await (await page.request.get("/api/v1/subjects/?page_size=100")).json()
  ).results;
  const selected = subjects.slice(0, 2);
  const session = await (
    await page.request.get("/api/v1/auth/session/")
  ).json();
  const prefix = `Gallery-${stamp}`;
  for (const subject of selected) {
    const total = subject.id === selected[0].id ? 41 : 40;
    for (let number = 1; number <= total; number++) {
      const response = await page.request.post(
        "/api/v1/content/achievements/",
        {
          headers: { "X-CSRFToken": session.csrfToken },
          multipart: {
            subject: String(subject.id),
            display_name: `Sun’iy o‘quvchi ${number}`,
            title: `${prefix} ${number}`,
            score: "57 ball · B2",
            is_sample: "true",
            description:
              number % 2
                ? "Faqat test uchun."
                : "Faqat E2E bazasidagi uzunroq tavsif. Bu haqiqiy sertifikat yoki yutuq emas.",
            achieved_on: "2026-10-01",
            publication_status: "PUBLISHED",
            privacy_reviewed: "true",
            consent_record: "Sun’iy test ma’lumoti. Haqiqiy odam emas.",
            image: {
              name: "test.png",
              mimeType: "image/png",
              buffer: readFileSync("tests/fixtures/content-test.png"),
            },
          },
        },
      );
      expect(response.status(), await response.text()).toBe(201);
    }
  }
  await page.goto(`/natijalar?search=${prefix}`);
  await expect(page.locator(".subject-results-section")).toHaveCount(2);
  await expect(page.locator(".achievement-card")).toHaveCount(80);
  for (const section of await page.locator(".subject-results-section").all())
    await expect(section.locator(".achievement-card")).toHaveCount(40);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const cards = page.locator(".achievement-card");
  const dimensions = await cards.evaluateAll((elements) =>
    elements.slice(0, 4).map((el) => ({
      height: el.getBoundingClientRect().height,
      top: el.getBoundingClientRect().top,
    })),
  );
  expect(new Set(dimensions.map((rect) => Math.round(rect.height))).size).toBe(
    1,
  );
  expect(new Set(dimensions.map((rect) => Math.round(rect.top))).size).toBe(1);
  const portrait = await cards
    .first()
    .locator(".certificate-preview")
    .boundingBox();
  expect(portrait).not.toBeNull();
  expect(portrait!.width / portrait!.height).toBeCloseTo(3 / 4, 2);
  await expect(cards.first()).toContainText("57 ball · B2");
  await expect(cards.first().locator(".certificate-sample")).toHaveText(
    "Namuna",
  );
  await expect
    .poll(() =>
      cards
        .first()
        .getByRole("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("certificates-desktop.png") });
  for (const width of [1440, 1024, 768, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px`,
    ).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("certificates-mobile.png") });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: selected[0].name, exact: true }).click();
  await expect(page.locator(".subject-results-section")).toHaveCount(1);
  await expect(page.locator(".achievement-card")).toHaveCount(40);
  const pagination = page.getByRole("navigation", { name: "Sahifalar" });
  await pagination.getByRole("link", { name: "Keyingi" }).click();
  await expect(page.locator(".achievement-card")).toHaveCount(1);
  await expect(pagination).toContainText("2-sahifa · 41 ta natija");
  await expect(page.getByLabel("Qidirish", { exact: true })).toHaveValue(
    prefix,
  );
  await pagination.getByRole("link", { name: "Oldingi" }).click();
  await expect(page.locator(".achievement-card")).toHaveCount(40);
  await expect(pagination).toContainText("1-sahifa · 41 ta natija");
  const image = await page
    .locator(".certificate-preview")
    .first()
    .getAttribute("href");
  expect((await page.request.get(image!)).status()).toBe(200);
  await page.goto("/kabinet");
  await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await page.waitForURL("**/kirish");
  await login(page, "+998900000003");
  for (const section of ["staff", "settings", "achievements"])
    await expect(
      page.locator(`.sidebar a[href="/kabinet/${section}"]`),
    ).toHaveCount(0);
  await page.goto("/kabinet/staff");
  await expect(
    page.getByRole("heading", { name: "Kirishga ruxsat yo‘q" }),
  ).toBeVisible();
  await page.goto("/kabinet/reports");
  await expect(
    page.getByRole("heading", { name: "Moliyaviy hisobot", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
