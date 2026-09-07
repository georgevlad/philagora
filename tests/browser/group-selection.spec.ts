import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import Database from "better-sqlite3";
const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));
async function owner(page: Page) {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: review.cookies.owner,
      url: review.baseURL,
    },
  ]);
}
const selection = (page: Page) =>
  page.getByRole("group", { name: "All philosophers", exact: true });
const classification = {
  questionType: "advice",
  recommendationsAppropriate: true,
  recommendationHint: "Reflective essays",
};

test("suggestions precede submission, reasons and custom group survive refresh, classification is reused", async ({
  page,
}) => {
  await owner(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const db = new Database(review.databasePath);
  db.prepare("UPDATE agora_threads SET created_at = ? WHERE user_id = ?").run(
    "2026-01-01T10:00:00Z",
    "owner",
  );
  db.close();
  let suggestionCalls = 0;
  let submitted: Record<string, unknown> | undefined;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agora/suggest")) suggestionCalls++;
    if (request.url().endsWith("/api/agora/submit"))
      submitted = request.postDataJSON();
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Ask the philosophers" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Your question for the philosophers")
    .fill("How do I choose a life I can stand behind?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await expect(
    page.getByRole("heading", { name: "Who should join the conversation?" }),
  ).toBeFocused();
  await expect(
    page.getByText(
      "Helps you separate what you can influence from the approval you cannot control.",
    ),
  ).toBeVisible();
  expect(submitted).toBeUndefined();
  await page.screenshot({
    path: ".local-review/group-review-mobile.png",
    fullPage: true,
  });
  await page
    .getByText("Change the group · All thinkers", { exact: true })
    .click();
  await selection(page)
    .getByRole("checkbox", { name: "Plato", exact: true })
    .check();
  await expect(
    selection(page).getByRole("checkbox", { name: "Seneca", exact: true }),
  ).toBeDisabled();
  await selection(page)
    .getByRole("checkbox", { name: "Marcus Aurelius", exact: true })
    .uncheck();
  await page.reload();
  await expect(page.locator(".agora-selected-group")).toContainText(
    "3 of 2–4 thinkers selected",
  );
  await expect(page.locator(".agora-selected-group")).toContainText("Plato");
  expect(suggestionCalls).toBe(1);
  const before = await (
    await page.request.get(`http://127.0.0.1:${review.stubPort}/health`)
  ).json();
  await page.getByRole("button", { name: "Ask the philosophers" }).click();
  await expect(page).toHaveURL(/\/agora\/[a-f0-9-]+$/);
  expect(submitted?.classification).toEqual(classification);
  expect(submitted?.philosopher_ids).toEqual(["camus", "nietzsche", "plato"]);
  const after = await (
    await page.request.get(`http://127.0.0.1:${review.stubPort}/health`)
  ).json();
  expect(after.classification).toBe(before.classification);
});

test("editing cancels stale suggestions and invalidates the previous group and classification", async ({
  page,
}) => {
  await owner(page);
  let calls = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/agora/suggest", async (route) => {
    calls++;
    if (calls === 1) {
      await held;
      await route
        .fulfill({
          json: {
            classification,
            suggestions: [
              { id: "camus", reason: "Outdated match" },
              { id: "plato", reason: "Outdated match" },
            ],
          },
        })
        .catch(() => {});
    } else {
      await route.fulfill({
        json: {
          classification,
          suggestions: [
            { id: "kant", reason: "New question match" },
            { id: "russell", reason: "A second new match" },
          ],
        },
      });
    }
  });
  await page.goto("/");
  await page
    .getByLabel("Your question for the philosophers")
    .fill("Should I change the way I spend my days?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Finding perspectives for your question…",
    }),
  ).toBeVisible();
  await page
    .getByLabel("Your question for the philosophers")
    .fill("What do we owe to the people around us?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await expect(
    page.getByText("New question match", { exact: true }),
  ).toBeVisible();
  release();
  await expect(page.getByText("Outdated match", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByLabel("Your question for the philosophers")
    .fill("What do we owe to future generations instead?");
  await expect(page.locator(".agora-group-review")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ask the philosophers" }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agora:draft:owner") || "null"),
  );
  expect(saved.value.review).toBeUndefined();
  expect(saved.value.selectedIds).toEqual([]);
});

