import { expect, test } from "@playwright/test";
import fs from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";
import { emptyFocusState } from "../../src/lib/in-focus";

const articlePath = "/in-focus/ukraine-air-defence-and-the-duty-to-help";
const experimentId = "f98a9aa1-e3af-4a81-af01-de83cba686f1";

test.beforeEach(async ({ baseURL }) => {
  test.skip(baseURL !== "http://127.0.0.1:3510", "Requires the isolated In Focus review server");
});

test("homepage opens the public edition, with context, citations and reader navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#world")).not.toContainText("Sample");
  await expect(page.locator("#world")).toContainText("Russia–Ukraine war");
  await page.locator("#world").screenshot({ path: ".local-review/in-focus-home-card.png" });
  await page.getByRole("link", { name: "Explore the question" }).click();
  await expect(page).toHaveURL(articlePath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("When does caution become a failure to help?");
  await expect(page.locator(".in-focus-disclosure")).toContainText("AI interpretations");
  await expect(page.locator(".in-focus-contribution")).toHaveCount(3);
  await expect(page.locator("#focus-sources li")).toHaveCount(9);
  await page.screenshot({ path: ".local-review/in-focus-public-desktop.png", fullPage: true });
  await page.locator(".in-focus-background summary").click();
  await expect(page.getByRole("heading", { name: "A longer conflict" })).toBeVisible();
  await page.locator(".in-focus-citation a").first().click();
  await expect(page).toHaveURL(/#focus-source-S3$/);
  await expect(page.locator("#focus-source-S3")).toBeInViewport();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(articlePath + "$") );
  const sitemap = await page.request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain(articlePath);
  const missing = await page.request.get("/in-focus/a-private-draft");
  expect(missing.status()).toBe(404);
  expect(errors).toEqual([]);
});

test("public edition reflows on mobile and at 200 percent text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#world").screenshot({ path: ".local-review/in-focus-home-mobile.png" });
  await page.getByRole("link", { name: "Explore the question" }).click();
  await expect(page.locator(".in-focus-article")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".local-review/in-focus-public-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".local-review/in-focus-public-large-text.png", fullPage: true });
});

test("admin previews the exact published copy and private edits cannot alter it", async ({ page }) => {
  const active = JSON.parse(fs.readFileSync(".local-review/in-focus-active.json", "utf8"));
  const databasePath = path.resolve(active.databasePath);
  expect(databasePath.startsWith(path.resolve(".local-review") + path.sep)).toBe(true);
  const db = new Database(databasePath);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO in_focus_experiments (id, title, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .run(experimentId, "Private workshop", JSON.stringify(emptyFocusState("Private workshop")), now, now);
  db.close();
  await page.goto(articlePath);
  const publicText = await page.locator(".in-focus-article").textContent();
  await page.request.post("/api/admin/auth", { data: { password: "local-in-focus-review" } });
  const savedExperiment = await page.request.get("/api/admin/in-focus/" + experimentId);
  expect(savedExperiment.ok()).toBe(true);
  const before = await savedExperiment.json();
  await page.goto("/admin/in-focus/" + experimentId);
  await page.getByRole("button", { name: "Reading preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Published edition", exact: true })).toBeVisible();
  expect(await page.locator(".in-focus-article").textContent()).toBe(publicText);
  await page.screenshot({ path: ".local-review/in-focus-admin-public.png", fullPage: true });
  await page.getByRole("button", { name: "Preview working selection", exact: true }).click();
  await expect(page.getByText("Private working selection", { exact: false })).toBeVisible();
  const saved = await page.request.put("/api/admin/in-focus/" + experimentId, { data: { state: { ...before.experiment.state, question: "PRIVATE TEST REVISION" }, expected_revision: before.experiment.revision } });
  expect(saved.ok()).toBe(true);
  try {
    await page.goto(articlePath);
    expect(await page.locator(".in-focus-article").textContent()).toBe(publicText);
    await expect(page.locator("main")).not.toContainText("PRIVATE TEST REVISION");
  } finally {
    const current = await (await page.request.get("/api/admin/in-focus/" + experimentId)).json();
    await page.request.put("/api/admin/in-focus/" + experimentId, { data: { state: before.experiment.state, expected_revision: current.experiment.revision } });
  }
});
