import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const env = Object.fromEntries(
  readFileSync(`${root}.env.local`, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")),
      line.slice(line.indexOf("=") + 1),
    ]),
);
const base = "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
mkdirSync(`${root}.local/screenshots`, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [],
    failed = [],
    writes = [],
    checks = [];
  let foreignCertificate;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400)
      failed.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
  });
  await page.route("**/api/v1/**", async (route) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(route.request().method()) &&
      !new URL(route.request().url()).pathname.startsWith("/api/v1/auth/")
    ) {
      writes.push(new URL(route.request().url()).pathname);
      await route.abort();
    } else await route.continue();
  });
  async function get(path, status = 200) {
    const response = await page.request.get(`${base}/api/v1/${path}`);
    expect(response.status(), path).toBe(status);
    return status === 200 ? response.json() : null;
  }
  for (const [role, phone] of [
    ["administrator", "+998900000002"],
    ["owner", "+998900000001"],
    ["teacher", "+998901000000"],
  ]) {
    await page.goto(`${base}/kirish`);
    await page.getByLabel("Telefon raqamingiz").fill(phone);
    await page.getByLabel("Parol", { exact: true }).fill(env.DEMO_PASSWORD);
    await page
      .getByRole("button", { name: "Kabinetga kirish", exact: true })
      .click();
    await expect(page).toHaveURL(`${base}/kabinet`);
    await expect(
      page.locator('.sidebar a[href="/kabinet/achievements"]'),
    ).toBeVisible();
    const certificates = await get("content/achievements/?page_size=50");
    const subjects = await get("content/achievements/subjects/?page_size=50");
    if (role === "administrator")
      foreignCertificate = certificates.results.find(
        (item) => item.is_sample && !item.teacher,
      )?.id;
    if (role === "teacher") {
      const teacher = (await get("staff/teachers/")).results[0];
      expect(teacher).toBeTruthy();
      expect(
        certificates.results.every((item) => item.teacher === teacher.id),
      ).toBe(true);
      expect(
        subjects.results.every((item) => teacher.subjects.includes(item.id)),
      ).toBe(true);
      if (foreignCertificate)
        await get(`content/achievements/${foreignCertificate}/`, 404);
      await get("content/settings/", 403);
      await get("subjects/", 403);
    }
    await page.goto(`${base}/kabinet/achievements`);
    await page
      .getByRole("button", { name: "Yangi yozuv", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByLabel("Sertifikat olgan o‘quvchi", { exact: true }),
    ).toHaveJSProperty("required", true);
    await expect(
      dialog.getByLabel("Shaxsiy ma’lumotlari tozalangan rasm"),
    ).toBeAttached();
    await expect(
      dialog.getByLabel("Ball / daraja", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("Natijaga tayyorlagan ustoz", { exact: true }),
    ).toHaveCount(role === "teacher" ? 0 : 1);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: `${root}.local/screenshots/certificate-workspace-${role}-form-mobile.png`,
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/kabinet/students?has_certificate=true`);
    await expect(
      page.getByLabel("Sertifikat holati", { exact: true }),
    ).toHaveValue("true");
    await expect(
      page.getByLabel("Sertifikat fani", { exact: true }),
    ).toBeVisible();
    const students = await get("students/?has_certificate=true");
    expect(
      students.results.every(
        (item) =>
          item.certificate_count > 0 &&
          item.certificates.length === item.certificate_count,
      ),
    ).toBe(true);
    if (role === "teacher")
      await expect(
        page.getByRole("button", { name: "Yangi yozuv", exact: true }),
      ).toHaveCount(0);
    checks.push({
      role,
      certificate_access: true,
      student_filter: true,
      visible_certificates: certificates.count,
      students_with_certificates: students.count,
    });
    await page.getByRole("button", { name: "Tizimdan chiqish" }).click();
    await page.waitForURL(`${base}/kirish`);
  }
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(writes).toEqual([]);
  writeFileSync(
    `${root}docs/certificate-workspace-smoke-result.json`,
    JSON.stringify(
      {
        passed: true,
        checked_at: new Date().toISOString(),
        base_url: base,
        checks,
        viewport_widths: [1440, 768, 390, 320],
        javascript_errors: errors,
        unexpected_api_failures: failed,
        business_writes: writes.length,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    "Certificate workspace smoke passed for administrator, owner and teacher; business writes: 0.\n",
  );
} finally {
  await browser.close();
}