for (const status of [429, 500, 200]) {
  test(`suggestion failure ${status} keeps a manual 2–4-person path and no invented default group`, async ({
    page,
  }) => {
    await owner(page);
    await page.route("**/api/agora/suggest", (route) =>
      route.fulfill({
        status,
        json:
          status === 200
            ? { suggestions: [{ id: "camus", reason: "Only one result" }] }
            : { error: "Fixture failure" },
      }),
    );
    let submitted: Record<string, unknown> | undefined;
    await page.route("**/api/agora/submit", (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({
        status: 429,
        json: { error: "Submission retained for review" },
      });
    });
    await page.goto("/");
    await page
      .getByLabel("Your question for the philosophers")
      .fill("How can I make a thoughtful decision today?");
    await page.getByRole("button", { name: "Find my philosophers" }).click();
    await expect(page.locator(".agora-selected-group")).toContainText(
      "0 of 2–4",
    );
    await selection(page)
      .getByRole("checkbox", { name: "Seneca", exact: true })
      .check();
    await expect(
      page.getByRole("button", { name: "Ask the philosophers" }),
    ).toBeDisabled();
    await selection(page)
      .getByRole("checkbox", { name: "Plato", exact: true })
      .check();
    await page.getByRole("button", { name: "Ask the philosophers" }).click();
    await expect(page.locator("#question-error")).toContainText(
      "Submission retained",
    );
    await expect(page.locator("#question-error")).toBeFocused();
    expect(submitted?.classification).toBeUndefined();
    expect(submitted?.philosopher_ids).toEqual(["seneca", "plato"]);
    expect(submitted?.visibility).toBe("private");
    await expect(
      page.getByLabel("Your question for the philosophers"),
    ).toHaveValue("How can I make a thoughtful decision today?");
  });
}

test("article-only questions can reach suggestions and keep their article through group review", async ({
  page,
}) => {
  await owner(page);
  let suggested: Record<string, unknown> | undefined;
  await page.route("**/api/agora/suggest", (route) => {
    suggested = route.request().postDataJSON();
    return route.fulfill({
      json: {
        classification,
        suggestions: [
          { id: "camus", reason: "One way to read your article" },
          { id: "kant", reason: "Another way to read your article" },
        ],
      },
    });
  });
  await page.goto("/");
  await page.getByText("Article link · optional", { exact: true }).click();
  await page
    .getByLabel("Share an article")
    .fill("https://example.com/local-review-article");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await expect(
    page.getByRole("heading", { name: "Who should join the conversation?" }),
  ).toBeVisible();
  expect(suggested?.question).toBe("What should we make of this?");
  expect(suggested?.article_url).toBe(
    "https://example.com/local-review-article",
  );
  await expect(
    page.getByRole("button", { name: "Ask the philosophers" }),
  ).toBeEnabled();
  await page
    .getByLabel("Share an article")
    .fill("https://example.com/changed-article");
  await expect(page.locator(".agora-group-review")).toHaveCount(0);
});

test("test mode is explicit and representative responses reflow at mobile and desktop widths", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("complementary", { name: "Local test preview" }),
  ).toContainText("Fixed sample answers");
  await page
    .getByRole("link", { name: "Use test account", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await page.goto("/agora/review-public");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("#first-responses .agora-answer")).toHaveCount(3);
    const paragraphs = await page
      .locator("#first-responses .agora-answer > p")
      .allTextContents();
    expect(paragraphs.length).toBe(4);
    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(100);
      expect(words).toBeLessThanOrEqual(200);
    }
    expect(
      (await page.locator(".agora-synthesis").innerText()).split(/\s+/).length,
    ).toBeGreaterThan(200);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `.local-review/long-conversation-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("link", { name: "Switch to guest", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Sign in to ask privately" }),
  ).toBeVisible();
  await page.goto("/feed");
  await expect(
    page.getByRole("complementary", { name: "Local test preview" }),
  ).toBeVisible();
});

test("reviewed guest group and classification survive private sign-in and refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Public", exact: true }).check();
  await page
    .getByLabel("Your question for the philosophers")
    .fill("How can I choose a life with more room to think?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await expect(
    page.getByRole("heading", { name: "Who should join the conversation?" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Private", exact: true }).check();
  await page.getByRole("link", { name: "Sign in to ask privately" }).click();
  await expect(page).toHaveURL(/\/sign-in\?/);
  await owner(page);
  await page.goto("/");
  await page.reload();
  await expect(page.locator(".agora-selected-group")).toContainText("3 of 2–4");
  await expect(
    page.getByRole("radio", { name: "Private", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText(
      "Helps you separate what you can influence from the approval you cannot control.",
    ),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("agora:draft:owner") || "null"),
  );
  expect(saved.value.review.classification).toEqual(classification);
  expect(saved.value.question).toBe(
    "How can I choose a life with more room to think?",
  );
});

test("suggested group at 320px and 200% text stays inside the viewport without clipping", async ({
  page,
}) => {
  await owner(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await page
    .getByLabel("Your question for the philosophers")
    .fill("How do I decide which ambitions are worth keeping?");
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await expect(
    page.getByRole("heading", { name: "Who should join the conversation?" }),
  ).toBeFocused();
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  const bounds = await page
    .locator(
      ".agora-composer, .agora-suggested-group, .agora-suggested-group label, .agora-suggested-group label > span",
    )
    .evaluateAll((elements) =>
      elements.map((el) => ({
        left: el.getBoundingClientRect().left,
        right: el.getBoundingClientRect().right,
      })),
    );
  for (const box of bounds) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(320);
  }
  await page.locator(".agora-group-review").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local-review/group-320-text200-fixed.png" });
});
