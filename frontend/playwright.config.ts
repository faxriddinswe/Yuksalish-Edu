import { defineConfig } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
const envFile = new URL("../.env.local", import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    if (line && !line.startsWith("#") && line.includes("=")) {
      const index = line.indexOf("=");
      process.env[line.slice(0, index)] ??= line.slice(index + 1);
    }
  }
}
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "../docs/e2e-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    actionTimeout: 20000,
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        (process.env.CI ? undefined : "/usr/bin/google-chrome"),
      args: ["--no-sandbox"],
    },
  },
  webServer: [
    {
      command: "../scripts/e2e-backend runserver 127.0.0.1:8001 --noreload",
      url: "http://127.0.0.1:8001/api/v1/health/",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: "npm run dev -- --port 3001",
      url: "http://localhost:3001/kirish",
      env: {
        API_INTERNAL_URL: "http://127.0.0.1:8001",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3001",
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
