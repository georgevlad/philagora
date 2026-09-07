import { test, expect } from "@playwright/test";
import fs from "node:fs";
import Database from "better-sqlite3";
const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));

test("homepage at mobile, tablet and desktop sizes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "What’s on your mind?" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Your question for the philosophers"),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Private", exact: true }),
    ).toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(
      await page
        .locator(".agora-design")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(250, 249, 246)");
    await page.screenshot({
      path: `.local-review/home-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("guest draft survives sign-in navigation without entering the URL", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Your question for the philosophers")
    .fill("PRIVATE_DRAFT: Should I change the way I live?");
  await page.getByRole("link", { name: "Sign in to ask privately" }).click();
  await expect(page).toHaveURL(/\/sign-in\?/);
  expect(page.url()).not.toContain("PRIVATE_DRAFT");
  await page.goBack();
  await expect(
    page.getByLabel("Your question for the philosophers"),
  ).toHaveValue("PRIVATE_DRAFT: Should I change the way I live?");
  await expect(
    page.getByRole("radio", { name: "Private", exact: true }),
  ).toBeChecked();
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Find my philosophers" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Your question for the philosophers"),
  ).toHaveValue("PRIVATE_DRAFT: Should I change the way I live?");
  await page.reload();
  await expect(
    page.getByLabel("Your question for the philosophers"),
  ).toHaveValue("PRIVATE_DRAFT: Should I change the way I live?");
  await expect(
    page.getByRole("radio", { name: "Private", exact: true }),
  ).toBeChecked();
});

test("real submission, incremental answers, return, refresh and whole-group follow-up", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const db = new Database(review.databasePath);
  db.prepare("UPDATE agora_threads SET created_at = ? WHERE user_id = ?").run(
    "2026-01-01T10:00:00Z",
    "owner",
  );
  db.close();
  await request.post(`http://127.0.0.1:${review.stubPort}/mode`, {
    data: { mode: "slow" },
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
    .fill("Should I choose a quieter life for myself?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await page
    .getByRole("button", { name: "Ask the philosophers", exact: false })
    .click();
  await expect(page).toHaveURL(/\/agora\/[a-f0-9-]+$/);
  const threadURL = page.url();
  await expect(
    page.getByText("Private conversation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your question is saved.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Browse the Agora while you wait" })
    .click();
  await page.getByRole("link", { name: "Return to your conversation" }).click();
  await expect(page).toHaveURL(threadURL);
  await page.reload();
  await expect(page).toHaveURL(threadURL);
  await request.post(`http://127.0.0.1:${review.stubPort}/mode`, {
    data: { mode: "normal" },
  });
  await expect(page.locator("#first-responses .agora-answer")).toHaveCount(3, {
    timeout: 60000,
  });
  await expect(
    page.getByRole("heading", { name: "A few things to sit with" }),
  ).toBeVisible();
  const originalAnswer = await page
    .locator("#first-responses .agora-answer")
    .first()
    .innerText();
  expect(originalAnswer.split(/\s+/).length).toBeGreaterThan(200);
  await page
    .getByLabel("Your follow-up to the group")
    .fill("How do I distinguish peace from giving up?");
  await page.getByRole("button", { name: "Ask the whole group" }).click();
  await expect(
    page.getByRole("heading", {
      name: "How do I distinguish peace from giving up?",
    }),
  ).toBeVisible();
  await expect(page.locator("#follow-up .agora-answer")).toHaveCount(3);
  expect(
    await page.locator("#follow-up .agora-answer").first().innerText(),
  ).not.toBe(originalAnswer);
  await expect(
    page.getByRole("heading", { name: "A place to leave it, for now." }),
  ).toBeVisible();
  await expect(page.locator("#first-responses .agora-answer")).toHaveCount(3);
  await expect(page.getByLabel("Your follow-up to the group")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".local-review/conversation-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local-review/conversation-mobile.png",
    fullPage: true,
  });
  const db2 = new Database(review.databasePath);
  const id = threadURL.split("/").pop();
  const child = db2
    .prepare(
      "SELECT visibility,user_id FROM agora_threads WHERE follow_up_to = ?",
    )
    .get(id) as { visibility: string; user_id: string };
  expect(child).toEqual({ visibility: "private", user_id: "owner" });
  expect(
    JSON.stringify(
      db2
        .prepare(
          "SELECT user_input,raw_output FROM generation_log WHERE user_input LIKE ?",
        )
        .all("%quieter life%"),
    ),
  ).toBe("[]");
  db2.close();
});

test("private reads, metadata and public lists do not leak", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/agora/review-private");
  expect(response.status()).toBe(404);
  for (const url of [
    "/",
    "/agora",
    "/api/agora/featured",
    "/sitemap.xml",
    "/agora/review-private",
  ]) {
    const body = await (await request.get(url)).text();
    expect(body).not.toContain("PRIVATE_REVIEW_QUESTION");
    if (url !== "/sitemap.xml")
      expect(body).not.toContain("HIDDEN_REVIEW_QUESTION");
  }
  await page.goto("/agora/review-private");
  await expect(
    page.getByRole("heading", { name: "Conversation unavailable" }),
  ).toBeVisible();
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.other,
      url: review.baseURL,
    },
  ]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Conversation unavailable" }),
  ).toBeVisible();
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /PRIVATE_REVIEW_QUESTION/ }),
  ).toBeVisible();
  expect(await page.title()).not.toContain("PRIVATE_REVIEW_QUESTION");
  await expect(
    page.getByRole("button", { name: "Share conversation" }),
  ).toHaveCount(0);
  await page.context().clearCookies();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Conversation unavailable" }),
  ).toBeVisible();
});

