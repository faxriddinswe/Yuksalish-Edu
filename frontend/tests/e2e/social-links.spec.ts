import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const links = {
  Telegram: "https://t.me/yuksalish_e2e_fixture",
  Instagram: "https://www.instagram.com/yuksalish_e2e_fixture/",
  LinkedIn: "https://www.linkedin.com/company/yuksalish-e2e-fixture/",
};

async function checkLinks(page: Page, selector: string) {
  const group = page
    .locator(selector)
    .getByRole("group", { name: "Ijtimoiy tarmoqlar" });
  for (const [name, href] of Object.entries(links)) {
    const link = group.getByRole("link", {
      name: `${name} — yangi oynada ochiladi`,
      exact: true,
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
}

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

test("Ijtimoiy havolalarni sozlash va barcha kabinetlarda ko‘rish", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "+998900000001");
  await page.goto("/kabinet/settings");
  await page
    .getByRole("button", { name: "Aloqa va e’lonlar", exact: true })
    .click();
  for (const [name, href] of Object.entries(links))
    await page.getByLabel(`${name} havolasi`, { exact: true }).fill(href);
  await page.getByRole("button", { name: "O‘zgarishlarni saqlash" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Markaz ma’lumotlari saqlandi",
  );
  await checkLinks(page, ".workspace-footer");
  await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await expect(page).toHaveURL(/\/kirish$/);
  await checkLinks(page, ".auth-social-footer");

  for (const phone of [
    "+998900000001",
    "+998900000002",
    "+998900000003",
    "+998901000000",
    "+998900000004",
    "+998900000005",
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page, phone);
    await checkLinks(page, ".sidebar-footer");
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await checkLinks(page, ".workspace-footer");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${phone} / ${width}px`,
      ).toBe(true);
      if (width < 1000) {
        await page
          .getByRole("button", { name: "Kabinet menyusini ochish" })
          .click();
        await checkLinks(page, ".mobile-drawer");
        await page.getByRole("button", { name: "Menyuni yopish" }).click();
      }
    }
    await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
    await expect(page).toHaveURL(/\/kirish$/);
  }
  await page.goto("/");
  // Public ma’lumotlar 60 soniyagacha keshlanishi mumkin.
  await expect(async () => {
    await page.reload();
    await checkLinks(page, ".public-footer");
  }).toPass({ timeout: 75000, intervals: [1000, 5000] });
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkLinks(page, ".public-footer");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
