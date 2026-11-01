import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
const fixture = fileURLToPath(
  new URL("../fixtures/content-test.png", import.meta.url),
);
const stamp = String(Date.now()).slice(-7);
async function login(page: Page) {
  await page.goto("/kirish");
  await page.getByLabel("Telefon raqamingiz").fill("+998900000001");
  await page
    .getByLabel("Parol", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page
    .getByRole("button", { name: "Kabinetga kirish", exact: true })
    .click();
  await expect(page).toHaveURL(/\/kabinet/);
}
async function post(page: Page, path: string, data: unknown) {
  const token = (await (await page.request.get("/api/v1/auth/session/")).json())
    .csrfToken;
  const response = await page.request.post(`/api/v1/${path}`, {
    data,
    headers: { "X-CSRFToken": token },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function noOverflow(page: Page, label: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    label,
  ).toBe(true);
}
async function noAxeViolations(page: Page) {
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
}

test("Markaz rasmlari, ustoz va sertifikatni API bilan boshqarish", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.goto("/kabinet/settings");
  await page
    .getByRole("button", { name: "Markaz rasmlari", exact: true })
    .click();
  await page
    .getByLabel("Banner uchun markaz rasmi", { exact: true })
    .setInputFiles(fixture);
  await page
    .getByLabel("Markaz ichki muhiti rasmi", { exact: true })
    .setInputFiles(fixture);
  await page
    .getByLabel("Rasm izohi", { exact: true })
    .fill("Faqat E2E sinov rasmi");
  await expect(
    page.getByRole("button", { name: "Rasmni almashtirish", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "O‘zgarishlarni saqlash" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Markaz ma’lumotlari saqlandi",
  );
  const center = await (
    await page.request.get("/api/v1/public/settings/")
  ).json();
  expect(center.cover_image).toMatch(/^\/media\/center\//);
  const preview = page.getByRole("img", {
    name: "Banner uchun markaz rasmi: tanlangan rasm",
  });
  await expect(preview).toBeVisible();
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Matn va bo‘limlar", exact: true })
    .click();
  await page
    .getByLabel(/^Markaz haqida batafsil/)
    .fill(
      "Yuksalish Edu — fanlarni izchil o‘rganish uchun o‘quv markazi. Bu matn faqat alohida E2E bazasida.",
    );
  await page.getByRole("button", { name: "O‘zgarishlarni saqlash" }).click();
  await expect(page.getByRole("status")).toContainText("saqlandi");
  expect(
    (await (await page.request.get("/api/v1/public/settings/")).json())
      .cover_image,
  ).toBe(center.cover_image);
  const subjects = (await (await page.request.get("/api/v1/subjects/")).json())
    .results;
  const subject = subjects.find((s: { name: string }) => s.name === "Ona tili");
  const otherSubject = subjects.find(
    (s: { id: number }) => s.id !== subject.id,
  );
  const teacherName = `E2E Ustoz ${stamp}`;
  const user = await post(page, "staff/", {
    full_name: teacherName,
    phone: `+99892${stamp}`,
    roles: ["TEACHER"],
    is_active: true,
  });
  await page.goto("/kabinet/teachers");
  await page.getByRole("button", { name: "Yangi yozuv", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("O‘qituvchi akkaunti", { exact: true })
    .selectOption(String(user.id));
  await dialog.getByLabel("Ommaviy ism", { exact: false }).fill(teacherName);
  await dialog
    .getByLabel("Havola nomi", { exact: false })
    .fill(`e2e-teacher-${stamp}`);
  await dialog.getByRole("checkbox", { name: "Ona tili", exact: true }).check();
  await dialog
    .getByLabel("Ustoz haqida qisqacha")
    .fill("Ona tili bo‘yicha faqat sinov uchun ustoz profili.");
  await dialog.getByLabel("O‘qitish tajribasi (yil)").fill("7");
  await dialog.getByLabel("Shu paytgacha dars bergan").fill("250");
  await dialog.getByLabel("Surat", { exact: true }).setInputFiles(fixture);
  await dialog.getByLabel("Nashr holati").selectOption("PUBLISHED");
  await dialog.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const teacher = (
    await (
      await page.request.get(
        `/api/v1/staff/teachers/?search=${encodeURIComponent(teacherName)}`,
      )
    ).json()
  ).results[0];
  expect(teacher.photo).toMatch(/^\/media\/teachers\//);
  await page.goto("/kabinet/achievements");
  await page.getByRole("button", { name: "Yangi yozuv", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Namuna kartochka", { exact: true }).check();
  await dialog
    .getByLabel("E’lon qilishga ruxsat etilgan ism")
    .fill(`E2E Sertifikat egasi ${stamp}`);
  await dialog
    .getByLabel("Yutuq sarlavhasi")
    .fill(`Sinov sertifikati ${stamp}`);
  await dialog
    .getByLabel("Tavsif", { exact: false })
    .fill("Faqat avtomatik test uchun yozuv. Haqiqiy natija emas.");
  await dialog
    .getByLabel("Fan", { exact: true })
    .selectOption(String(subject.id));
  await dialog
    .getByLabel("Natijaga tayyorlagan ustoz", { exact: true })
    .selectOption(String(teacher.id));
  await dialog.getByLabel("Sertifikat yoki natija sanasi").fill("2026-10-01");
  await dialog
    .getByLabel("Shaxsiy ma’lumotlari tozalangan rasm")
    .setInputFiles(fixture);
  await dialog
    .getByLabel("Rozilik qaydi")
    .fill("Sun’iy E2E ma’lumoti: haqiqiy odamga tegishli emas.");
  await dialog.getByLabel("Sertifikatdagi ortiqcha").check();
  await dialog.getByLabel("Nashr holati").selectOption("PUBLISHED");
  await dialog.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Qidirish", { exact: true }).fill(stamp);
  await expect(
    page.getByRole("cell", { name: `Sinov sertifikati ${stamp}`, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);
  await page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", {
        name: `Sinov sertifikati ${stamp}`,
        exact: true,
      }),
    })
    .getByRole("button", { name: "Tafsilot" })
    .click();
  await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Rasmni almashtirish", exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Tavsif", { exact: false })
    .fill("Tahrirlandi; rasm va ustoz saqlanadi. Faqat sinov uchun.");
  await dialog.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`/natijalar?search=${stamp}`);
  const card = page.locator(".achievement-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(teacherName);
  await expect(card).toContainText("Ona tili");
  await expect
    .poll(() =>
      card
        .getByRole("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("link", { name: otherSubject.name, exact: true })
    .click();
  await expect(page.locator(".achievement-card")).toHaveCount(0);
  await page.getByRole("link", { name: "Ona tili", exact: true }).click();
  await expect(page.locator(".achievement-card")).toHaveCount(1);
  await noAxeViolations(page);
  await page.goto(`/ustozlar/e2e-teacher-${stamp}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(teacherName);
  await expect(page.locator(".teacher-detail-facts")).toContainText(
    "250 nafar",
  );
  await expect(page.locator(".teacher-detail-facts")).toContainText("7 yil");
  await noAxeViolations(page);
  expect(errors).toEqual([]);
});

test("Kengaytirilgan sahifalar va CRM barcha ekranlarda", async ({ page }) => {
  test.setTimeout(300000);
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/markaz-haqida",
      "/natijalar",
      "/ustozlar",
      "/kurslar",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noOverflow(page, `${path} ${width}px`);
    }
  }
  await noAxeViolations(page);
  await login(page);
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/kabinet",
      "/kabinet/students",
      "/kabinet/center",
      "/kabinet/settings",
      "/kabinet/achievements",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noOverflow(page, `${path} ${width}px`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kabinet/settings");
  await page
    .getByRole("button", { name: "Markaz rasmlari", exact: true })
    .click();
  await noAxeViolations(page);
  await page.screenshot({
    path: "../docs/screenshots/settings-mobile.png",
    fullPage: true,
  });
  await page.goto("/kabinet/achievements");
  await page.getByRole("button", { name: "Yangi yozuv", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noOverflow(page, "Mobil rasm yuklash oynasi");
  await noAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Yangi yozuv", exact: true }),
  ).toBeFocused();
  await page.goto("/markaz-haqida");
  await noAxeViolations(page);
  await page.screenshot({
    path: "../docs/screenshots/center-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "../docs/screenshots/center-desktop.png",
    fullPage: true,
  });
});
