import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));
if (
  !path
    .resolve(review.databasePath)
    .startsWith(path.resolve(".local-review") + path.sep)
)
  throw new Error("Use the isolated review database.");
const destinations = [
  ["/feed", "The feed"],
  ["/post/review-history", "Access changes who can ask the question"],
  ["/debates", "Debates"],
  ["/debates/review-debate", "Does a good life need a public purpose?"],
  ["/philosophers/seneca", "Seneca"],
  ["/profile", "Your profile"],
  ["/schools", "Schools of Thought"],
  ["/about", "About Philagora"],
];
async function login(page: Page, who = "owner") {
  await page
    .context()
    .addCookies([
      {
        name: "better-auth.session_token",
        value: review.cookies[who],
        url: review.baseURL,
      },
    ]);
}
async function bounds(page: Page) {
  const overflow = await page.locator(".agora-design").evaluate((root) =>
    Array.from(root.querySelectorAll("*"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width &&
          r.height &&
          (r.right > innerWidth + 1 || r.left < -1) &&
          !el.classList.contains("agora-skip")
        );
      })
      .map((el) => el.tagName + "." + el.className)
      .slice(0, 8),
  );
  expect(overflow).toEqual([]);
}
for (const width of [320, 390, 768, 1440]) {
  test(`public pages reflow at ${width}px`, async ({ page }) => {
    test.setTimeout(180000);
    await login(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [route, title] of destinations) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { level: 1, name: title, exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await bounds(page);
      await expect(
        page.getByRole("navigation", { name: "Main navigation", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("complementary", { name: "Local test preview" }),
      ).toBeVisible();
      expect(
        await page
          .locator(".agora-design")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe("rgb(250, 249, 246)");
      if (width === 320 || width === 1440)
        await page.screenshot({
          path: `.local-review/public-${route.replaceAll("/", "-")}-${width}.png`,
          fullPage:
            route !== "/feed" &&
            !route.startsWith("/philosophers/") &&
            route !== "/profile",
        });
    }
    expect(errors).toEqual([]);
  });
}
test("320px with 200% text, touch controls and reduced motion", async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
  for (const [route] of destinations) {
    await page.goto(route);
    await page.locator("h1").waitFor();
    await bounds(page);
    const small = await page.locator(".agora-design").evaluate((root) =>
      Array.from(
        root.querySelectorAll("button,nav a,.public-person,.agora-outline"),
      )
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height < 43.5;
        })
        .map((el) => el.textContent),
    );
    expect(small).toEqual([]);
  }
  await page.goto("/post/review-history");
  await page.screenshot({
    path: ".local-review/public-post-320-text-200.png",
    fullPage: true,
  });
});
test("navigation, keyboard filters, full text and contextual links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/feed");
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  const reflections = page
    .getByRole("navigation", { name: "Filter posts" })
    .getByRole("link", { name: "Reflections", exact: true });
  await reflections.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/type=reflections/);
  await expect(
    page
      .getByRole("navigation", { name: "Filter posts" })
      .getByRole("link", { name: "Reflections", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/post/review-history");
  const context = page
    .locator("summary")
    .filter({ hasText: "Historical context" });
  await context.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("This invented event", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("There is no guarantee that careful attention", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/post/review-reply-0");
  await page.getByRole("link", { name: "Replying to Marcus Aurelius" }).click();
  await expect(page).toHaveURL(/\/post\/review-reaction-0$/);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Debates", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Debates", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "More from Philagora" })
    .getByRole("link", { name: "Schools of thought" })
    .click();
  await page
    .getByRole("link", { name: /Seneca/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/philosophers\/seneca$/);
});
test("each feed filter, clustered replies and philosopher pagination", async ({
  page,
}) => {
  for (const type of ["reactions", "reflections", "replies", "recommends"]) {
    await page.goto("/feed?type=" + type);
    await expect(page.locator("[data-post-id]").first()).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Filter posts" })
        .locator('[aria-current="page"]'),
    ).toHaveAttribute("href", "/feed?type=" + type);
  }
  await page.goto("/feed");
  await expect(
    page.getByText("perspectives on one story", { exact: false }),
  ).toBeVisible();
  const cluster = page.locator(".public-cluster");
  await cluster.scrollIntoViewIfNeeded();
  await cluster.getByRole("button", { name: "Show 2 replies" }).click();
  await expect(
    cluster.locator('[data-post-id="review-reply-0"]'),
  ).toBeVisible();
  await cluster.getByRole("button", { name: "Hide replies" }).click();
  await expect(cluster.locator('[data-post-id="review-reply-0"]')).toHaveCount(
    0,
  );
  await page.goto("/philosophers/seneca");
  const initial = await page.locator("[data-post-id]").count();
  const response = page.waitForResponse(
    (r) => r.url().includes("/api/feed?") && r.url().includes("offset="),
  );
  await page
    .getByRole("button", { name: "Load more posts" })
    .scrollIntoViewIfNeeded();
  const data = await (await response).json();
  expect(data.posts.length).toBeGreaterThan(0);
  expect(
    data.posts.every(
      (p: { philosopherId: string }) => p.philosopherId === "seneca",
    ),
  ).toBeTruthy();
  await expect
    .poll(() => page.locator("[data-post-id]").count())
    .toBeGreaterThan(initial);
  await page
    .getByRole("navigation", { name: "Filter posts" })
    .getByRole("link", { name: "Replies", exact: true })
    .click();
  await expect(page).toHaveURL(/philosophers\/seneca\?type=replies$/);
  await expect(
    page.getByRole("heading", { name: "No replies from Seneca yet." }),
  ).toBeVisible();
});
test("complete debates retain every saved phase, reply target and synthesis form", async ({
  page,
}) => {
  await page.goto("/debates/review-debate");
  for (const id of [
    "openings",
    "cross-examination",
    "rebuttals",
    "closing-perspectives",
    "synthesis",
  ]) {
    await page
      .locator(`nav[aria-label="Debate phases"] a[href="#${id}"]`)
      .click();
    await expect(page.locator("#" + id)).toBeInViewport();
  }
  const db = new Database(review.databasePath);
  try {
    const posts = db
      .prepare("SELECT content FROM debate_posts WHERE debate_id=?")
      .all("review-debate") as { content: string }[];
    for (const p of posts)
      expect(await page.locator("main").innerText()).toContain(p.content);
  } finally {
    db.close();
  }
  await page
    .locator('#contribution-review-cross a[href^="#contribution-"]')
    .click();
  await expect(page).toHaveURL(/#contribution-/);
  await page.goto("/debates/review-debate-scheduled");
  await expect(
    page.getByText("This debate has not yet begun.", { exact: false }),
  ).toBeVisible();
  await page.goto("/debates/review-debate-progress");
  await expect(page.locator("main").getByRole("status")).toContainText(
    "This debate is in progress.",
  );
  await page.goto("/debates/review-debate-lists");
  await expect(page.locator("#synthesis")).toContainText(
    "Shared institutions do not require identical convictions.",
  );
});
test("account ownership, saved interactions, failure rollback and sign-out", async ({
  page,
}) => {
  await login(page);
  await page.goto("/post/review-post-0");
  const like = page.getByRole("button", { name: "Like", exact: true });
  const bookmark = page.getByRole("button", { name: "Bookmark", exact: true });
  await expect(like).toBeEnabled();
  if ((await like.getAttribute("aria-pressed")) !== "true") await like.click();
  if ((await bookmark.getAttribute("aria-pressed")) !== "true")
    await bookmark.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");
  await page.route("**/api/likes", (route) =>
    route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } }),
  );
  await like.click();
  await expect(page.getByRole("status")).toContainText("Could not update like");
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await page.unroute("**/api/likes");
  await page.goto("/profile");
  await expect(page.locator("#questions")).toContainText(
    "PRIVATE_REVIEW_QUESTION",
  );
  await expect(
    page.locator("#bookmarks [data-post-id='review-post-0']"),
  ).toBeVisible();
  await page
    .locator("#bookmarks [data-post-id='review-post-0']")
    .getByRole("button", { name: "Bookmark", exact: true })
    .click();
  await expect(
    page.locator("#bookmarks [data-post-id='review-post-0']"),
  ).toHaveCount(0);
  const sessionDb = new Database(review.databasePath);
  const originalSession = sessionDb
    .prepare('SELECT * FROM "session" WHERE token=?')
    .get(decodeURIComponent(review.cookies.owner).split(".")[0]) as Record<
    string,
    unknown
  >;
  try {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  } finally {
    const columns = Object.keys(originalSession);
    sessionDb
      .prepare(
        `INSERT OR REPLACE INTO "session" (${columns.map((c) => '"' + c + '"').join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      )
      .run(...Object.values(originalSession));
    sessionDb.close();
  }
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  await login(page, "other");
  await page.goto("/profile");
  await expect(page.locator("main")).not.toContainText(
    "PRIVATE_REVIEW_QUESTION",
  );
  await expect(page.locator("main")).not.toContainText("review-post-0");
  await expect(
    page.getByRole("heading", { name: "Keep an idea for later." }),
  ).toBeVisible();
  await page.goto("/agora/review-private");
  await expect(page.locator("main")).not.toContainText(
    "PRIVATE_REVIEW_QUESTION",
  );
});
test("guest sign-in return and missing pages preserve public navigation", async ({
  page,
}) => {
  await page.goto("/post/review-history");
  await page.getByRole("button", { name: "Like", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fpost%2Freview-history$/);
  for (const route of [
    "/post/missing-review",
    "/philosophers/missing-review",
    "/debates/missing-review",
    "/missing-review",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "We couldn’t find this page." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore the feed" }),
    ).toBeVisible();
  }
});
test("pagination failures retain reading content and retry successfully", async ({
  page,
}) => {
  await page.route("**/api/feed?*", (route) => {
    if (route.request().url().includes("offset="))
      return route.fulfill({
        status: 503,
        json: { error: "Temporary fixture failure" },
      });
    return route.continue();
  });
  await page.goto("/feed");
  const first = await page
    .locator("[data-post-id]")
    .first()
    .getAttribute("data-post-id");
  await page
    .getByRole("button", { name: "Load more posts" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByText("Unable to load more posts right now.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(`[data-post-id="${first}"]`)).toHaveCount(1);
  await page.unroute("**/api/feed?*");
  const response = page.waitForResponse(
    (r) => r.url().includes("/api/feed?") && r.url().includes("offset="),
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(
    page.getByText("Unable to load more posts right now.", { exact: false }),
  ).toHaveCount(0);
});
test("empty debate archive and page error boundary recover without changing content", async ({
  page,
}) => {
  const db = new Database(review.databasePath);
  db.pragma("foreign_keys = OFF");
  const rows = db.prepare("SELECT * FROM debates").all() as Record<
    string,
    unknown
  >[];
  try {
    db.prepare("DELETE FROM debates").run();
    await page.goto("/debates");
    await expect(
      page.getByRole("heading", { name: "The next debate is still to come." }),
    ).toBeVisible();
  } finally {
    for (const row of rows) {
      const columns = Object.keys(row);
      db.prepare(
        `INSERT INTO debates (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      ).run(...Object.values(row));
    }
  }
  try {
    db.exec("ALTER TABLE debates RENAME TO review_debates_unavailable");
    await page.goto("/debates");
    await expect(
      page.getByRole("heading", { name: "This page couldn’t load." }),
    ).toBeVisible();
  } finally {
    db.exec("ALTER TABLE review_debates_unavailable RENAME TO debates");
    db.close();
  }
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Debates", exact: true }),
  ).toBeVisible();
});
test("admin login and navigation retain the legacy palette", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await expect(page.locator(".agora-design")).toHaveCount(0);
  expect(
    await page
      .locator("body")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--color-terracotta").trim(),
      ),
  ).toBe("#314E3D");
  await page.getByLabel("Password").fill("local-review-admin");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator(".agora-design")).toHaveCount(0);
  await page.screenshot({
    path: ".local-review/public-admin-regression.png",
    fullPage: true,
  });
});
