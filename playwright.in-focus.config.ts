import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["in-focus.spec.ts", "in-focus-public.spec.ts"],
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  use: { baseURL: "http://127.0.0.1:3510", browserName: "chromium", channel: "msedge", headless: true, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npx tsx scripts/in-focus-review.ts", url: "http://127.0.0.1:3510/admin/login", timeout: 120000, reuseExistingServer: !process.env.CI },
  reporter: [["list"]],
});
