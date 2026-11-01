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
const roles = [
  [
    "OWNER_ADMIN",
    "+998900000001",
    "Rahbar kabineti",
    "Markazning umumiy holati",
    "staff",
    ["overview/", "reports/financial/", "staff/"],
  ],
  [
    "ADMINISTRATOR",
    "+998900000002",
    "Administrator kabineti",
    "Qabul va ta’lim boshqaruvi",
    "staff",
    ["overview/", "staff/"],
    ["reports/financial/", "audit/", "billing/teacher-payments/"],
  ],
  [
    "ACCOUNTANT",
    "+998900000003",
    "Buxgalter kabineti",
    "Moliyaviy holat",
    "teachers",
    ["reports/financial/", "staff/teacher-finance/"],
    [
      "staff/",
      "overview/",
      "attendance/",
      "lessons/",
      "enrollments/",
      "courses/",
      "rooms/",
    ],
  ],
  [
    "TEACHER",
    "+998901000000",
    "O‘qituvchi kabineti",
    null,
    "students",
    ["students/", "content/achievements/"],
    [
      "staff/",
      "overview/",
      "reports/financial/",
      "billing/payments/",
      "billing/invoices/",
    ],
  ],
  [
    "STUDENT",
    "+998900000004",
    "O‘quvchi kabineti",
    null,
    "payments",
    ["students/", "groups/", "billing/payments/summary/"],
    ["staff/", "overview/", "reports/financial/", "content/achievements/"],
  ],
  [
    "PARENT",
    "+998900000005",
    "Ota-ona kabineti",
    null,
    "groups",
    ["students/", "parents/links/", "groups/"],
    ["staff/", "overview/", "reports/financial/", "content/achievements/"],
  ],
];
const errors = [],
  failures = [],
  writes = [],
  checks = [];
mkdirSync(`${root}.local/screenshots`, { recursive: true });
try {
  for (const [
    role,
    phone,
    title,
    heading,
    section,
    allowed,
    denied = [],
  ] of roles) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/api/v1/") && response.status() >= 400)
        failures.push({
          role,
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
    });
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (
        !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
        !path.startsWith("/api/v1/auth/")
      ) {
        writes.push(path);
        await route.abort();
      } else await route.continue();
    });
    await page.goto(`${base}/kirish`);
    await page.getByLabel("Telefon raqamingiz").fill(phone);
    await page.getByLabel("Parol", { exact: true }).fill(env.DEMO_PASSWORD);
    await page
      .getByRole("button", { name: "Kabinetga kirish", exact: true })
      .click();
    await expect(page).toHaveURL(`${base}/kabinet`);
    const me = await (await page.request.get(`${base}/api/v1/me/`)).json();
    expect(me.roles).toEqual([role]);
    await expect(page.locator(".account-chip strong")).toHaveText(me.full_name);
    await expect(page.locator(".header-greeting")).toContainText(title);
    if (heading)
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${root}.local/screenshots/role-audit-${role}-desktop.png`,
    });
    for (const path of allowed)
      expect(
        (await page.request.get(`${base}/api/v1/${path}`)).status(),
        `${role}:${path}`,
      ).toBe(200);
    for (const path of denied)
      expect(
        (await page.request.get(`${base}/api/v1/${path}`)).status(),
        `${role}:${path}`,
      ).toBe(403);
    const students = await (
      await page.request.get(`${base}/api/v1/students/?page_size=100`)
    ).json();
    if (role === "STUDENT")
      expect(students.results.every((row) => row.user === me.id)).toBe(true);
    if (role === "PARENT") {
      const links = await (
        await page.request.get(`${base}/api/v1/parents/links/?page_size=100`)
      ).json();
      expect(
        students.results.every((row) =>
          links.results.some((link) => link.student === row.id),
        ),
      ).toBe(true);
    }
    if (role === "OWNER_ADMIN") {
      const staff = await (
        await page.request.get(`${base}/api/v1/staff/?page_size=100`)
      ).json();
      expect(staff.count).toBe(14);
      expect(
        staff.results.some((row) => row.full_name.startsWith("Demo Yuklama")),
      ).toBe(false);
      expect(students.count).toBe(102);
    }
    await page.goto(`${base}/kabinet/${section}`);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${role}:${width}`,
      ).toBe(true);
    }
    await page.screenshot({
      path: `${root}.local/screenshots/role-audit-${role}-mobile.png`,
    });
    checks.push({
      role,
      matching_identity: true,
      allowed_apis: allowed.length,
      denied_apis: denied.length,
      students_visible: students.count,
      responsive: true,
    });
    await context.close();
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  expect(writes).toEqual([]);
  const result = {
    passed: true,
    checked_at: new Date().toISOString(),
    base_url: base,
    roles: checks,
    javascript_errors: errors,
    unexpected_api_failures: failures,
    business_writes: writes.length,
  };
  writeFileSync(
    `${root}docs/role-audit-smoke-result.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
