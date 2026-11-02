import { test, expect } from "@playwright/test";
import fs from "node:fs";
import Database from "better-sqlite3";

const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));

test("feed shows short prose once and expands saved long prose without changing it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("philagora_last_visit", "2026-01-01T00:00:00Z"));
  const db = new Database(review.databasePath);
  const short = "Attention is a responsibility you can practise without an audience. Finish one necessary task before asking what others might think of it. Then make room for the person whose needs interrupt your preferred schedule. A useful day can contain both disciplined work and the generosity to stop working.";
  const long = Array(5).fill("A quiet decision can deserve careful attention. Consider the people who depend on it, the promises already made, and the work you can actually sustain. Return to those particulars when the attractive description of your choice begins to replace its reasons.").join("\n\n");
  const rows = [{ id: "review-shortening-short", content: short }, { id: "review-shortening-long", content: long }];
  for (const row of rows) db.prepare("INSERT OR REPLACE INTO posts (id, philosopher_id, content, thesis, stance, tag, source_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(row.id, "seneca", row.content, "A thesis reserved for the full post", "observes", "Timeless Wisdom", "reflection", "published", "2099-01-01T00:00:00Z");
  try {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/feed?type=reflections");
      const shortCard = page.locator('[data-post-id="review-shortening-short"]');
      await expect(shortCard.locator(".public-prose")).toHaveText(short);
      await expect(shortCard.getByText("New", { exact: true })).toBeVisible();
      await expect(shortCard.locator(".public-post-title")).toHaveCount(0);
      await expect(shortCard.getByRole("button", { name: "Read more" })).toHaveCount(0);
      const longCard = page.locator('[data-post-id="review-shortening-long"]');
      const button = longCard.getByRole("button", { name: "Read more" });
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await button.focus(); await page.keyboard.press("Enter");
      await expect(longCard.locator(".public-prose")).toHaveText(long);
      await expect(longCard.getByRole("button", { name: "Show less" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/post/review-shortening-short");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A thesis reserved for the full post");
    for (const row of rows) expect(db.prepare("SELECT content FROM posts WHERE id = ?").get(row.id)).toEqual({ content: row.content });
    expect(errors).toEqual([]);
  } finally {
    for (const row of rows) db.prepare("DELETE FROM posts WHERE id = ?").run(row.id);
    db.close();
  }
});

test("legacy Agora expands every original paragraph and synthesis section", async ({ page }) => {
  const db = new Database(review.databasePath, { readonly: true });
  const original = db.prepare("SELECT philosopher_id,posts FROM agora_responses WHERE thread_id = ? ORDER BY sort_order").all("review-public") as { philosopher_id: string; posts: string }[];
  const synthesis = db.prepare("SELECT sections FROM agora_synthesis_v2 WHERE thread_id = ?").get("review-public") as { sections: string };
  await page.goto("/agora/review-public");
  const answers = page.locator("#first-responses .agora-answer");
  for (let i = 0; i < original.length; i++) {
    const answer = answers.nth(i);
    await answer.getByRole("button", { name: "Read full answer" }).click();
    expect(await answer.locator(".agora-answer-text > p").allTextContents()).toEqual(JSON.parse(original[i].posts));
  }
  await page.getByRole("button", { name: "Read full synthesis" }).click();
  for (const section of Object.values(JSON.parse(synthesis.sections)) as string[][]) {
    for (const text of section) await expect(page.locator(".agora-synthesis").getByText(text, { exact: true })).toBeVisible();
  }
  expect(db.prepare("SELECT philosopher_id,posts FROM agora_responses WHERE thread_id = ? ORDER BY sort_order").all("review-public")).toEqual(original);
  expect(db.prepare("SELECT sections FROM agora_synthesis_v2 WHERE thread_id = ?").get("review-public")).toEqual(synthesis);
  db.close();
});
