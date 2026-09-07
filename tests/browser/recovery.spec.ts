import { test, expect } from "@playwright/test";
import fs from "node:fs";
import Database from "better-sqlite3";
const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));
function resetQuota() {
  const db = new Database(review.databasePath);
  db.prepare("UPDATE agora_threads SET created_at = ?").run(
    "2026-01-01T10:00:00Z",
  );
  db.close();
}

test("lost submission response reconciles the original ID without duplicate generation", async ({
  page,
  request,
}) => {
  resetQuota();
  await request.post(`http://127.0.0.1:${review.stubPort}/mode`, {
    data: { mode: "normal" },
  });
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
  await page.goto("/");
  const question = `How should I think about a difficult choice today? ${Date.now()}`;
  let createdId = "";
  await page.route("**/api/agora/submit", async (route) => {
    const response = await route.fetch();
    createdId = (await response.json()).threadId;
    await route.abort();
  });
  await page.getByLabel("Your question for the philosophers").fill(question);
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await page.getByRole("button", { name: "Ask the philosophers" }).click();
  await expect(page.locator("#question-error")).toContainText(
    "may already be saved",
  );
  await expect(
    page.getByLabel("Your question for the philosophers"),
  ).toBeDisabled();
  await page.unroute("**/api/agora/submit");
  await page.getByRole("button", { name: "Check the same submission" }).click();
  await expect(page).toHaveURL(`${review.baseURL}/agora/${createdId}`);
  const db = new Database(review.databasePath);
  expect(
    db
      .prepare("SELECT COUNT(*) AS c FROM agora_threads WHERE question = ?")
      .get(question),
  ).toEqual({ c: 1 });
  db.close();
});

test("rejected submissions retain editable text, group and private audience", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
  await page.goto("/");
  await page
    .getByLabel("Your question for the philosophers")
    .fill("Should I change my mind about this decision?");
  await page.route("**/api/agora/submit", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ error: "Daily question limit reached." }),
    }),
  );
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await page.getByRole("button", { name: "Ask the philosophers" }).click();
  await expect(page.locator("#question-error")).toContainText(
    "Daily question limit",
  );
  await expect(
    page.getByLabel("Your question for the philosophers"),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Your question for the philosophers"),
  ).toHaveValue("Should I change my mind about this decision?");
  await expect(
    page.getByRole("radio", { name: "Private", exact: true }),
  ).toBeChecked();
});

test("local generation partial failures retain first answer and explain missing results", async ({
  page,
  request,
}) => {
  resetQuota();
  await request.post(`http://127.0.0.1:${review.stubPort}/mode`, {
    data: { mode: "partial" },
  });
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
  await page.goto("/");
  await page
    .getByLabel("Your question for the philosophers")
    .fill("How can I make room for a different perspective?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await page.getByRole("button", { name: "Ask the philosophers" }).click();
  await expect(page.locator(".agora-answer")).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      name: "Some of the conversation is available.",
    }),
  ).toBeVisible();
  await expect(page.locator(".agora-wait")).toContainText("could not respond");
  await expect(page.getByLabel("Your follow-up to the group")).toBeVisible();
  await request.post(`http://127.0.0.1:${review.stubPort}/mode`, {
    data: { mode: "normal" },
  });
});

test("answer arrival preserves the reading node and keyboard focus", async ({
  page,
}) => {
  const db = new Database(review.databasePath);
  const id = `review-focus-${Date.now()}`;
  db.prepare(
    "INSERT INTO agora_threads (id,question,status,visibility) VALUES (?,?,'in_progress','public')",
  ).run(id, "What does attention ask of us?");
  for (const pid of ["camus", "nietzsche"])
    db.prepare(
      "INSERT INTO agora_thread_philosophers (thread_id,philosopher_id) VALUES (?,?)",
    ).run(id, pid);
  db.prepare(
    "INSERT INTO agora_responses (id,thread_id,philosopher_id,posts,sort_order) VALUES (?,?,?, ?,0)",
  ).run(
    id + "-one",
    id,
    "camus",
    JSON.stringify([
      "An already received answer, kept in place while you read.",
    ]),
  );
  await page.goto(`/agora/${id}`);
  await expect(page.locator(".agora-answer")).toHaveCount(1);
  const originalNode = await page.locator(".agora-answer").elementHandle();
  await page.getByRole("button", { name: "Share conversation" }).focus();
  const beforeScroll = await page.evaluate(() => scrollY);
  db.prepare(
    "INSERT INTO agora_responses (id,thread_id,philosopher_id,posts,sort_order) VALUES (?,?,?,?,1)",
  ).run(
    id + "-two",
    id,
    "nietzsche",
    JSON.stringify(["A newly arrived answer, appended beneath the first."]),
  );
  await expect(page.locator(".agora-answer")).toHaveCount(2);
  expect(await originalNode?.evaluate((el) => el.isConnected)).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Share conversation" }),
  ).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
  db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(
    id,
  );
  db.close();
});

test("feed pagination keeps personalized likes and bookmarks", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
  const db = new Database(review.databasePath);
  db.prepare("DELETE FROM user_bookmarks WHERE user_id = ?").run("owner");
  db.prepare("DELETE FROM user_likes WHERE user_id = ?").run("owner");
  db.close();
  await page.goto("/feed");
  await expect(
    page.locator("aside").getByRole("link", { name: "RO Review", exact: true }),
  ).toBeVisible();
  const bookmarkResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/api/bookmarks") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Bookmark", exact: true })
    .first()
    .click();
  expect((await bookmarkResponse).ok()).toBeTruthy();
  const likeResponse = page.waitForResponse(
    (r) => r.url().includes("/api/likes") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Like", exact: true }).first().click();
  expect((await likeResponse).ok()).toBeTruthy();
  const pagination = page.waitForResponse(
    (r) => r.url().includes("/api/feed?") && r.url().includes("offset="),
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const data = await (await pagination).json();
  expect(data.posts.length).toBeGreaterThan(0);
  await expect(page.getByText("You've reached the end")).toBeVisible();
});

test("Agora empty state preserves the composer and sample issue", async ({
  page,
}) => {
  const db = new Database(review.databasePath);
  const rows = db
    .prepare("SELECT id, hidden_from_feed FROM agora_threads")
    .all() as { id: string; hidden_from_feed: number }[];
  db.prepare("UPDATE agora_threads SET hidden_from_feed = 1").run();
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Every conversation starts with a question.",
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Your question for the philosophers"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Read the sample briefing" }),
    ).toBeVisible();
    await page.screenshot({
      path: ".local-review/home-empty.png",
      fullPage: true,
    });
  } finally {
    for (const row of rows)
      db.prepare(
        "UPDATE agora_threads SET hidden_from_feed = ? WHERE id = ?",
      ).run(row.hidden_from_feed, row.id);
    db.close();
  }
});
