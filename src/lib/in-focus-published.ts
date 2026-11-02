import { ukraineAirDefence } from "@/content/in-focus/ukraine-air-defence";
import type { FocusEdition } from "@/lib/in-focus-publication";

// Explicit publication registry: private experiments are never queried by public pages.
// A subsequent publication requires a reviewed edition added here, not a change of draft selection.
const publications = [{
  edition: ukraineAirDefence,
  experimentId: "f98a9aa1-e3af-4a81-af01-de83cba686f1",
  selectedVersions: {
    briefing: "34269385-1893-4882-96f7-7022b789e964",
    argument: "81d6bfef-b8ea-4dbb-bee8-e7c5897d030a",
    challenge: "cf7dfcb2-67a9-44b4-8162-5846d180bad9",
    reply: "6d450452-153b-4239-a7d7-a09ed34217e6",
  },
}];

export function getPublishedFocusEditions(): FocusEdition[] {
  return publications.map(({ edition }) => structuredClone(edition));
}

export function getPublishedFocusEdition(slug: string): FocusEdition | null {
  const publication = publications.find(({ edition }) => edition.slug === slug);
  return publication ? structuredClone(publication.edition) : null;
}

export function getFeaturedFocusEdition(): FocusEdition {
  return structuredClone(publications[0].edition);
}

export function getFocusEditionForExperiment(experimentId: string): FocusEdition | null {
  const publication = publications.find((entry) => entry.experimentId === experimentId);
  return publication ? structuredClone(publication.edition) : null;
}
