// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GenerationSettingsPage from "./generation-settings/page";
import ScoringSettingsPage from "./scoring/page";
import NewsScoutPage from "./news-scout/page";
import ApiLogsPage from "./api-logs/page";
import ContentGenerationPage from "./content/page";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { ReviewGroup } from "./daily/ReviewGroup";
import type { ReviewItem } from "./daily/types";
import {
  DEFAULT_SCORING_MODEL,
  DEFAULT_SCORE_TIERS,
  DEFAULT_STANCE_GUIDANCE,
  DEFAULT_TENSION_VOCABULARY,
  DEFAULT_GENERATION_MODEL,
  DEFAULT_IMAGE_GENERATION_MODEL,
  GENERATION_MODEL_OPTIONS,
} from "@/lib/scoring-config";

const { router, searchParams } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn() },
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", props, children),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function render(component: React.ReactElement) {
  await act(async () => root.render(component));
}

async function change(element: HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
  await act(async () => {
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

function button(label: string) {
  const found = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  expect(found, `Missing button: ${label}`).toBeDefined();
  return found!;
}

describe("admin UI regressions", () => {
  it.each([ScoringSettingsPage, GenerationSettingsPage])("only reports unsaved settings after an edit when the API returns other sections (%#)", async (Page) => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      scoring_model: DEFAULT_SCORING_MODEL,
      score_tiers: DEFAULT_SCORE_TIERS,
      tension_vocabulary: DEFAULT_TENSION_VOCABULARY,
      stance_guidance: DEFAULT_STANCE_GUIDANCE,
      generation_model: DEFAULT_GENERATION_MODEL,
      synthesis_model: DEFAULT_GENERATION_MODEL,
      image_generation_model: DEFAULT_IMAGE_GENERATION_MODEL,
      mood_enabled: true,
      mood_content_types: ["news_reaction"],
    })));
    await render(React.createElement(Page));
    expect(container.textContent).not.toContain("Unsaved changes.");
    const model = container.querySelector("select")!;
    const alternative = [...model.options].find((option) => option.value !== model.value)!;
    await change(model, alternative.value);
    expect(container.textContent).toContain("Unsaved changes.");
  });

  it("keeps an unsaved synthesis model when saving the content model", async () => {
    const config = {
      generation_model: DEFAULT_GENERATION_MODEL,
      synthesis_model: DEFAULT_GENERATION_MODEL,
      image_generation_model: DEFAULT_IMAGE_GENERATION_MODEL,
    };
    const fetchMock = vi.fn(async () => json(config));
    vi.stubGlobal("fetch", fetchMock);
    await render(React.createElement(GenerationSettingsPage));

    const selects = container.querySelectorAll("select");
    const alternative = GENERATION_MODEL_OPTIONS.find((option) => option.value !== DEFAULT_GENERATION_MODEL)!;
    await change(selects[1], alternative.value);
    await act(async () => button("Save Model").click());

    expect(selects[1].value).toBe(alternative.value);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/scoring-config", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ key: "generation_model", value: DEFAULT_GENERATION_MODEL }),
    }));
  });

  it("reloads News Scout candidates on the first filter change", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/philosophers") return json([]);
      if (url === "/api/admin/news-scout") return json({ stats: {} });
      if (url.includes("status=all&limit=500")) return json([]);
      return json({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await render(React.createElement(NewsScoutPage));

    const approved = [...container.querySelectorAll("button")].find((item) => /^approved/i.test(item.textContent?.trim() ?? ""));
    expect(approved).toBeDefined();
    await act(async () => approved!.click());

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("candidates?status=approved"))).toBe(true);
  });

  it("keeps News Scout usable when its optional overview request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/philosophers") return json([]);
      if (url === "/api/admin/news-scout") return json({ stats: {} });
      if (url.includes("status=all&limit=500")) return json({ error: "Unavailable" }, 500);
      return json({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
    }));
    await render(React.createElement(NewsScoutPage));
    expect(container.querySelector("h1")?.textContent).toBe("News Scout");
  });

  it("retains a generated preview when rejection fails so the editor can retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/philosophers") {
        return json([{ id: "plato", name: "Plato", tradition: "Idealism", color: "#333333", initials: "PL" }]);
      }
      if (init?.method === "POST") {
        return json({ generated: { content: "A generated thought", thesis: "Consider justice", stance: "observes" }, log_entry: { id: 1 } });
      }
      if (init?.method === "PATCH") return json({ error: "Unavailable" }, 500);
      return json([]);
    }));
    await render(React.createElement(ContentGenerationPage));
    await change(container.querySelector<HTMLSelectElement>("#philosopher")!, "plato");
    await change(container.querySelector<HTMLTextAreaElement>("#user-input")!, "A question about justice");
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const reject = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes("Reject"));
    expect(reject).toBeDefined();
    await act(async () => reject!.click());

    expect(container.textContent).toContain("A generated thought");
    expect(container.textContent).toContain("Failed to reject the generated content");
    expect(reject!.disabled).toBe(false);
  });

  it.each(["2", "3"])("saves generated content type %s as a reflection source", async (contentType) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/philosophers") {
        return json([{ id: "plato", name: "Plato", tradition: "Idealism", color: "#333333", initials: "PL" }]);
      }
      if (url === "/api/admin/posts" || init?.method === "PATCH") return json({ success: true });
      if (init?.method === "POST") {
        return json({ generated: { content: "A generated thought", thesis: "Consider justice", stance: "observes" }, log_entry: { id: 1 } });
      }
      return json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    await render(React.createElement(ContentGenerationPage));
    await change(container.querySelector<HTMLSelectElement>("#philosopher")!, "plato");
    await change(container.querySelector<HTMLSelectElement>("#content-type")!, contentType);
    await change(container.querySelector<HTMLTextAreaElement>("#user-input")!, "A thought about justice");
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => button("Save as draft").click());
    const postCall = fetchMock.mock.calls.find(([url]) => url === "/api/admin/posts");
    expect(JSON.parse(String(postCall?.[1]?.body)).source_type).toBe("reflection");
  });

  it("refreshes API logs through one request after clearing old entries", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return json({ deleted: 3 });
      return json({ logs: [], total: 0, stats: { total_calls: 0 }, limit: 50, offset: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await render(React.createElement(ApiLogsPage));
    await act(async () => button("Clear old logs").click());
    expect(fetchMock.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2);
    expect(container.textContent).toContain("Deleted 3 old log entries");
  });

  it("shows a retryable logout error without navigating on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Unavailable" }, 500)));
    await render(React.createElement(AdminLogoutButton));
    await act(async () => button("Sign out").click());
    expect(router.push).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not sign out");
    expect(button("Sign out").disabled).toBe(false);
  });

  it("exposes the full draft and blocks item actions while review is busy", async () => {
    const item: ReviewItem = {
      type: "news_reaction", post_id: "post", generation_log_id: 1,
      philosopher_id: "plato", philosopher_name: "Plato",
      content: `${"A long draft. ".repeat(35)}The final sentence.`, thesis: "A thesis",
      stance: "observes", tag: "Ethics", length: "medium", status: "draft",
    };
    const onPublish = vi.fn();
    await render(React.createElement(ReviewGroup, {
      title: "Drafts", description: "Review drafts", items: [item], busyItemId: null,
      actionsDisabled: true, selectedDraftIds: [], onToggleSelection: vi.fn(),
      onPublish, onDelete: vi.fn(), onRegenerate: vi.fn(),
    }));
    expect(container.querySelector("details p")?.textContent).toBe(item.content);
    expect(button("Publish").disabled).toBe(true);
    await act(async () => button("Publish").click());
    expect(onPublish).not.toHaveBeenCalled();
  });
});
