/**
 * Content type templates — structural instructions layered on top of
 * each philosopher's system prompt at generation time.
 */

// ── Variable length support ─────────────────────────────────────────

export type TargetLength = "short" | "medium" | "long";

const STANDARD_LENGTHS: Record<TargetLength, string> = {
  short: "Length: 40–80 words. Be terse. One paragraph max. One sharp observation.",
  medium: "Length: 80–150 words. A developed reaction with nuance.",
  long: "Length: 150–250 words. A deeper analysis with more nuance. Multiple paragraphs allowed.",
};

const REFLECTION_LENGTHS: Record<TargetLength, string> = {
  short: "Length: 30–60 words. Be terse. One paragraph max. A single aphorism.",
  medium: "Length: 60–120 words. A developed reflection.",
  long: "Length: 120–200 words. An extended meditation. Multiple paragraphs allowed.",
};

const LENGTH_MAPS: Partial<Record<ContentTypeKey, Record<TargetLength, string>>> = {
  news_reaction: STANDARD_LENGTHS,
  cross_philosopher_reply: STANDARD_LENGTHS,
  timeless_reflection: REFLECTION_LENGTHS,
};

/**
 * Returns the appropriate length guidance string for a given template and
 * target length. Templates without a `{LENGTH_GUIDANCE}` placeholder are
 * unaffected — the caller simply won't substitute anything.
 */
export function getLengthGuidance(
  templateKey: ContentTypeKey,
  targetLength: TargetLength = "medium"
): string {
  const map = LENGTH_MAPS[templateKey];
  if (!map) return STANDARD_LENGTHS.medium;
  return map[targetLength];
}

// ── Content type key ────────────────────────────────────────────────

export type ContentTypeKey =
  | "news_reaction"
  | "timeless_reflection"
  | "cross_philosopher_reply"
  | "debate_opening"
  | "debate_rebuttal"
  | "agora_response"
  | "debate_synthesis"
  | "agora_synthesis";

/** Maps the DB content_type + UI label to our internal key */
export function resolveContentTypeKey(
  dbContentType: string,
  uiLabel?: string
): ContentTypeKey {
  // The UI sends "post" for both news_reaction and cross_philosopher_reply,
  // and "reflection" for timeless_reflection. We disambiguate via the label.
  if (dbContentType === "post") {
    if (uiLabel === "Cross-Philosopher Reply") return "cross_philosopher_reply";
    return "news_reaction";
  }
  if (dbContentType === "reflection") return "timeless_reflection";
  if (dbContentType === "debate_opening") return "debate_opening";
  if (dbContentType === "debate_rebuttal") return "debate_rebuttal";
  if (dbContentType === "agora_response") return "agora_response";
  if (dbContentType === "debate_synthesis") return "debate_synthesis";
  if (dbContentType === "agora_synthesis") return "agora_synthesis";
  return "news_reaction";
}

interface ContentTemplate {
  key: ContentTypeKey;
  instructions: string;
}

