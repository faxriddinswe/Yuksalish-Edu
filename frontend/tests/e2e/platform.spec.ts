import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const password = process.env.DEMO_PASSWORD!;
const newPassword = "E2e-temporary-password-74!";
const stamp = String(Date.now()).slice(-6);
async function login(page: Page, phone: string, pass = password) {
  await page.goto("/kirish");
  await page.getByLabel("Telefon raqamingiz").fill(phone);
  await page.getByLabel("Parol", { exact: true }).fill(pass);
  await page
    .getByRole("button", { name: "Kabinetga kirish", exact: true })
    .click();
  await expect(page).toHaveURL(/\/kabinet/);
  await expect(page.getByRole("main")).toBeVisible();
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
  await expect(page).toHaveURL(/\/kirish/);
}
async function post(page: Page, path: string, body: unknown) {
  const session = await page.request.get("/api/v1/auth/session/");
  const token = (await session.json()).csrfToken;
  const response = await page.request.post(`/api/v1/${path}`, {
    data: body,
    headers: { "X-CSRFToken": token },
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
  return response.json();
}

test("Murojaatdan ota-ona kabinetigacha asosiy jarayon", async ({ page }) => {
  test.setTimeout(240000);
  expect(password, "DEMO_PASSWORD lokal muhitda berilishi kerak").toBeTruthy();
  const name = `E2E O‘quvchi ${stamp}`;
  const phone = `+998903${stamp}`;
  const parentPhone = `+998904${stamp}`;
  await page.goto("/kurslar");
  await page
    .getByRole("heading", { name: "Matematika", exact: true })
    .getByRole("link")
    .click();
  await page.getByLabel("Ismingiz", { exact: true }).fill(name);
  await page.getByLabel("Telefon raqamingiz").fill(phone);
  await page.getByLabel("Murojaatim bo‘yicha").check();
  await page.getByRole("button", { name: "Murojaat yuborish" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Murojaatingiz qabul qilindi",
  );
  await login(page, "+998900000002");
  await page.goto("/kabinet/leads");
  await page.getByLabel("Qidirish", { exact: true }).fill(name);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await logout(page);
  await login(page, "+998900000001");
  const leadList = await (
    await page.request.get(`/api/v1/leads/?search=${encodeURIComponent(name)}`)
  ).json();
  const conversion = await post(
    page,
    `leads/${leadList.results[0].id}/convert/`,
    {},
  );
  const studentId = conversion.student_id;
  const parent = await post(page, "parents/", {
    full_name: `E2E Ota-ona ${stamp}`,
    phone: parentPhone,
    roles: ["PARENT"],
    is_active: true,
  });
  await post(page, "parents/links/", {
    parent: parent.id,
    student: studentId,
    relationship: "Tasdiqlangan vasiy",
  });
  const account = await post(page, `students/${studentId}/account/`, { phone });
  const parentInvitation = await post(
    page,
    `parents/${parent.id}/invitation/`,
    { purpose: "ACTIVATE" },
  );
  const groups = await (
    await page.request.get("/api/v1/groups/?page_size=50&ordering=id")
  ).json();
  const first = groups.results[0];
  const second = groups.results.find(
    (g: { course: number }) => g.course !== first.course,
  );
  expect(second).toBeTruthy();
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
  }).format(new Date());
  await post(page, "enrollments/", {
    student: studentId,
    group: first.id,
    start_date: day,
  });
  await post(page, "enrollments/", {
    student: studentId,
    group: second.id,
    start_date: day,
  });
  await post(page, "billing/invoices/generate/", {
    month: day.slice(0, 7) + "-01",
  });
  const existingLessons = await (
    await page.request.get(
      `/api/v1/lessons/?group=${first.id}&from=${day}&to=${day}`,
    )
  ).json();
  const lesson =
    existingLessons.results.find((r: { starts_at: string }) =>
      r.starts_at.includes("T18:00:00"),
    ) ||
    (await post(page, "lessons/", {
      group: first.id,
      teacher: first.teacher,
      room: first.room,
      starts_at: `${day}T18:00:00+05:00`,
      ends_at: `${day}T19:00:00+05:00`,
      status: "SCHEDULED",
    }));
  await logout(page);
  await page.goto("/faollashtirish");
  await page.getByLabel("Telefon raqamingiz").fill(phone);
  await page.getByLabel("Administrator bergan kod").fill(account.code);
  await page.getByLabel("Yangi parol", { exact: true }).fill(newPassword);
  await page.getByLabel("Parolni takrorlang").fill(newPassword);
  await page
    .getByRole("button", { name: "Kabinetni faollashtirish", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Parol belgilandi");
  await login(page, "+998900000003");
  const studentPage = `/kabinet/students?search=${encodeURIComponent(name)}`;
  await page.goto(studentPage);
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Tafsilot", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Hisoblarini ko‘rish", exact: true })
    .click();
  await expect(page).toHaveURL(`/kabinet/invoices?student=${studentId}`);
  await expect(page.getByLabel("O‘quvchi", { exact: true })).toHaveValue(
    String(studentId),
  );
  for (let i = 0; i < 2; i++) {
    const row = page
      .getByRole("row")
      .filter({ hasText: "Belgilanishi kerak" })
      .first();
    await row.getByRole("button", { name: "Tafsilot" }).click();
    await page
      .getByRole("button", { name: "Birinchi hisobni belgilash" })
      .click();
    await page.getByLabel("Kelishilgan summa").fill("300000");
    await page.getByLabel("To‘lov muddati").fill(day);
    await page.getByLabel(/^Sabab/).fill("E2E kelishuv");
    await page.getByRole("button", { name: "Tasdiqlash", exact: true }).click();
    await expect(
      page.getByText("Amal bajarildi.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Yopish", exact: true }).click();
  }
  await page.goto(studentPage);
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Tafsilot", exact: true })
    .click();
  await page
    .getByRole("link", { name: "To‘lov kiritish", exact: true })
    .click();
  await expect(page).toHaveURL(`/kabinet/record-payment?student=${studentId}`);
  await expect(page.locator(".selected-student")).toContainText(name);
  await page.getByLabel("Hisoblar bo‘yicha", { exact: true }).check();
  await page.locator(".allocation-row input").first().fill("100000");
  await page.getByRole("button", { name: "To‘lovni tekshirish" }).click();
  await expect(page.getByRole("dialog")).toContainText(name);
  await expect(page.getByRole("dialog")).toContainText("100 000");
  await page.getByRole("button", { name: "Oynani yopish" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Tasdiqlash va saqlash" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Oynani yopish" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "To‘lovni tekshirish" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "To‘lovni tekshirish" }).click();
  await page.getByRole("button", { name: "Tasdiqlash va saqlash" }).click();
  await expect(page.getByRole("status")).toContainText("to‘lov saqlandi");
  const invoices = await (
    await page.request.get(`/api/v1/billing/invoices/?student=${studentId}`)
  ).json();
  expect(
    invoices.results.reduce(
      (s: number, r: { balance: string }) => s + Number(r.balance),
      0,
    ),
  ).toBe(500000);
  await logout(page);
  await login(page, phone, newPassword);
  await page.goto("/kabinet/invoices");
  await expect(page).toHaveURL(/\/kabinet\/payments$/);
  await expect(
    page.getByRole("heading", { name: "To‘lovlar tarixi", exact: true }),
  ).toBeVisible();
  const balance = page.getByRole("region", {
    name: "To‘lov va qarzdorlik holati",
  });
  await expect(balance).toContainText("500 000 so‘m");
  await expect(balance).toContainText("Muddati o‘tgan qarz");
  const receipt = page.locator(".student-payment-card").first();
  await expect(receipt).toContainText("100 000 so‘m");
  await expect(receipt.locator("time")).toHaveAttribute("datetime", day);
  await expect(receipt.locator(".payment-allocation-list")).toContainText(
    invoices.results[0].subject_name,
  );
  const paymentSubject = (
    await (await page.request.get("/api/v1/billing/payments/")).json()
  ).results[0].allocations[0].subject;
  await page
    .getByLabel("Kurs / fan", { exact: true })
    .selectOption(String(paymentSubject));
  await expect(balance).toContainText("200 000 so‘m");
  await page.getByLabel("To‘lov sanasigacha").fill("2020-01-01");
  await expect(
    page.getByText(/Bu tanlov bo‘yicha to‘lovlar topilmadi/),
  ).toBeVisible();
  await expect(balance).toContainText("200 000 so‘m");
  await page.getByRole("button", { name: "Filtrlarni tozalash" }).click();
  await expect(receipt).toBeVisible();
  await expect(balance).toContainText("500 000 so‘m");
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(receipt).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px student overflow`,
    ).toBe(true);
    if (width < 1024) {
      await expect(
        page
          .getByRole("navigation", { name: "Asosiy kabinet navigatsiyasi" })
          .getByRole("link", { name: "To‘lovlar", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Kabinet menyusini ochish" })
        .click();
    }
    const menu = page
      .getByRole("navigation", { name: "Kabinet bo‘limlari" })
      .filter({ visible: true });
    await expect(
      menu.getByRole("link", { name: "To‘lovlar tarixi", exact: true }),
    ).toBeVisible();
    await expect(menu.getByText("Oylik hisoblar", { exact: true })).toHaveCount(
      0,
    );
    await expect(menu.getByText("O‘quvchilar", { exact: true })).toHaveCount(0);
    await expect(
      menu.getByText("Markaz boshqaruvi", { exact: true }),
    ).toHaveCount(0);
    if (width < 1024)
      await page.getByRole("button", { name: "Menyuni yopish" }).click();
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto("/kabinet");
  await expect(
    page
      .getByRole("link", { name: "To‘lovlar tarixi", exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Barcha hisoblar" }),
  ).toHaveCount(0);
  await page.goto("/kabinet/students");
  await expect(
    page.getByRole("heading", { name: "Kirishga ruxsat yo‘q" }),
  ).toBeVisible();
  const forbidden = await page.request.get("/api/v1/students/1/");
  expect(forbidden.status()).toBe(404);
  await logout(page);
  await login(page, "+998901000000");
  await page.goto(`/kabinet/roll-call?lesson=${lesson.id}`);
  const attendanceRow = page.locator(".roll-row").filter({ hasText: name });
  await attendanceRow.getByRole("button", { name: "Bor", exact: true }).click();
  await expect(attendanceRow).toContainText("Qatnashgan");
  await logout(page);
  await page.goto("/faollashtirish");
  await page.getByLabel("Telefon raqamingiz").fill(parentPhone);
  await page.getByLabel("Administrator bergan kod").fill(parentInvitation.code);
  await page.getByLabel("Yangi parol", { exact: true }).fill(newPassword);
  await page.getByLabel("Parolni takrorlang").fill(newPassword);
  await page
    .getByRole("button", { name: "Kabinetni faollashtirish", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Parol belgilandi");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, parentPhone, newPassword);
  await expect(page.getByLabel("Farzandni tanlang")).toContainText(name);
  await page.goto("/kabinet/attendance");
  await expect(page.getByRole("table")).toContainText("Qatnashgan");
  expect((await page.request.get("/api/v1/students/1/")).status()).toBe(404);
  const privatePage = await page.goto("/kabinet/invoices");
  await expect(page.getByRole("table")).toContainText("200 000");
  expect(privatePage?.headers()["cache-control"]).toContain("no-store");
  const cachedPaths = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const requests = await Promise.all(
      (await caches.keys()).map(async (key) => (await caches.open(key)).keys()),
    );
    return requests.flat().map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths.length).toBeGreaterThan(0);
  expect(
    cachedPaths.filter((path) =>
      /^\/(api|kabinet|kirish|faollashtirish|parolni-tiklash)(\/|$)/.test(path),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Public sayt accessibility, klaviatura va responsive", async ({
  page,
}) => {
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${width}px overflow`,
    ).toBe(true);
  }
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.goto("/kirish");
  await expect(page.getByLabel("Telefon raqamingiz")).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Asosiy mazmunga o‘tish" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByLabel("Telefon raqamingiz").focus();
  await page.keyboard.type("+998900000004");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Parol", { exact: true })).toBeFocused();
  const loginAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(loginAxe.violations).toEqual([]);
});
