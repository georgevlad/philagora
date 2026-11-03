import { test, expect } from "@playwright/test";
import type { AgoraThreadDetail, AgoraRecovery } from "../../src/lib/types";

test("matching stays visibly active, respects reduced motion, and hands off to the selected group", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/agora/suggest", async (route) => {
    await held;
    await route.fulfill({ json: { suggestions: [
      { id: "seneca", reason: "Explores what is enough for a good life." },
      { id: "camus", reason: "Finds meaning in the everyday." },
    ] } });
  });
  await page.goto("/");
  await page.getByLabel("Your question for the philosophers").fill("Is it okay to want a small life?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  const loading = page.locator(".agora-matching");
  await expect(loading).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask the philosophers" })).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(loading.locator(".agora-skeleton").first()).toHaveCSS("animation-name", "agora-shimmer");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".agora-group-review").screenshot({ path: `.local-review/matching-wait-${width}.png` });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(loading.locator(".agora-skeleton").first()).toHaveCSS("animation-name", "none");
  await expect(loading.locator(".agora-activity-dots i").first()).toHaveCSS("animation-name", "none");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(loading.getByRole("status")).toContainText("Still finding the right mix", { timeout: 15000 });
  release();
  await expect(page.getByRole("heading", { name: "Meet your philosophers" })).toBeFocused();
  await expect(loading).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ask the philosophers" })).toBeEnabled();
});

test("submission remains locked while navigation is pending", async ({ page }) => {
  await page.route("**/api/agora/suggest", (route) => route.fulfill({ json: { suggestions: [
    { id: "seneca", reason: "A life with room to think." },
    { id: "camus", reason: "A different perspective." },
  ] } }));
  let releaseSubmit!: () => void;
  const heldSubmit = new Promise<void>((resolve) => { releaseSubmit = resolve; });
  let releaseNavigation!: () => void;
  const heldNavigation = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  let submissions = 0;
  await page.route("**/api/agora/submit", async (route) => {
    submissions++;
    await heldSubmit;
    await route.fulfill({ json: { threadId: "review-slow" } });
  });
  await page.route("**/agora/review-slow?*", async (route) => {
    await heldNavigation;
    await route.continue();
  });
  await page.goto("/");
  await page.getByLabel("Your question for the philosophers").fill("How can I make more room to think?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await page.getByRole("button", { name: "Ask the philosophers" }).click();
  await expect(page.getByRole("button", { name: "Confirming your question" })).toBeDisabled();
  releaseSubmit();
  await expect(page.getByRole("button", { name: "Opening your conversation" })).toBeDisabled();
  await expect(page.getByLabel("Your question for the philosophers")).toBeDisabled();
  expect(submissions).toBe(1);
  releaseNavigation();
  await expect(page).toHaveURL(/\/agora\/review-slow$/);
});

test("waiting progress follows saved answers, retries and connection loss without losing content", async ({ page, request }) => {
  const saved = (await (await request.get("/api/agora/review-public")).json()).detail as AgoraThreadDetail;
  const initial = (await (await request.get("/api/agora/review-slow")).json()).detail as AgoraThreadDetail;
  let count = 0;
  let state: AgoraRecovery["state"] = "queued";
  let offline = false;
  await page.route("**/api/agora/review-slow", (route) => offline ? route.abort() : route.fulfill({ json: {
    detail: { ...initial, status: state === "complete" ? "complete" : "in_progress",
      responses: saved.responses.slice(0, count),
      synthesis: state === "complete" ? saved.synthesis : null,
      recovery: { state, canRecover: false } },
    canFollowUp: false,
  } }));
  await page.goto("/agora/review-slow");
  const progress = page.getByRole("list", { name: "Conversation progress" });
  const check = () => page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gathering your philosophers" })).toBeVisible();
  await expect(progress.locator('[data-state="active"]')).toHaveCount(0);
  state = "running";
  await check();
  await expect(progress.locator('[data-state="active"]')).toHaveCount(1);
  await expect(progress.locator('[data-state="complete"]')).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("region", { name: "Conversation recovery" }).screenshot({ path: `.local-review/response-wait-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  count = 1;
  await check();
  await expect(progress.locator('[data-state="complete"]')).toHaveCount(1);
  await expect(page.locator(".agora-answer")).toHaveCount(1);
  const firstAnswer = await page.locator(".agora-answer").innerText();
  state = "retry_wait";
  await check();
  await expect(progress.locator('[data-state="active"]')).toHaveCount(0);
  await expect(page.getByText("Generation was interrupted.", { exact: false })).toBeVisible();
  offline = true;
  await check();
  await expect(page.getByRole("heading", { name: "Reconnecting to the conversation" })).toBeVisible();
  expect(await page.locator(".agora-answer").innerText()).toBe(firstAnswer);
  offline = false;
  state = "running";
  count = saved.responses.length;
  await check();
  await expect(page.getByRole("heading", { name: "Bringing the perspectives together" })).toBeVisible();
  await expect(progress.locator('[data-state="complete"]')).toHaveCount(count);
  await expect(progress.locator('[data-state="active"]')).toContainText("A shared reflection");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  state = "complete";
  await check();
  await expect(progress).toHaveCount(0);
  await expect(page.locator(".agora-synthesis")).toHaveCount(1);
  expect(await page.locator(".agora-answer").first().innerText()).toBe(firstAnswer);
});
