import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";

const review = JSON.parse(fs.readFileSync(".local-review/active.json", "utf8"));
const matches = {
  suggestions: [
    { id: "seneca", reason: "A practical perspective on your choices." },
    { id: "camus", reason: "A different way of thinking about meaning." },
  ],
};

async function signInLocally(page: Page) {
  await page.context().addCookies([{
    name: "better-auth.session_token", value: review.cookies.owner, url: review.baseURL,
  }]);
}

test("navigation leads from discovery to reading and back to asking", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  const mainNav = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expect(mainNav.getByRole("link", { name: "Ask", exact: true })).toHaveAttribute("aria-current", "page");
  await mainNav.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(mainNav.getByRole("link", { name: "Explore", exact: true })).toHaveAttribute("aria-current", "page");
  const browse = page.getByRole("navigation", { name: "Explore Philagora" });
  for (const [label, path, heading] of [
    ["Conversations", "/agora", "The Agora"],
    ["Feed", "/feed", "The feed"],
    ["Debates", "/debates", "Debates"],
    ["In Focus", "/in-focus", "In Focus"],
  ]) {
    await browse.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    await expect(browse.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(mainNav.getByRole("link", { name: "Explore", exact: true })).toHaveAttribute("aria-current", "page");
  }
  await browse.getByRole("link", { name: "Conversations", exact: true }).click();
  await expect(page.getByLabel("Your question for the philosophers")).toHaveCount(0);
  await page.getByRole("link", { name: "Ask a question", exact: false }).click();
  await expect(page).toHaveURL(/\/#ask$/);
  await expect(page.getByLabel("Your question for the philosophers")).toBeVisible();
  await mainNav.getByRole("link", { name: "Philosophers", exact: true }).click();
  await page.locator(".public-thinker-card").filter({ has: page.getByRole("heading", { name: "Seneca", exact: true }) }).click();
  await expect(page).toHaveURL(/\/philosophers\/seneca$/);
  await expect(mainNav.getByRole("link", { name: "Philosophers", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "All philosophers" }).click();
  await expect(page).toHaveURL(/\/philosophers$/);
});

test("discovery and signed-in navigation reflow on small and large screens", async ({ page }) => {
  test.setTimeout(180000);
  await signInLocally(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/explore", "/agora", "/philosophers", "/in-focus"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Your library", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: `.local-review/navigation-${path.slice(1)}-${width}.png`, fullPage: true });
    }
  }
  await page.getByRole("link", { name: "Your library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your library", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.style.fontSize = "200%";
  }));
  for (const path of ["/explore", "/philosophers", "/in-focus", "/agora"]) {
    await page.goto(path);
    const outside = await page.locator(".agora-design").evaluate((root) =>
      [...root.querySelectorAll("a, h1, h2, p")].filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > innerWidth + 1);
      }).map((element) => element.textContent),
    );
    expect(outside).toEqual([]);
  }
});

for (const visibility of ["private", "public"] as const) {
  test(`audience changed to ${visibility} during matching survives results, refresh, and submission`, async ({ page }) => {
    await signInLocally(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/agora/suggest", async (route) => {
      await held;
      await route.fulfill({ json: matches });
    });
    let submitted: Record<string, unknown> | undefined;
    await page.route("**/api/agora/submit", async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 429, json: { error: "Submission captured for local review." } });
    });
    await page.goto("/");
    const question = page.getByLabel("Your question for the philosophers");
    const audience = page.getByRole("group", { name: "Who can read your conversation?" });
    await expect(audience).toBeVisible();
    expect((await audience.boundingBox())!.y).toBeLessThan((await question.boundingBox())!.y);
    await page.getByRole("radio", { name: visibility === "private" ? "Public" : "Private", exact: true }).check();
    await question.fill("How do I find more room for the things that matter?");
    await page.getByRole("button", { name: "Find my philosophers" }).click();
    await expect(page.getByRole("heading", { name: "Finding perspectives for your question…" })).toBeVisible();
    await page.getByRole("radio", { name: visibility === "private" ? "Private" : "Public", exact: true }).check();
    release();
    await expect(page.getByRole("heading", { name: "Meet your philosophers" })).toBeVisible();
    await expect(page.locator(".agora-audience-summary")).toContainText(visibility === "private" ? "Private conversation" : "Public conversation");
    await page.reload();
    await expect(page.getByRole("radio", { name: visibility === "private" ? "Private" : "Public", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Change audience" }).click();
    await expect(page.getByRole("radio", { name: visibility === "private" ? "Private" : "Public", exact: true })).toBeFocused();
    await page.getByRole("button", { name: visibility === "private" ? "Ask privately" : "Ask publicly" }).click();
    await expect(page.locator("#question-error")).toContainText("Submission captured");
    expect(submitted?.visibility).toBe(visibility);
  });
}

test("a guest can choose private before writing and retain that choice through sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Private", exact: true }).check();
  await expect(page.locator("#question-privacy")).toContainText("Philagora administrators");
  await page.getByLabel("Your question for the philosophers").fill("What should I make more time for in my life?");
  await page.route("**/api/agora/suggest", (route) => route.fulfill({ json: matches }));
  await page.getByRole("button", { name: "Find my philosophers" }).click();
  await expect(page.getByRole("button", { name: /Ask (publicly|privately)/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in to ask privately" }).click();
  await expect(page).toHaveURL(/\/sign-in\?/);
  await signInLocally(page);
  await page.goto("/#ask");
  await expect(page.getByRole("radio", { name: "Private", exact: true })).toBeChecked();
  await expect(page.getByLabel("Your question for the philosophers")).toHaveValue("What should I make more time for in my life?");
  await expect(page.getByRole("button", { name: "Ask privately" })).toBeEnabled();
});
