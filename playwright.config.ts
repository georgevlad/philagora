import { defineConfig } from "@playwright/test";
import fs from "node:fs";
const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: review.baseURL,
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
