import { test, expect, type Page } from "@playwright/test";

const roles = [
  {
    role: "OWNER_ADMIN",
    phone: "+998900000001",
    title: "Rahbar kabineti",
    home: "Markazning umumiy holati",
    forbidden: [],
  },
  {
    role: "ADMINISTRATOR",
    phone: "+998900000002",
    title: "Administrator kabineti",
    home: "Qabul va ta’lim boshqaruvi",
    forbidden: [
      "reports",
      "audit",
      "exports",
      "record-payment",
      "teacher-finance",
      "opening-balance",
      "adjustments",
    ],
  },
  {
    role: "ACCOUNTANT",
    phone: "+998900000003",
    title: "Buxgalter kabineti",
    home: "Moliyaviy holat",
    forbidden: [
      "staff",
      "settings",
      "leads",
      "groups",
      "lessons",
      "attendance",
      "achievements",
    ],
  },
  {
    role: "TEACHER",
    phone: "+998901000000",
    title: "O‘qituvchi kabineti",
    forbidden: [
      "staff",
      "settings",
      "reports",
      "audit",
      "exports",
      "invoices",
      "payments",
      "record-payment",
    ],
  },
  {
    role: "STUDENT",
    phone: "+998900000004",
    title: "O‘quvchi kabineti",
    forbidden: [
      "staff",
      "settings",
      "reports",
      "audit",
      "exports",
      "students",
      "achievements",
      "record-payment",
    ],
  },
  {
    role: "PARENT",
    phone: "+998900000005",
    title: "Ota-ona kabineti",
    forbidden: [
      "staff",
      "settings",
      "reports",
      "audit",
      "exports",
      "parent-links",
      "enrollments",
      "achievements",
      "record-payment",
    ],
  },
];
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
  await expect(page.locator(".account-chip strong")).toBeVisible();
}
for (const actor of roles) {
  test(`${actor.role}: barcha menyular, to‘g‘ridan-to‘g‘ri kirish va mobil kabinet`, async ({
    page,
  }) => {
    test.setTimeout(300000);
    const errors: string[] = [];
    const failed: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().includes("/api/v1/") && r.status() >= 400)
        failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await login(page, actor.phone);
    const me = await (await page.request.get("/api/v1/me/")).json();
    expect(me.roles).toContain(actor.role);
    await expect(page.locator(".account-chip strong")).toHaveText(me.full_name);
    await expect(page.locator(".header-greeting")).toContainText(actor.title);
    if (actor.home)
      await expect(
        page.getByRole("heading", { name: actor.home, exact: true }),
      ).toBeVisible();
    const hrefs = await page
      .locator(".sidebar nav a")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
    for (const key of actor.forbidden)
      expect(hrefs).not.toContain(`/kabinet/${key}`);
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.locator(".account-chip strong"), href).toHaveText(
        me.full_name,
      );
      await expect(
        page.getByRole("main").getByRole("heading", { level: 1 }),
      ).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("main").getByRole("alert"), href).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("heading", { name: "Kirishga ruxsat yo‘q" }),
      ).toHaveCount(0);
    }
    for (const key of actor.forbidden) {
      await page.goto(`/kabinet/${key}`);
      await expect(
        page.getByRole("heading", { name: "Kirishga ruxsat yo‘q" }),
        key,
      ).toBeVisible();
    }
    await page.goto("/kabinet");
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(page.locator(".account-chip strong")).toHaveText(me.full_name);
    await page
      .getByRole("button", { name: "Kabinet menyusini ochish" })
      .click();
    for (const key of actor.forbidden)
      await expect(
        page.locator(`.mobile-drawer a[href="/kabinet/${key}"]`),
      ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
}

test("Bir brauzerning boshqa tabida rol almashsa eski rahbar yoki administrator ma’lumoti qolmaydi", async ({
  context,
}) => {
  test.setTimeout(180000);
  const oldTab = await context.newPage();
  const otherTab = await context.newPage();
  await login(oldTab, roles[0].phone);
  await oldTab.goto("/kabinet/staff");
  await expect(oldTab.getByRole("heading", { level: 1 })).toBeVisible();
  await login(otherTab, roles[4].phone);
  const student = await (await otherTab.request.get("/api/v1/me/")).json();
  await oldTab.bringToFront();
  await expect(oldTab.locator(".account-chip strong")).toHaveText(
    student.full_name,
  );
  await expect(oldTab.locator(".header-greeting")).toContainText(
    roles[4].title,
  );
  await expect(oldTab.locator('.sidebar a[href="/kabinet/staff"]')).toHaveCount(
    0,
  );
  expect((await oldTab.request.get("/api/v1/staff/")).status()).toBe(403);
  await login(otherTab, roles[1].phone);
  const admin = await (await otherTab.request.get("/api/v1/me/")).json();
  await oldTab.bringToFront();
  await expect(oldTab.locator(".account-chip strong")).toHaveText(
    admin.full_name,
  );
  await expect(oldTab.locator(".header-greeting")).toContainText(
    roles[1].title,
  );
  await expect(
    oldTab.getByRole("heading", { name: roles[1].home!, exact: true }),
  ).toBeVisible();
  await otherTab.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await expect(otherTab).toHaveURL(/\/kirish$/);
  await oldTab.bringToFront();
  await expect(oldTab).toHaveURL(/\/kirish$/);
  await expect(oldTab.locator(".account-chip")).toHaveCount(0);
});

test("Ochiq sayt anonim tashrifchiga ichki rollar yoki boshqaruv ma’lumotlarini ko‘rsatmaydi", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/kurslar",
    "/ustozlar",
    "/natijalar",
    "/markaz-haqida",
    "/boglanish",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(
      page.locator(".account-chip, .sidebar, .dashboard-header"),
    ).toHaveCount(0);
  }
  for (const path of [
    "me/",
    "overview/",
    "students/",
    "staff/",
    "reports/financial/",
    "audit/",
  ])
    expect((await page.request.get(`/api/v1/${path}`)).status(), path).toBe(
      403,
    );
  await page.goto("/kabinet");
  await expect(page).toHaveURL(/\/kirish$/);
});