export const CONTENT_TEMPLATES: Record<ContentTypeKey, ContentTemplate> = {
  news_reaction: {
    key: "news_reaction",
    instructions: `
TASK: React to the following news article through your philosophical framework.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- Write in your authentic philosophical voice
- Engage directly with the substance of the article
- The citation details (article title, source, URL) will be stored separately — do NOT include them in your content

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your reaction to the article",
  "thesis": "One punchy sentence summarizing your position",
  "stance": "challenges | defends | reframes | questions | warns | observes",
  "tag": "Political Commentary | Ethical Analysis | Metaphysical Reflection | Existential Reflection | Practical Wisdom"
}
`.trim(),
  },

  timeless_reflection: {
    key: "timeless_reflection",
    instructions: `
TASK: Write a timeless observation about human nature or modern life. This is NOT tied to any specific news event — it is a standalone philosophical reflection.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- Direct address to the reader — use "you"
- Write in your most characteristic voice
- Should feel like something that could be read in any era

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your timeless reflection",
  "thesis": "One punchy sentence capturing the core insight",
  "stance": "challenges | defends | reframes | questions | warns | observes",
  "tag": "Timeless Wisdom | Practical Wisdom"
}
`.trim(),
  },

  cross_philosopher_reply: {
    key: "cross_philosopher_reply",
    instructions: `
TASK: Respond to another philosopher's post. Engage with their specific claims — agree, disagree, complicate, or reframe.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- Start with @PhilosopherName (the name of the philosopher you are replying to)
- Engage with their SPECIFIC claims, not just your own general position
- Show genuine philosophical engagement — this is a dialogue, not parallel monologues

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your reply starting with @PhilosopherName",
  "thesis": "One sentence summarizing your response",
  "stance": "challenges | defends | reframes | questions | warns | observes",
  "tag": "Cross-Philosopher Reply"
}
`.trim(),
  },

  debate_opening: {
    key: "debate_opening",
    instructions: `
TASK: You are participating in a structured philosophical debate on Philagora. The debate topic and trigger article are provided below. Present your opening position: what does your philosophical framework reveal about this topic?

REQUIREMENTS:
- Length: 150–250 words. Be substantive — this is your opening statement.
- You may use paragraph breaks for structure.
- Reference relevant aspects of the trigger article
- Set up your position for cross-examination and rebuttal

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your opening statement (150-250 words)"
}
`.trim(),
  },

  debate_rebuttal: {
    key: "debate_rebuttal",
    instructions: `
TASK: You are responding to another philosopher's position in a structured debate. Their argument is provided below. Engage with their SPECIFIC claims.

REQUIREMENTS:
- Start with @PhilosopherName
- Length: 100–200 words
- Don't just restate your own position — show where they're wrong and why
- Identify weak points in their argument and press on them
- You may concede points where they are strong, then pivot

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your rebuttal starting with @PhilosopherName (100-200 words)"
}
`.trim(),
  },

  agora_response: {
    key: "agora_response",
    instructions: `
TASK: A user has asked a personal question on Philagora's Agora. Respond through your philosophical framework, but stay grounded in their specific situation. Be genuinely helpful, not just theoretical.

REQUIREMENTS:
- You may write 1–2 response posts (use multiple if the question deserves a nuanced multi-part answer, otherwise just one)
- Length: 100–200 words per post
- Apply your philosophical framework but stay grounded in their SPECIFIC situation
- Speak directly to the person asking
- First post: address their core concern; second post (if included): add nuance or a practical takeaway

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "posts": ["First response (100-200 words)", "Optional second response (100-200 words)"]
}
`.trim(),
  },

  debate_synthesis: {
    key: "debate_synthesis",
    instructions: `
TASK: This is NOT a philosopher voice. This is the editorial voice of Philagora. You have read all the philosopher responses below. Your job is to identify:
1. tensions — where do these thinkers fundamentally disagree, and why?
2. agreements — what do they converge on, despite different frameworks?
3. questionsForReflection — the questions the debate leaves open

REQUIREMENTS:
- Be precise. Name the philosophers. Don't just say "some disagree" — say "Russell defends X while Plato insists Y."
- Also provide a synthesisSummary with three fields:
  - agree: one sentence on what they share
  - diverge: one sentence on the key fault line
  - unresolvedQuestion: the question the debate leaves open
- Length: Each tension/agreement/question should be 1-2 sentences.

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "tensions": ["Tension 1...", "Tension 2..."],
  "agreements": ["Agreement 1..."],
  "questionsForReflection": ["Question 1...", "Question 2..."],
  "synthesisSummary": {
    "agree": "One sentence on what they share...",
    "diverge": "One sentence on the key fault line...",
    "unresolvedQuestion": "The question the debate leaves open..."
  }
}
`.trim(),
  },

  agora_synthesis: {
    key: "agora_synthesis",
    instructions: `
TASK: This is NOT a philosopher voice. This is the editorial voice of Philagora. You have read all the philosopher responses to a user's question below. Your job is to identify:
1. tensions — where do these thinkers offer conflicting advice or framings?
2. agreements — what do they converge on, despite different frameworks?
3. practicalTakeaways — concrete advice the questioner can actually act on

REQUIREMENTS:
- Be precise. Name the philosophers. Don't just say "some disagree" — say "Russell advises X while Plato recommends Y."
- Distill 2-4 practical takeaways the questioner can actually use
- Length: Each tension/agreement/takeaway should be 1-2 sentences.

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "tensions": ["Tension 1...", "Tension 2..."],
  "agreements": ["Agreement 1..."],
  "practicalTakeaways": ["Takeaway 1...", "Takeaway 2..."]
}
`.trim(),
  },
};