test("public guest question, validation and one-follow-up ownership", async ({
  page,
  request,
}) => {
  await request.post(`http://127.0.0.1:${review.stubPort}/mode`, {
    data: { mode: "normal" },
  });
  const db = new Database(review.databasePath);
  db.prepare(
    "UPDATE agora_threads SET created_at = ? WHERE user_id IS NULL",
  ).run("2026-01-01T10:00:00Z");
  db.close();
  const rejected = await request.post("/api/agora/submit", {
    data: {
      question: "Is this question private?",
      philosopher_ids: ["camus", "nietzsche"],
      visibility: "private",
    },
  });
  expect(rejected.status()).toBe(401);
  await page.goto("/");
  await page.getByRole("radio", { name: "Public", exact: true }).check();
  await page.getByLabel("Your question for the philosophers").fill("short");
  await expect(
    page.getByRole("button", { name: "Find my philosophers" }),
  ).toBeDisabled();
  await page
    .getByLabel("Your question for the philosophers")
    .fill("What does a good public life require of us?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await page.getByRole("button", { name: "Ask the philosophers" }).click();
  await expect(page).toHaveURL(/\/agora\/[a-f0-9-]+$/);
  await expect(
    page.getByText("Public conversation", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".agora-answer")).toHaveCount(3);
  await expect(
    page.getByText("Guest questions cannot be claimed after submission.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Your follow-up to the group")).toHaveCount(0);
});

test("partial failure, slow state and network loss preserve answers", async ({
  page,
  request,
}) => {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
  await page.goto("/agora/review-failed");
  await expect(page.locator(".agora-answer")).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      name: "Some of the conversation is available.",
    }),
  ).toBeVisible();
  const text = await page.locator(".agora-answer").innerText();
  await page.route("**/api/agora/review-failed", (route) => route.abort());
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .click();
  await expect(page.locator(".agora-error")).toContainText(
    "couldn’t check for updates",
  );
  expect(await page.locator(".agora-answer").innerText()).toBe(text);
  await page.unroute("**/api/agora/review-failed");
  await page
    .getByRole("button", { name: "Check connection and updates" })
    .click();
  await expect(
    page.getByText("We couldn’t check for updates.", { exact: false }),
  ).toHaveCount(0);
  await page.goto("/agora/review-slow");
  await expect(
    page.getByRole("heading", { name: "This is taking a little longer." }),
  ).toBeVisible();
  await request.post(`http://127.0.0.1:${review.stubPort}/mode`, {
    data: { mode: "normal" },
  });
});

test("navigation, feed filters, debate and mock issue actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "The full feed" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.locator('a[href*="/feed?type="]').first().click();
  await expect(page).toHaveURL(/\/feed\?type=/);
  await page.goto("/?type=reflections");
  await expect(page).toHaveURL(/\/feed\?type=reflections/);
  await page.goto("/debates/review-debate");
  await expect(
    page.getByRole("heading", {
      name: "Does a good life need a public purpose?",
    }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Read the sample briefing" }).click();
  await expect(
    page.getByText("This entire feature is mocked", { exact: false }),
  ).toBeVisible();
  let submissions = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/agora") && req.method() === "POST")
      submissions++;
  });
  await page
    .getByLabel("Your sample question")
    .fill("Who should decide how the budget is spent?");
  await page
    .getByRole("button", { name: "Preview contextual question" })
    .click();
  await expect(page.getByRole("status")).toContainText("Nothing submitted");
  await page.getByRole("button", { name: "Remove context" }).click();
  expect(submissions).toBe(0);
  await page
    .getByRole("link", { name: "Ask an ordinary Agora question" })
    .click();
  await expect(
    page.getByLabel("Your question for the philosophers"),
  ).toHaveValue("");
});

test("keyboard, 200% text and reduced motion reflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  // The existing development notice may precede the skip link.
  for (let i = 0; i < 3; i++) {
    if (
      await page
        .getByRole("link", { name: "Skip to content" })
        .evaluate((el) => el === document.activeElement)
    )
      break;
    await page.keyboard.press("Tab");
  }
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: ".local-review/home-320-text200.png",
    fullPage: true,
  });
});
