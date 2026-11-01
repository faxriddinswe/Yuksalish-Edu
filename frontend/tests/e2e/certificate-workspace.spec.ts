import { test, expect, type Page } from "@playwright/test";
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
  await page.waitForURL("**/kirish");
}

for (const actor of [
  { role: "O‘qituvchi", phone: "+998901000000", teacher: true },
  { role: "Administrator", phone: "+998900000002", teacher: false },
]) {
  test(`${actor.role}: sertifikat CRUD, rasm, o‘quvchi filtri va rahbar ko‘rinishi`, async ({
    page,
  }, info) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page, actor.phone);
    await expect(
      page.locator('.sidebar a[href="/kabinet/achievements"]'),
    ).toBeVisible();
    const courses = (
      await (
        await page.request.get("/api/v1/public/courses/?page_size=50")
      ).json()
    ).results;
    const groups = (
      await (await page.request.get("/api/v1/groups/?page_size=50")).json()
    ).results;
    let selected:
      | {
          student: number;
          student_name: string;
          teacher: number;
          subject: number;
          subject_name: string;
        }
      | undefined;
    for (const group of groups) {
      const course = courses.find(
        (item: { id: number }) => item.id === group.course,
      );
      if (!course) continue;
      const members = (
        await (
          await page.request.get(`/api/v1/groups/${group.id}/members/`)
        ).json()
      ).results;
      if (members?.length) {
        selected = {
          student: members[0].student,
          student_name: members[0].student_name,
          teacher: group.teacher,
          subject: course.subject,
          subject_name: course.subject_name,
        };
        break;
      }
    }
    expect(selected).toBeTruthy();
    const target = selected!;
    const title = `Certificate-${actor.teacher ? "teacher" : "admin"}-${Date.now()}`;
    await page.goto(`/kabinet/achievements?student=${target.student}`);
    await page
      .getByRole("button", { name: "Yangi yozuv", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Sertifikat olgan o‘quvchi qidirish", { exact: true })
      .fill(target.student_name);
    const student = dialog.getByLabel("Sertifikat olgan o‘quvchi", {
      exact: true,
    });
    await expect(
      student.getByRole("option", { name: target.student_name, exact: false }),
    ).toHaveCount(1);
    await student.selectOption(String(target.student));
    await expect(
      dialog.getByLabel("E’lon qilishga ruxsat etilgan ism", { exact: false }),
    ).toHaveValue(target.student_name);
    await dialog.getByLabel("Yutuq sarlavhasi", { exact: false }).fill(title);
    await dialog
      .getByLabel("Tavsif", { exact: false })
      .fill("Faqat E2E bazasida. Haqiqiy o‘quvchi natijasi emas.");
    await dialog
      .getByLabel("Ball / daraja", { exact: true })
      .fill("57 ball · B2");
    await dialog
      .getByLabel("Fan", { exact: true })
      .selectOption(String(target.subject));
    if (actor.teacher) {
      await expect(
        dialog.getByLabel("Natijaga tayyorlagan ustoz", { exact: true }),
      ).toHaveCount(0);
    } else {
      await dialog
        .getByLabel("Natijaga tayyorlagan ustoz", { exact: true })
        .selectOption(String(target.teacher));
    }
    await dialog
      .getByLabel("Shaxsiy ma’lumotlari tozalangan rasm")
      .setInputFiles("tests/fixtures/content-test.png");
    await dialog
      .getByLabel("Rozilik qaydi", { exact: false })
      .fill("Sun’iy E2E ma’lumoti, haqiqiy odamga tegishli emas.");
    await dialog
      .getByLabel("Sertifikatdagi ortiqcha", { exact: false })
      .check();
    await dialog
      .getByLabel("Nashr holati", { exact: false })
      .selectOption("DRAFT");
    await dialog.getByRole("button", { name: "Saqlash", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByLabel("Qidirish", { exact: true }).fill(title);
    let row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("57 ball · B2");
    await expect
      .poll(() =>
        row
          .locator("img.record-thumbnail")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const record = (
      await (
        await page.request.get(`/api/v1/content/achievements/?search=${title}`)
      ).json()
    ).results[0];
    expect(record.student).toBe(target.student);
    expect(record.teacher).toBe(target.teacher);
    expect((await page.request.get(record.image)).status()).toBe(404);
    await row.getByRole("button", { name: /Tafsilot/ }).click();
    await page.getByRole("button", { name: "Tahrirlash", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Ball / daraja", { exact: true })
      .fill("91 ball · A+");
    await expect(
      dialog.getByRole("button", { name: "Rasmni almashtirish" }),
    ).toBeVisible();
    await dialog
      .getByLabel("Shaxsiy ma’lumotlari tozalangan rasm")
      .setInputFiles("tests/fixtures/content-test.png");
    await dialog
      .getByLabel("Nashr holati", { exact: false })
      .selectOption("PUBLISHED");
    await dialog.getByRole("button", { name: "Saqlash", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const updated = await (
      await page.request.get(`/api/v1/content/achievements/${record.id}/`)
    ).json();
    expect(updated.image).not.toBe(record.image);
    const published = (
      await (
        await page.request.get(`/api/v1/public/achievements/?search=${title}`)
      ).json()
    ).results;
    expect(published).toHaveLength(1);
    expect(published[0].score).toBe("91 ball · A+");
    await page.goto("/kabinet/students");
    await page
      .getByLabel("Sertifikat holati", { exact: true })
      .selectOption("true");
    await page
      .getByLabel("Sertifikat fani", { exact: true })
      .selectOption(String(target.subject));
    await page
      .getByLabel("Qidirish", { exact: true })
      .fill(target.student_name);
    row = page.getByRole("row").filter({ hasText: target.student_name });
    await expect(row).toContainText(title);
    await expect(row).toContainText(target.subject_name);
    await expect(row).toContainText("91 ball · A+");
    if (actor.teacher)
      await expect(
        page.getByRole("button", { name: "Yangi yozuv", exact: true }),
      ).toHaveCount(0);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}px`,
      ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath("student-certificates-mobile.png"),
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await logout(page);
    await login(page, "+998900000001");
    await page.goto(
      `/kabinet/students?has_certificate=true&certificate_subject=${target.subject}`,
    );
    await page
      .getByLabel("Qidirish", { exact: true })
      .fill(target.student_name);
    await expect(
      page.getByRole("row").filter({ hasText: target.student_name }),
    ).toContainText(title);
    await logout(page);
    await login(page, actor.phone);
    await page.goto(`/kabinet/achievements?student=${target.student}`);
    await page.getByLabel("Qidirish", { exact: true }).fill(title);
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: /Tafsilot/ })
      .click();
    await page
      .getByRole("button", { name: "Yozuvni o‘chirish", exact: true })
      .click();
    await page
      .getByRole("button", { name: "O‘chirishni tasdiqlash", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (
        await page.request.get(`/api/v1/content/achievements/${record.id}/`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await (
          await page.request.get(`/api/v1/public/achievements/?search=${title}`)
        ).json()
      ).count,
    ).toBe(0);
    expect(errors).toEqual([]);
  });
}
