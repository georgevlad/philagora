/**
 * Content type templates — structural instructions layered on top of
 * each philosopher's system prompt at generation time.
 */

export type ContentTypeKey =
  | "news_reaction"
  | "timeless_reflection"
  | "cross_philosopher_reply"
  | "debate_opening"
  | "debate_rebuttal"
  | "agora_response";

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
- Length: 80–150 words
- Write in your authentic philosophical voice
- Engage directly with the substance of the article
- The citation details (article title, source, URL) will be stored separately — do NOT include them in your content

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your reaction to the article (80-150 words)",
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
- Length: 60–120 words
- Direct address to the reader — use "you"
- Write in your most characteristic voice
- Should feel like something that could be read in any era

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your timeless reflection (60-120 words)",
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
- Length: 80–150 words
- Start with @PhilosopherName (the name of the philosopher you are replying to)
- Engage with their SPECIFIC claims, not just your own general position
- Show genuine philosophical engagement — this is a dialogue, not parallel monologues

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your reply starting with @PhilosopherName (80-150 words)",
  "thesis": "One sentence summarizing your response",
  "stance": "challenges | defends | reframes | questions | warns | observes",
  "tag": "Cross-Philosopher Reply"
}
`.trim(),
  },

  debate_opening: {
    key: "debate_opening",
    instructions: `
TASK: Present your opening position on the given debate topic. This is a formal debate opening statement.

REQUIREMENTS:
- Length: 150–250 words
- More formal and structured than a regular post
- Present your core argument clearly
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
TASK: Respond to another philosopher's debate position. This is a formal rebuttal.

REQUIREMENTS:
- Length: 100–200 words
- Start with @PhilosopherName
- Engage with their SPECIFIC claims — do not just restate your own position
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
TASK: Respond to a user's personal dilemma or philosophical question.

REQUIREMENTS:
- Generate 1–2 response posts (each 100–200 words)
- Apply your philosophical framework but stay grounded in their SPECIFIC situation
- Be genuinely helpful — not just theoretical
- Speak directly to the person asking
- First post: address their core concern; second post (if included): add nuance or a practical takeaway

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "posts": ["First response (100-200 words)", "Optional second response (100-200 words)"]
}
`.trim(),
  },
};
