import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));
if (
  !path
    .resolve(review.databasePath)
    .startsWith(path.resolve(".local-review") + path.sep)
)
  throw new Error("Review database required.");

test("empty full feed and a slow next page remain usable", async ({ page }) => {
  const db = new Database(review.databasePath);
  const posts = db.prepare("SELECT id,status,updated_at FROM posts").all() as {
    id: string;
    status: string;
    updated_at: string;
  }[];
  const login = await page.request.post("/api/admin/auth", {
    data: { password: "local-review-admin" },
  });
  expect(login.ok()).toBeTruthy();
  try {
    const hidden = await page.request.patch("/api/admin/posts/bulk", {
      data: { from_status: "published", to_status: "archived" },
    });
    expect(hidden.ok()).toBeTruthy();
    await page.goto("/feed");
    await expect(
      page.getByRole("heading", { name: "No posts yet.", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Filter posts" }),
    ).toBeVisible();
    await page.screenshot({
      path: ".local-review/public-feed-empty.png",
      fullPage: true,
    });
  } finally {
    for (const post of posts)
      db.prepare("UPDATE posts SET status=?,updated_at=? WHERE id=?").run(
        post.status,
        post.updated_at,
        post.id,
      );
    // The existing local admin route also invalidates the in-memory feed cache.
    await page.request.patch("/api/admin/posts/bulk", {
      data: { from_status: "draft", to_status: "draft" },
    });
    for (const post of posts)
      db.prepare("UPDATE posts SET updated_at=? WHERE id=?").run(
        post.updated_at,
        post.id,
      );
    db.close();
  }
  await page.context().clearCookies();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/feed?*", async (route) => {
    if (!route.request().url().includes("offset=")) return route.continue();
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/feed");
    const first = await page
      .locator("[data-post-id]")
      .first()
      .getAttribute("data-post-id");
    await page
      .getByRole("button", { name: "Load more posts", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Loading more posts…", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(`[data-post-id="${first}"]`)).toHaveCount(1);
    await page.screenshot({ path: ".local-review/public-feed-loading.png" });
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Loading more posts…", exact: true }),
  ).toHaveCount(0);
});

test("art, recommendations, quips, full reading and share actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/post/review-art");
  const art = page.locator(".public-artwork img");
  await expect(art).toBeVisible();
  await expect
    .poll(() =>
      art.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    )
    .toBeTruthy();
  await page.screenshot({
    path: ".local-review/public-art-mobile.png",
    fullPage: true,
  });
  await page.goto("/post/review-recommendation");
  const recommendation = page.getByRole("link", {
    name: "Letters from a Stoic",
  });
  await expect(recommendation).toBeVisible();
  await expect(recommendation).toHaveAttribute(
    "href",
    /google.com\/search\?q=Letters%20from%20a%20Stoic/,
  );
  await expect(recommendation).toHaveAttribute("rel", "noopener noreferrer");
  await page.goto("/post/review-quip");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".public-prose")).toContainText(
    "You have made a calendar for every hour",
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { sharedURL: string }).sharedURL = text;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  expect(
    await page.evaluate(
      () => (window as unknown as { sharedURL: string }).sharedURL,
    ),
  ).toBe(review.baseURL + "/post/review-quip");
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toHaveCount(0);
});

test("the skip link moves keyboard navigation into the reading page", async ({
  page,
}) => {
  await page.goto("/about");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Use test account", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Switch to guest", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(
    page.locator("main").getByRole("link", { name: "Ask the philosophers" }),
  ).toBeFocused();
});
