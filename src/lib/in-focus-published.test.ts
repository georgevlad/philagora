import { describe, expect, it, vi } from "vitest";
import { getFeaturedFocusEdition, getPublishedFocusEdition, getPublishedFocusEditions, getFocusEditionForExperiment } from "./in-focus-published";
import { focusEditionPath, focusReadingMinutes } from "./in-focus-publication";

vi.mock("@/lib/db", () => { throw new Error("Public editions must not read private workshop data"); });

describe("reviewed In Focus publications", () => {
  it("exposes only registered public slugs, never an experiment ID", () => {
    const edition = getFeaturedFocusEdition();
    expect(getPublishedFocusEdition(edition.slug)).toEqual(edition);
    expect(getPublishedFocusEdition("f98a9aa1-e3af-4a81-af01-de83cba686f1")).toBeNull();
    expect(getPublishedFocusEdition("a-private-draft")).toBeNull();
    expect(getFocusEditionForExperiment("a-private-draft")).toBeNull();
    expect(getFocusEditionForExperiment("f98a9aa1-e3af-4a81-af01-de83cba686f1")).toEqual(edition);
    expect(focusEditionPath(edition)).toBe("/in-focus/ukraine-air-defence-and-the-duty-to-help");
    expect(edition).not.toHaveProperty("selectedVersions");
    expect(edition).not.toHaveProperty("experimentId");
    expect(edition).not.toHaveProperty("snapshot");
    expect(edition.sources.every(source => !("excerpt" in source))).toBe(true);
  });

  it("returns detached editions so preview edits cannot change the publication", () => {
    const original = getFeaturedFocusEdition();
    const preview = getFocusEditionForExperiment("f98a9aa1-e3af-4a81-af01-de83cba686f1")!;
    preview.title = "Private revision";
    preview.exchange[0].paragraphs[0] = "Unreviewed text";
    preview.sources[0].title = "Private notes";
    expect(getFeaturedFocusEdition()).toEqual(original);
  });

  it("keeps every factual source marker resolvable and dates within the research cutoff", () => {
    for (const edition of getPublishedFocusEditions()) {
      const ids = edition.sources.map(source => source.id);
      expect(new Set(ids).size).toBe(ids.length);
      const prose = [...edition.briefing, ...edition.background.flatMap(section => section.paragraphs),
        ...edition.exchange.flatMap(part => part.paragraphs), ...edition.unresolved.paragraphs].join(" ");
      for (const match of prose.matchAll(/\[(S\d+)\]/g)) expect(ids).toContain(match[1]);
      for (const source of edition.sources) {
        expect(new URL(source.url).protocol).toBe("https:");
        if (source.date) expect(source.date <= edition.asOf).toBe(true);
        expect(prose).toContain("[" + source.id + "]");
      }
      expect(edition.exchange.map(part => part.philosopher.id)).toEqual(["kant", "russell", "kant"]);
      expect(focusReadingMinutes(edition)).toBeGreaterThanOrEqual(4);
      expect(focusReadingMinutes(edition)).toBeLessThanOrEqual(8);
    }
  });
});
