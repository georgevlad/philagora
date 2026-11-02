/** The public edition contains only reviewed reader-facing material, never workshop prompts or notes. */
export interface FocusEditionSource {
  id: string;
  title: string;
  publisher: string;
  date: string | null;
  url: string;
  note: string;
}

export interface FocusContribution {
  id: string;
  role: "The argument" | "The challenge" | "The reply";
  philosopher: { id: string; name: string; initials: string; color: string; tradition: string };
  heading: string;
  paragraphs: string[];
}

export interface FocusEdition {
  slug: string;
  title: string;
  story: string;
  description: string;
  asOf: string;
  publishedAt: string;
  briefing: string[];
  background: { heading: string; paragraphs: string[] }[];
  uncertainty: string;
  question: string;
  questionNote: string;
  exchange: FocusContribution[];
  unresolved: { heading: string; paragraphs: string[]; questions: string[] };
  sources: FocusEditionSource[];
}

export function focusReadingMinutes(edition: FocusEdition): number {
  const text = [...edition.briefing, edition.question, ...edition.exchange.flatMap((part) => part.paragraphs),
    ...edition.unresolved.paragraphs, ...edition.unresolved.questions].join(" ");
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

export function focusEditionPath(edition: Pick<FocusEdition, "slug">): string {
  return `/in-focus/${edition.slug}`;
}
