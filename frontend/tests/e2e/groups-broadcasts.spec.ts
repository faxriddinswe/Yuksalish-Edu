import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
async function logout(page: Page) {
  await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await expect(page).toHaveURL(/\/kirish$/);
}
async function noOverlap(first: Locator, second: Locator) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 1);
}

test("O‘quvchi guruhlari ruxsat xatosisiz va ixcham ekranlarda", async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, "+998900000004");
  const denied: string[] = [];
  const requests: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 403) denied.push(response.url());
  });
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  await page.goto("/kabinet/groups");
  await expect(
    page.getByRole("heading", { name: "Guruhlarim", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".student-group-card").first()).toBeVisible();
  await page
    .getByLabel("Guruh yoki kursni qidirish")
    .fill("E2E topilmaydigan guruh 983742");
  await expect(
    page.getByText(/Bu tanlov bo‘yicha guruhlar topilmadi/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filtrlarni tozalash" }).click();
  await expect(page.locator(".student-group-card").first()).toBeVisible();
  for (const width of [1440, 1024, 768, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px overflow`,
    ).toBe(true);
    await page.locator(".dashboard-header").scrollIntoViewIfNeeded();
    const actions = page.locator(
      ".header-account > a, .header-account > button",
    );
    await noOverlap(actions.nth(0), actions.nth(1));
    await noOverlap(actions.nth(1), actions.nth(2));
    if (width === 1440)
      expect(
        await page
          .locator(".student-group-grid")
          .evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
          ),
      ).toBe(2);
    const socials = page.locator(".workspace-footer .social-link");
    await socials.first().scrollIntoViewIfNeeded();
    await noOverlap(socials.nth(0), socials.nth(1));
    await noOverlap(socials.nth(1), socials.nth(2));
    if (width < 1000) {
      await page
        .getByRole("button", { name: "Kabinet menyusini ochish" })
        .click();
      await noOverlap(
        page.locator(".mobile-drawer .wordmark"),
        page.getByRole("button", { name: "Menyuni yopish" }),
      );
      const icons = page.locator(".mobile-drawer .social-link");
      await icons.first().scrollIntoViewIfNeeded();
      await noOverlap(icons.nth(0), icons.nth(1));
      await noOverlap(icons.nth(1), icons.nth(2));
      await page.getByRole("button", { name: "Menyuni yopish" }).click();
    }
  }
  expect(denied).toEqual([]);
  expect(
    requests.filter((path) =>
      /^\/api\/v1\/(courses|staff\/teachers|rooms)\//.test(path),
    ),
  ).toEqual([]);
  // Next.js keeps a separate route-announcer alert outside the app content.
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .locator(".student-group-card")
    .first()
    .getByRole("link", { name: /dars jadvali/ })
    .click();
  await expect(page).toHaveURL(/\/kabinet\/lessons\?group=\d+/);
  await expect(
    page.getByRole("heading", { name: "Darslar va jadval", exact: true }),
  ).toBeVisible();
  expect(denied).toEqual([]);
  await logout(page);
  for (const width of [320, 360, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await noOverlap(
      page.locator(".public-header .wordmark"),
      page.getByRole("button", { name: "Menyuni ochish", exact: true }),
    );
    const socials = page.locator(".public-footer .social-link");
    await socials.first().scrollIntoViewIfNeeded();
    await noOverlap(socials.nth(0), socials.nth(1));
    await noOverlap(socials.nth(1), socials.nth(2));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("Administrator xabari barcha rollarga yetadi va qayta urinish dublikat yaratmaydi", async ({
  page,
}) => {
  test.setTimeout(240000);
  const title = `E2E umumiy e’lon ${Date.now()}`;
  const message =
    "Faqat sun’iy E2E akkauntlar uchun xabar.\nYangi jadval bilan tanishing.";
  await login(page, "+998900000002");
  await page.goto("/kabinet/notifications");
  await page.getByRole("button", { name: "Hammaga xabar yuborish" }).click();
  await page.getByLabel("Xabar sarlavhasi", { exact: true }).fill(title);
  await page.getByLabel("Xabar matni", { exact: true }).fill(message);
  await page
    .getByRole("button", { name: "Xabarni tekshirish", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(title);
  await expect(page.getByRole("dialog")).toContainText("Qabul qiluvchilar");
  let attempts = 0;
  await page.route("**/api/v1/notifications/broadcast/", async (route) => {
    if (route.request().method() === "POST" && ++attempts === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Tasdiqlash va yuborish", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(title);
  await page
    .getByRole("button", { name: "Tasdiqlash va yuborish", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    /Xabar \d+ ta akkauntga yuborildi/,
  );
  await page.unroute("**/api/v1/notifications/broadcast/");
  await page
    .getByRole("button", { name: "Yuborilgan e’lonlar", exact: true })
    .click();
  await expect(
    page.locator(".notification-card").filter({ hasText: title }),
  ).toHaveCount(1);
  await logout(page);
  for (const phone of [
    "+998900000001",
    "+998900000002",
    "+998900000003",
    "+998901000000",
    "+998900000004",
    "+998900000005",
  ]) {
    await login(page, phone);
    await page.goto("/kabinet/notifications");
    const card = page.locator(".notification-card").filter({ hasText: title });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(message);
    await expect(card).toContainText("Yangi");
    await expect(page.locator(".notification-badge")).toBeVisible();
    if (phone === "+998900000004") {
      for (const width of [1440, 375, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await card.getByRole("button", { name: "O‘qildi", exact: true }).click();
      await expect(card).toContainText("O‘qilgan");
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await logout(page);
  }
});
