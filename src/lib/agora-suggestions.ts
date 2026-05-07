/**
 * Suggested Agora questions shown as tappable chips on:
 *   - the homepage feed card (SHORT_PROMPTS)
 *   - the Agora page question composer (REFLECTIVE_PROMPTS)
 *
 * Each entry is tagged with a category so the picker can enforce diversity
 * within a single draw (no two chips from the same category until categories
 * are exhausted).
 *
 * Both pools are picked client-side on each page load (see pickAgoraSuggestions).
 */

export type AgoraSuggestionCategory =
  | "self_knowledge"
  | "ethics"
  | "politics"
  | "meaning"
  | "relationships"
  | "mortality"
  | "work"
  | "emotion"
  | "art"
  | "nostalgia";

export interface AgoraSuggestion {
  text: string;
  category: AgoraSuggestionCategory;
}

/** Short, punchy prompts for the homepage feed card chips (~5-9 words). */
export const SHORT_PROMPTS: readonly AgoraSuggestion[] = [
  { text: "What do I do with my anger?", category: "emotion" },
  { text: "How do I know what I actually want?", category: "self_knowledge" },
  { text: "When is it right to lie?", category: "ethics" },
  { text: "Should I care about politics?", category: "politics" },
  { text: "Does my work actually matter?", category: "work" },
  { text: "How do I know if a friendship is real?", category: "relationships" },
  { text: "Why am I never satisfied?", category: "meaning" },
  { text: "Am I the person I think I am?", category: "self_knowledge" },
  { text: "What should I do with the time I have?", category: "mortality" },
  { text: "Is it wrong to keep a secret?", category: "ethics" },
  { text: "Do I owe my parents my life?", category: "relationships" },
  { text: "Should I quit a job I'm good at?", category: "work" },
  { text: "Why does success feel hollow?", category: "meaning" },
  { text: "How do I forgive myself?", category: "self_knowledge" },
  { text: "What do I do with envy?", category: "emotion" },
  { text: "Is loneliness always bad?", category: "emotion" },
  { text: "Can I be a good person and rich?", category: "ethics" },
  { text: "Why do I keep doing what I hate?", category: "self_knowledge" },
  { text: "How honest should I really be?", category: "relationships" },
  { text: "Is it okay to want a small life?", category: "meaning" },
  { text: "Do I have to vote?", category: "politics" },
  { text: "How do I sit with grief?", category: "emotion" },
  { text: "Does ambition make me a bad person?", category: "work" },
  { text: "How do I know when to give up?", category: "self_knowledge" },
  { text: "Will what I do today matter in a hundred years?", category: "mortality" },
];

/** Longer, reflective prompts for the Agora page chips (~10-16 words). */
export const REFLECTIVE_PROMPTS: readonly AgoraSuggestion[] = [
  { text: "Why do we feel nostalgic for times that weren't even that good?", category: "nostalgia" },
  { text: "Should we forgive people who haven't asked for forgiveness?", category: "ethics" },
  { text: "Is it okay to enjoy bad art?", category: "art" },
  {
    text: "How do you know if you've actually changed, or just rearranged your defenses?",
    category: "self_knowledge",
  },
  { text: "If you knew exactly when you would die, would you live differently?", category: "mortality" },
  { text: "Is it dishonest to be kind to someone you don't respect?", category: "ethics" },
  { text: "Why do we resent the people who help us?", category: "emotion" },
  { text: "Should you tell a friend a truth that will hurt them?", category: "relationships" },
  { text: "Is it possible to live a meaningful life without ever being noticed?", category: "meaning" },
  { text: "Why does revenge feel so satisfying when we know it shouldn't?", category: "emotion" },
  {
    text: "Are we the same person we were ten years ago, or only continuous memories?",
    category: "self_knowledge",
  },
  { text: "Is voting against your own interests ever rational?", category: "politics" },
  { text: "Why do we keep working harder for things we already have enough of?", category: "work" },
  {
    text: "Why do we pay strangers to sing about heartbreak we won't discuss ourselves?",
    category: "art",
  },
  { text: "Does mourning honor the dead or only comfort the living?", category: "mortality" },
  { text: "Can a good person hold a job that requires daily compromise?", category: "work" },
  { text: "Why is it so much easier to forgive a stranger than family?", category: "relationships" },
  { text: "Why do we lie to ourselves about what we want?", category: "self_knowledge" },
  { text: "Is contentment a kind of cowardice or a form of wisdom?", category: "meaning" },
  { text: "Why does watching others suffer in fiction make us feel better?", category: "emotion" },
  { text: "Do we owe anything to people who lived a hundred years before us?", category: "politics" },
  { text: "Should we judge an artist's work by the kind of person they were?", category: "art" },
  {
    text: "Is it possible to truly know another person, or only versions of them?",
    category: "relationships",
  },
  { text: "How do you tell the difference between intuition and prejudice?", category: "ethics" },
  { text: "Why do we want to be remembered by people we will never meet?", category: "meaning" },
];

/**
 * Returns `count` suggestions from the pool, with category diversity:
 * - No two returned suggestions share a category until every category in the
 *   pool has appeared at least once.
 * - Within those constraints, the result is uniformly shuffled.
 *
 * Pure function. Pass an `rng` (defaults to Math.random) so tests can be
 * deterministic.
 */
export function pickAgoraSuggestions(
  pool: readonly AgoraSuggestion[],
  count: number,
  rng: () => number = Math.random
): AgoraSuggestion[] {
  if (count <= 0 || pool.length === 0) return [];

  const byCategory = new Map<AgoraSuggestionCategory, AgoraSuggestion[]>();
  for (const suggestion of pool) {
    const list = byCategory.get(suggestion.category) ?? [];
    list.push(suggestion);
    byCategory.set(suggestion.category, list);
  }

  for (const list of byCategory.values()) {
    shuffleInPlace(list, rng);
  }

  const result: AgoraSuggestion[] = [];
  const categoriesAvailable = () =>
    Array.from(byCategory.entries()).filter(([, list]) => list.length > 0);

  while (result.length < count) {
    const available = categoriesAvailable();
    if (available.length === 0) break;

    const order = available.map(([cat]) => cat);
    shuffleInPlace(order, rng);

    for (const category of order) {
      if (result.length >= count) break;
      const list = byCategory.get(category);
      if (!list || list.length === 0) continue;
      const next = list.pop();
      if (next) result.push(next);
    }
  }

  return result;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
