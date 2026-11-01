import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tashkentDay } from "../../src/lib/formatting/calendar";
import { dateTime } from "../../src/lib/formatting/index";

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
  const token = (await (await page.request.get("/api/v1/auth/session/")).json())
    .csrfToken;
  const response = await page.request.post(`/api/v1/${path}`, {
    data,
    headers: { "X-CSRFToken": token },
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return response.json();
}

test("O‘qituvchi guruhlari, 7 kunlik jadval va davomatning oilaga avtomatik ko‘rinishi", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  await login(page, "+998900000001");
  const groups = (
    await (
      await page.request.get("/api/v1/groups/?search=Demo%20Ingliz%20tili%201")
    ).json()
  ).results;
  const group = groups.find(
    (item: { name: string }) => item.name === "Demo Ingliz tili 1",
  );
  expect(group).toBeTruthy();
  const student = (
    await (
      await page.request.get(
        "/api/v1/students/?search=Demo%20O%E2%80%98quvchi%200001",
      )
    ).json()
  ).results[0];
  const day = tashkentDay();
  const existing = (
    await (
      await page.request.get(
        `/api/v1/lessons/?from=${day}&to=${day}&page_size=50`,
      )
    ).json()
  ).results;
  let starts = "";
  for (let minute = 19 * 60; minute < 23 * 60 + 40; minute += 15) {
    const candidate = `${day}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00+05:00`;
    const stamp = Date.parse(candidate);
    if (
      !existing.some(
        (item: {
          teacher: number;
          room: number;
          starts_at: string;
          ends_at: string;
        }) =>
          (item.teacher === group.teacher || item.room === group.room) &&
          Date.parse(item.starts_at) < stamp + 10 * 60000 &&
          Date.parse(item.ends_at) > stamp,
      )
    ) {
      starts = candidate;
      break;
    }
  }
  expect(starts).toBeTruthy();
  const lesson = await post(page, "lessons/", {
    group: group.id,
    teacher: group.teacher,
    room: group.room,
    starts_at: starts,
    ends_at: new Date(Date.parse(starts) + 10 * 60000).toISOString(),
    status: "SCHEDULED",
  });
  await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await login(page, "+998901000000");
  await expect(page.locator(".dashboard-center-banner")).toHaveCount(0);
  const denied: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 403) denied.push(response.url());
  });
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1000)
      await page
        .getByRole("button", { name: "Kabinet menyusini ochish" })
        .click();
    const menu = page.locator(width < 1000 ? ".mobile-drawer" : ".sidebar");
    for (const label of [
      "Xonalar",
      "Ustozlar",
      "Guruh a’zoliklari",
      "Haftalik jadval",
    ])
      await expect(
        menu.getByRole("link", { name: label, exact: true }),
      ).toHaveCount(0);
    await expect(
      menu.getByRole("link", { name: "O‘quvchilar", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Sertifikatlar", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByText("Markaz boshqaruvi", { exact: true }),
    ).toHaveCount(0);
    if (width < 1000)
      await page.getByRole("button", { name: "Menyuni yopish" }).click();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/kabinet/groups");
  await expect(
    page.getByRole("heading", { name: "Guruhlarim", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Ustoz", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Guruh yoki kurs", { exact: true })
    .fill("Demo Ingliz tili 1");
  const card = page.locator(".teacher-group-card").filter({
    has: page.getByRole("heading", {
      name: "Demo Ingliz tili 1",
      exact: true,
    }),
  });
  await expect(card.locator(".group-capacity")).toContainText(/\d+o‘quvchi/);
  await card.getByRole("button", { name: "Guruh tarkibi" }).click();
  const member = page
    .locator(".group-member-card")
    .filter({ hasText: student.full_name });
  await expect(member).toContainText("+998900000005");
  await page
    .getByLabel("Ism yoki telefon bo‘yicha qidirish")
    .fill("+998900000005");
  await expect(member).toBeVisible();
  for (const width of [1440, 1024, 768, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Guruh tarkibi ${width}`,
    ).toBe(true);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: "Dars jadvali", exact: true }).click();
  await expect(page).toHaveURL(`/kabinet/lessons?group=${group.id}`);
  await expect(page.getByLabel("Guruh", { exact: true })).toHaveValue(
    String(group.id),
  );
  await expect(page.locator(".week-day")).toHaveCount(7);
  await expect(page.locator(".week-day.today")).toContainText(group.name);
  await page.getByRole("button", { name: "Keyingi 7 kun" }).click();
  await expect(page.locator(".week-day.today")).toHaveCount(0);
  await page.getByRole("button", { name: "Bugundan", exact: true }).click();
  await expect(page.locator(".week-day.today")).toContainText(group.name);
  for (const width of [1440, 1024, 768, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Jadval ${width}`,
    ).toBe(true);
  }
  await page
    .locator(`.week-lesson a[href="/kabinet/roll-call?lesson=${lesson.id}"]`)
    .click();
  await expect(page).toHaveURL(`/kabinet/roll-call?lesson=${lesson.id}`);
  await expect(page.getByLabel("Dars", { exact: true })).toHaveValue(
    String(lesson.id),
  );
  const row = page.locator(".roll-row").filter({ hasText: student.full_name });
  await expect(
    row.getByRole("button", { name: "Bor", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(row).toContainText("hali saqlanmagan");
  await page
    .getByRole("button", { name: "“Bor” tanlovlarini saqlash", exact: true })
    .click();
  await expect(row).toContainText("Qatnashgan");
  const familyContexts = [];
  try {
    for (const phone of ["+998900000004", "+998900000005"]) {
      const context = await browser.newContext({
        baseURL: "http://localhost:3001",
      });
      familyContexts.push(context);
      const familyPage = await context.newPage();
      await login(familyPage, phone);
      await familyPage.goto("/kabinet/attendance");
      await expect(familyPage.getByRole("table")).toBeVisible();
      await expect(
        familyPage
          .getByRole("row")
          .filter({ hasText: student.full_name })
          .filter({ hasText: dateTime(lesson.starts_at) }),
      ).toContainText("Qatnashgan");
    }
    await row
      .getByLabel(`${student.full_name}: tuzatish sababi`)
      .fill("E2E: kelmaganligi aniqlashtirildi");
    await row.getByRole("button", { name: "Yo‘q", exact: true }).click();
    await expect(row).toContainText("Qatnashmagan");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    for (const context of familyContexts) {
      const familyPage = context.pages()[0];
      await expect(
        familyPage
          .getByRole("row")
          .filter({ hasText: student.full_name })
          .filter({ hasText: dateTime(lesson.starts_at) })
          .filter({ hasText: "Qatnashmagan" })
          .first(),
      ).toBeVisible({ timeout: 30000 });
      const response = await familyPage.request.get(
        `/api/v1/attendance/?lesson=${lesson.id}`,
      );
      const data = await response.json();
      expect(
        data.results.find(
          (record: { student: number }) => record.student === student.id,
        ).status,
      ).toBe("ABSENT");
    }
    await row
      .getByLabel(`${student.full_name}: tuzatish sababi`)
      .fill("E2E: kechikib yetib keldi");
    await row.getByRole("button", { name: "Kech", exact: true }).click();
    await expect(row).toContainText("Kechikkan");
    const records = await (
      await page.request.get(
        `/api/v1/attendance/?lesson=${lesson.id}&student=${student.id}`,
      )
    ).json();
    expect(records.count).toBe(1);
  } finally {
    for (const context of familyContexts) await context.close();
  }
  expect(denied).toEqual([]);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("Marketing bosh sahifasi scroll animatsiyasi va reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".hero-copy")).toHaveAttribute(
    "data-motion",
    "shown",
  );
  const courses = page.locator(".marketing-home .course-card").first();
  await courses.scrollIntoViewIfNeeded();
  await expect(courses).toHaveAttribute("data-motion", "shown");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-motion="waiting"]')).toHaveCount(0);
  expect(
    await courses.evaluate((element) => getComputedStyle(element).opacity),
  ).toBe("1");
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
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
  await page.goto("/kurslar");
  await expect(page.locator(".marketing-home")).toHaveCount(0);
});
