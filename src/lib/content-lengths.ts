import type { ContentTypeKey, TargetLength } from "@/lib/content-template-defaults";

export interface LengthBudget { min: number; max: number }
type Lengths = Record<TargetLength, LengthBudget>;
const range = (min: number, max: number): LengthBudget => ({ min, max });
const lengths = (short: LengthBudget, medium: LengthBudget, long: LengthBudget): Lengths => ({ short, medium, long });
const COMMENTARY = lengths(range(40, 70), range(70, 100), range(100, 140));

const BUDGETS: Partial<Record<ContentTypeKey, Lengths>> = {
  news_reaction: lengths(range(30, 50), range(50, 75), range(75, 100)),
  cross_philosopher_reply: lengths(range(20, 40), range(40, 60), range(60, 80)),
  quip: lengths(range(10, 20), range(10, 25), range(10, 25)),
  timeless_reflection: lengths(range(25, 45), range(45, 65), range(65, 90)),
  everyday_reaction: lengths(range(25, 45), range(45, 65), range(65, 90)),
  historical_reaction: COMMENTARY,
  cultural_recommendation: COMMENTARY,
  art_commentary: COMMENTARY,
  agora_response: lengths(range(50, 80), range(50, 80), range(50, 80)),
  debate_opening: lengths(range(80, 110), range(80, 110), range(80, 110)),
  debate_rebuttal: lengths(range(40, 60), range(40, 60), range(40, 60)),
  agora_synthesis: lengths(range(30, 50), range(30, 50), range(30, 50)),
  debate_synthesis: lengths(range(60, 90), range(60, 90), range(60, 90)),
};

export function getLengthBudget(key: ContentTypeKey, target: TargetLength = "short"): LengthBudget | undefined {
  return BUDGETS[key]?.[target];
}

export function getLengthGuidance(key: ContentTypeKey, target?: TargetLength): string {
  const budget = getLengthBudget(key, target);
  if (!budget) return "Follow the length specified in the task.";
  const field = key.endsWith("_synthesis") ? "across all text fields and list items combined, not per section"
    : key === "agora_response" ? "across all posts combined, not per post" : "in the content field";
  const headroom = key.endsWith("_synthesis")
    ? ` Draft toward ${Math.floor((budget.min + budget.max) / 2)} words total to leave room below the hard maximum. Count names and every populated section; leave optional sections empty instead of filling the budget.` : "";
  return `LENGTH CONTRACT: Aim for ${budget.min}-${budget.max} words ${field}; maximum ${budget.max}. A shorter complete thought is welcome; do not pad to reach the minimum. Use natural sentence lengths, not compressed run-on sentences. Metadata fields do not count toward this limit.${headroom}${key === "agora_response" ? " The posts field must always be a JSON array of strings, even for one post: {\"posts\":[\"Your response\"]}. Default to one post. Use at most two only when the second adds a distinct point within the same total budget." : ""}`;
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Checks only prose, not thesis/tag/citation metadata. Never truncates prose or JSON. */
export function getLengthViolation(key: ContentTypeKey, data: Record<string, unknown>, target?: TargetLength): string | null {
  const budget = getLengthBudget(key, target);
  if (!budget) return null;
  if (key === "agora_synthesis" || key === "debate_synthesis") {
    const arrays = key === "debate_synthesis" ? ["tensions", "agreements", "questionsForReflection"]
      : ["tensions", "agreements", "practicalTakeaways", "frameworkComparison", "deeperQuestions", "commonGround"];
    const texts = key === "agora_synthesis" ? ["keyInsight", "centralFaultLine", "whatIsAtStake"] : [];
    for (const field of arrays) {
      if (data[field] !== undefined && (!Array.isArray(data[field]) || data[field].some(item => typeof item !== "string"))) return `Return an array of strings for ${field}.`;
    }
    for (const field of texts) {
      if (data[field] !== undefined && typeof data[field] !== "string") return `Return a string for ${field}.`;
    }
    if (key === "debate_synthesis" && data.synthesisSummary !== undefined) {
      const summary = data.synthesisSummary;
      if (!summary || typeof summary !== "object" || Array.isArray(summary)
        || Object.values(summary).some(item => typeof item !== "string")) return "Return text fields in synthesisSummary.";
    }
    const knownFields = [...arrays, ...texts, ...(key === "debate_synthesis" ? ["synthesisSummary"] : [])];
    if (!knownFields.some(field => countSynthesisWords(data[field]) > 0)) return "Return at least one nonempty synthesis section in the required format.";
    const words = countSynthesisWords(data);
    if (!words) return "Return a synthesis with at least one nonempty text field in the required format.";
    return words > budget.max ? `The synthesis contains ${words} words across all fields; the maximum total is ${budget.max}.` : null;
  }
  if (key === "agora_response") {
    if (!Array.isArray(data.posts) || data.posts.length < 1 || data.posts.length > 2 || data.posts.some(p => typeof p !== "string" || !p.trim())) {
      return "Return one or at most two nonempty strings in posts.";
    }
    const words = data.posts.reduce((sum: number, p: string) => sum + countWords(p), 0);
    if (words > budget.max) return `The posts contain ${words} words combined; the maximum total is ${budget.max}.`;
    const recommendation = data.recommendation;
    if (recommendation && typeof recommendation === "object" && "reason" in recommendation
      && typeof recommendation.reason === "string" && countWords(recommendation.reason) > 20) {
      return "Keep the optional recommendation reason to at most 20 words.";
    }
    return null;
  }
  if (typeof data.content !== "string" || !data.content.trim()) return "Return a nonempty content string.";
  const words = countWords(data.content);
  return words > budget.max ? `The content contains ${words} words; the maximum is ${budget.max}.` : null;
}

/** Count prose in nested synthesis fields, never JSON keys or numeric metadata. */
export function countSynthesisWords(value: unknown): number {
  if (typeof value === "string") return countWords(value);
  if (Array.isArray(value)) return value.reduce((total, item) => total + countSynthesisWords(item), 0);
  if (value && typeof value === "object") return Object.values(value).reduce<number>((total, item) => total + countSynthesisWords(item), 0);
  return 0;
}

/** Most automatically chosen posts should fit a brief feed reading. */
export function chooseVariedLength(roll = Math.random()): TargetLength {
  return roll < 0.7 ? "short" : roll < 0.95 ? "medium" : "long";
}
