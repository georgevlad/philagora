/**
 * Content type templates — structural instructions layered on top of
 * each philosopher's system prompt at generation time.
 */

// ── Variable length support ─────────────────────────────────────────

export type TargetLength = "short" | "medium" | "long";

const STANDARD_LENGTHS: Record<TargetLength, string> = {
  short: "STRICT LENGTH: 30–50 words. Maximum 2 sentences. Be brutally concise — one piercing observation, no elaboration, no preamble, no conclusion. Think tweet, not essay.",
  medium: "Length: 80–150 words. A developed reaction with nuance.",
  long: "Length: 150–250 words. A deeper analysis with more nuance. Multiple paragraphs allowed.",
};

const REFLECTION_LENGTHS: Record<TargetLength, string> = {
  short: "STRICT LENGTH: 30–50 words. Maximum 2 sentences. Be brutally concise — one piercing insight, no elaboration, no preamble, no conclusion. Think tweet, not essay.",
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

STRUCTURE — follow these steps in order:
1. HOOK: Open with a blunt claim or reframing question. Maximum 12 words. This is your headline — make it land.
2. REFRAME: Connect the article to your philosophical framework. Show the reader what they're missing: "You think this is about X; it is about Y."
3. ANCHOR: Reference one specific concrete detail from the source article — a quote, a number, a name, a fact. Ground your argument in the material.
4. VERDICT: State your position and give one reason. Be direct.
5. EXIT: End with either a provocative question to the reader OR a direct challenge to a named philosopher from the Philagora roster.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- The citation details (article title, source, URL) will be stored separately — do NOT include them in your content
- EPISTEMIC SAFETY: If the source material contains unverified claims or breaking news, argue conditionally — say what your position WOULD be if the facts hold. Never state contested facts as settled.

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

STRUCTURE — follow these steps in order:
1. HOOK: Open with a provocative observation or paradox. Maximum 12 words. Arrest the reader's attention immediately.
2. DEVELOPMENT: Explore one core insight through your characteristic voice. Use your rhetorical patterns, your key concepts, your way of seeing. Direct address to the reader — use "you."
3. PAYOFF: Land on a concrete reframe or implication the reader can carry with them. Not a vague platitude — something that changes how they see the next hour of their day.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- Should feel like something that could be read in any era
- No throat-clearing, no preamble. The hook IS the opening line.

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
TASK: Respond to another philosopher's post. This is a dialogue, not parallel monologues.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- Start with @PhilosopherName (the name of the philosopher you are replying to)
- HOOK: Open with the most interesting point of disagreement or complication — not a polite summary of what they said
- ENGAGE: Quote or paraphrase one specific claim from their post, then respond directly to it. Show you actually read them.
- ADVANCE: Introduce exactly one new point, distinction, or argument that wasn't in your previous posts or theirs. Move the conversation forward.
- Do NOT just restate your own general position. React to THEIR specifics.

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
TASK: You are participating in a structured philosophical debate on Philagora. The debate topic and trigger article are provided below. Present your opening position.

STRUCTURE — follow these steps in order:
1. OPENING HOOK: A bold claim or framing question that establishes the stakes. 1-2 sentences. Make the reader understand immediately why this matters.
2. FRAMEWORK: Apply your philosophical lens to the topic. This is your core argument — what does your tradition reveal that others miss? Be specific and substantive.
3. ANCHOR: Reference at least one specific aspect of the trigger article — a fact, a quote, a detail. Ground the abstraction.
4. CHALLENGE: End by naming the tension another philosopher in this debate will have to address. Set up the clash.

REQUIREMENTS:
- Length: 150–250 words. Be substantive — this is your opening statement.
- You may use paragraph breaks for structure.

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text:
{
  "content": "Your opening statement (150-250 words)"
}
`.trim(),
  },

  debate_rebuttal: {
    key: "debate_rebuttal",
    instructions: `
TASK: You are responding to another philosopher's position in a structured debate. Their argument is provided below.

REQUIREMENTS:
- Start with @PhilosopherName
- Length: 100–200 words
- HOOK: Open with the most damaging challenge to their argument, not a polite summary. Lead with your strongest punch.
- MANDATORY CONCESSION: You MUST do exactly one of:
  (a) Concede one specific point they got right and explain why it's strong BEFORE pivoting to your counterargument, OR
  (b) State the strongest version of their argument — stronger than they stated it themselves — before dismantling it.
  This is not optional. Skipping it makes you look like you didn't engage.
- ADVANCE: Introduce at least one NEW point, argument, or distinction. Do not just restate your opening position with different words.
- Identify the weakest link in their reasoning and press on it.

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
- OPEN by directly acknowledging the person's situation in one sentence or less. Show you heard them before you advise. Do NOT open with a lecture or a quote.
- Apply your philosophical framework but translate it into actionable language. Don't just name concepts — show what they mean for THIS person's decision.
- End the first post with one concrete thing the person can do or consider today.
- If writing a second post: add a counterpoint, edge case, or deepened perspective. Do NOT just continue the same argument — complicate it, qualify it, or flip the lens.
- Speak directly to the person asking.

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
- Open with one sentence that captures the most surprising or consequential disagreement. Do NOT open with a generic summary like "The philosophers discussed X." Lead with the clash.
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
- Open with one sentence that captures the most surprising or consequential disagreement. Do NOT open with a generic summary like "The philosophers discussed X." Lead with the clash.
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
