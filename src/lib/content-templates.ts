/**
 * Content type templates - structural instructions layered on top of
 * each philosopher's system prompt at generation time.
 */

import { getDb } from "@/lib/db";
import type { AgoraQuestionType } from "@/lib/types";

export type TargetLength = "short" | "medium" | "long";

const STANDARD_LENGTHS: Record<TargetLength, string> = {
  short:
    "STRICT LENGTH: 40-70 words. Maximum 3 sentences. One take, grounded in one detail, done.",
  medium:
    "Length: 70-120 words. 3-4 sentences. A developed take with room for one turn of thought — but still a remark, not an essay.",
  long:
    "Length: 120-200 words. A deeper take with nuance. Multiple paragraphs allowed, but earn every sentence.",
};

const REFLECTION_LENGTHS: Record<TargetLength, string> = {
  short:
    "STRICT LENGTH: 30-50 words. Maximum 2 sentences. Be brutally concise - one piercing insight, no elaboration, no preamble, no conclusion. Think tweet, not essay.",
  medium: "Length: 60-120 words. A developed reflection.",
  long: "Length: 120-200 words. An extended meditation. Multiple paragraphs allowed.",
};

const RECOMMENDATION_LENGTHS: Record<TargetLength, string> = {
  short:
    "STRICT LENGTH: 50-80 words. Maximum 3 sentences. Name the work, say why through your philosophy, and stop.",
  medium:
    "Length: 80-150 words. Name the work, ground it in your philosophy, make the reader want to experience it.",
  long:
    "Length: 150-250 words. A developed recommendation with philosophical depth. Multiple paragraphs allowed.",
};

const EVERYDAY_LENGTHS: Record<TargetLength, string> = {
  short:
    "STRICT LENGTH: 40-70 words. Maximum 3 sentences. Be sharp and concise - one philosophical observation, developed just enough to land. Think barbed cocktail-party remark, not essay.",
  medium: "Length: 70-120 words. A developed reaction with room for one turn of thought.",
  long: "Length: 120-180 words. A fuller take - but still conversational, not essayistic.",
};

export type ContentTypeKey =
  | "news_reaction"
  | "quip"
  | "timeless_reflection"
  | "cross_philosopher_reply"
  | "historical_reaction"
  | "everyday_reaction"
  | "cultural_recommendation"
  | "debate_opening"
  | "debate_rebuttal"
  | "agora_response"
  | "debate_synthesis"
  | "agora_synthesis";

const LENGTH_MAPS: Partial<Record<ContentTypeKey, Record<TargetLength, string>>> = {
  news_reaction: {
    short: "STRICT LENGTH: 40-70 words. Maximum 3 sentences. One take, grounded in one detail, done.",
    medium:
      "Length: 70-110 words. 3-4 tight sentences. A developed take — but still a remark, not an essay. No preamble, no summarizing conclusion.",
    long:
      "Length: 70-110 words. 3-4 tight sentences. A developed take — but still a remark, not an essay. No preamble, no summarizing conclusion.",
  },
  quip: {
    short: "STRICT: Maximum 1 sentence, under 20 words.",
    medium: "STRICT: Maximum 1-2 sentences, under 25 words total.",
    long: "STRICT: Maximum 2 sentences, under 30 words total.",
  },
  cross_philosopher_reply: STANDARD_LENGTHS,
  historical_reaction: STANDARD_LENGTHS,
  everyday_reaction: EVERYDAY_LENGTHS,
  timeless_reflection: REFLECTION_LENGTHS,
  cultural_recommendation: RECOMMENDATION_LENGTHS,
};

/**
 * Returns the appropriate length guidance string for a given template and
 * target length. Templates without a `{LENGTH_GUIDANCE}` placeholder are
 * unaffected - the caller simply will not substitute anything.
 */
export function getLengthGuidance(
  templateKey: ContentTypeKey,
  targetLength?: TargetLength
): string {
  const map = LENGTH_MAPS[templateKey];
  if (!map) return STANDARD_LENGTHS.medium;
  const resolvedLength =
    targetLength ??
    (templateKey === "everyday_reaction" || templateKey === "news_reaction" ? "short" : "medium");
  return map[resolvedLength];
}

/** Maps the DB content_type + UI label to our internal key. */
export function resolveContentTypeKey(
  dbContentType: string,
  uiLabel?: string
): ContentTypeKey {
  if (dbContentType === "post") {
    if (uiLabel === "Cross-Philosopher Reply") return "cross_philosopher_reply";
    if (uiLabel === "Historical Reaction" || uiLabel === "historical_reaction") {
      return "historical_reaction";
    }
    if (uiLabel === "Everyday Reaction" || uiLabel === "everyday_reaction") {
      return "everyday_reaction";
    }
    if (uiLabel === "Cultural Recommendation" || uiLabel === "cultural_recommendation") {
      return "cultural_recommendation";
    }
    if (uiLabel === "Quip") return "quip";
    return "news_reaction";
  }
  if (dbContentType === "reflection") return "timeless_reflection";
  if (dbContentType === "recommendation") return "cultural_recommendation";
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

const AGORA_CONCEPTUAL_OVERRIDE = `
TASK: A user has asked a conceptual/philosophical question on Philagora's Agora. Respond through your philosophical framework. Go deep into your tradition's perspective on this question - this is your territory.

REQUIREMENTS:
- You may write 1-2 response posts (use multiple if the question has layers worth unpacking)
- Length: 120-250 words per post
- OPEN by reframing the question through your specific philosophical lens. Show how your tradition sees this differently from common assumptions.
- Develop your framework's answer with precision. Use your key concepts, but make them accessible.
- End with a provocation or a reframing that complicates easy answers - do NOT end with a neat conclusion.
- If writing a second post: explore a tension or paradox within your OWN framework's answer. Show intellectual honesty.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "posts": ["First response (120-250 words)", "Optional second response (120-250 words)"]
}
`.trim();

const AGORA_DEBATE_OVERRIDE = `
TASK: A user has brought a contested question to Philagora's Agora. Take a clear position informed by your philosophical framework.

REQUIREMENTS:
- You may write 1-2 response posts
- Length: 100-200 words per post
- OPEN by stating your position clearly in one sentence.
- Defend it using your philosophical framework - make the strongest case your tradition can make.
- Acknowledge the best counter-argument and explain why your position withstands it.
- Do NOT hedge or try to be balanced. The synthesis will provide balance. Your job is to argue.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "posts": ["First response (100-200 words)", "Optional second response (100-200 words)"]
}
`.trim();

const AGORA_RECOMMENDATION_APPENDIX = `
ADDITIONAL: If a specific work (book, film, essay, album, poem, play, or speech) genuinely speaks to this question from your philosophical perspective, include a recommendation. Only recommend something you would authentically champion - do not force a recommendation if nothing fits.

CRITICAL RECOMMENDATION RULES:
- Your recommendation must reflect YOUR tradition's distinctive lens. Do not recommend the most famous or obvious work on this topic.
- A Stoic should recommend differently than an Existentialist. A Confucian should recommend differently than an Analytic philosopher. If your recommendation could plausibly come from any thinker, it's too generic - dig deeper into your own tradition.
- Prefer works that are surprising but defensible: lesser-known works by major authors, works from adjacent disciplines, works from your own cultural/historical context, or canonical works from YOUR tradition applied unexpectedly to this question.
- NEVER recommend a work that appears in the ALREADY RECOMMENDED list below (if any).

If recommending, add a "recommendation" field to your JSON response:
{
  "posts": ["..."],
  "recommendation": {
    "title": "Work title",
    "medium": "book|film|essay|album|poem|play|podcast|speech",
    "reason": "One sentence on why this work matters here (max 30 words)"
  }
}

If no recommendation fits naturally, omit the "recommendation" field entirely.
`.trim();

const AGORA_SYNTHESIS_ADVICE = `
TASK: Editorial synthesis for a practical/advice question. Identify:
1. tensions - where these thinkers offer conflicting advice or framings
2. agreements - what they converge on despite different frameworks
3. practicalTakeaways - concrete advice the questioner can actually act on

REQUIREMENTS:
- Open with the most surprising or consequential disagreement. Do NOT open with "The philosophers discussed X."
- Be precise. Name the philosophers: "Russell advises X while Plato recommends Y."
- Distill 2-4 practical takeaways the questioner can actually use.
- Length: Each item should be 1-2 sentences.

RESPOND WITH VALID JSON ONLY:
{
  "tensions": ["..."],
  "agreements": ["..."],
  "practicalTakeaways": ["..."]
}
`.trim();

const AGORA_SYNTHESIS_CONCEPTUAL = `
TASK: Editorial synthesis for a conceptual/philosophical question. This is NOT advice - do not force practical takeaways. Instead, identify:
1. keyInsight - the single most striking reframing or unexpected convergence across all responses (2-3 sentences, written as a mini editorial paragraph, not a list item)
2. frameworkComparison - how did the philosophical lenses produce genuinely different answers? Focus on the WHY of their disagreement, not just that they disagree.
3. deeperQuestions - what new, more precise questions emerge from this dialogue? These should be questions the user did NOT originally ask but might now want to explore.

REQUIREMENTS:
- The keyInsight should read like the opening of an editorial essay - vivid, specific, non-obvious.
- frameworkComparison entries should name the philosophers and explain the root of their divergence (tradition, metaphysics, view of human nature).
- deeperQuestions should be genuine follow-ups, not rephrases of the original question.
- Length: keyInsight is 2-3 sentences. Each frameworkComparison and deeperQuestions item is 1-2 sentences.

RESPOND WITH VALID JSON ONLY:
{
  "keyInsight": "...",
  "frameworkComparison": ["..."],
  "deeperQuestions": ["..."]
}
`.trim();

const AGORA_SYNTHESIS_DEBATE = `
TASK: Editorial synthesis for a debate/contested question. Identify:
1. centralFaultLine - the core disagreement in one precise sentence
2. tensions - the specific points where philosophers take opposing positions
3. commonGround - what they agree on despite disagreeing on the main question
4. whatIsAtStake - one sentence on why this disagreement matters beyond philosophy

REQUIREMENTS:
- Open centralFaultLine with the sharpest formulation of the disagreement you can find. Be surgical.
- tensions should name philosophers and be specific about what each argues.
- commonGround should surprise - find agreement where readers might not expect it.
- whatIsAtStake should connect the philosophical disagreement to real consequences.
- Length: centralFaultLine is 1 sentence. Each tension/commonGround item is 1-2 sentences. whatIsAtStake is 1-2 sentences.

RESPOND WITH VALID JSON ONLY:
{
  "centralFaultLine": "...",
  "tensions": ["..."],
  "commonGround": ["..."],
  "whatIsAtStake": "..."
}
`.trim();

export const CONTENT_TEMPLATES: Record<ContentTypeKey, ContentTemplate> = {
  news_reaction: {
    key: "news_reaction",
    instructions: `
TASK: React to the following news article through your philosophical framework.

STRUCTURE - follow these steps in order:
1. HOOK: Open with a blunt claim or reframing question. Maximum 12 words. This is your headline - make it land.
2. REFRAME: Connect the article to your philosophical framework. Show the reader what they are missing: "You think this is about X; it is about Y."
3. ANCHOR: Reference one specific concrete detail from the source article - a quote, a number, a name, a fact. Ground your argument in the material.
4. VERDICT: State your position and give one reason. Be direct.
5. EXIT: End with either a provocative question to the reader OR a direct challenge to a named philosopher from the Philagora roster.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- The citation details (article title, source, URL) will be stored separately - do NOT include them in your content
- EPISTEMIC SAFETY: If the source material contains unverified claims or breaking news, argue conditionally - say what your position WOULD be if the facts hold. Never state contested facts as settled.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "content": "Your reaction to the article",
  "thesis": "One punchy sentence summarizing your position",
  "stance": "challenges | defends | reframes | questions | warns | observes | diagnoses | provokes | laments",
  "tag": "Political Commentary | Ethical Analysis | Metaphysical Reflection | Existential Reflection | Practical Wisdom"
}
`.trim(),
  },

  quip: {
    key: "quip",
    instructions: `
TASK: React to the following headline with a single cutting observation. This is a QUIP - not an analysis.

RULES:
- MAXIMUM 1-2 sentences. Aim for under 25 words. Brevity is everything.
- No preamble, no framework exposition, no "this reveals..." constructions.
- No rhetorical questions unless they ARE the entire quip.
- Channel your sharpest, most characteristic voice. Be witty, be ironic, be devastating.
- If you can reference or subvert one of your own famous ideas, do it - readers who get the allusion will love it.
- You are reacting to the HEADLINE, not writing a mini-essay about the topic.
- The citation details (article title, source, URL) will be stored separately - do NOT include them in your content.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "content": "Your one-liner reaction",
  "thesis": "Same as content for quips - just repeat the line",
  "stance": "quips | mocks | provokes | observes",
  "tag": "Quip"
}
`.trim(),
  },

  timeless_reflection: {
    key: "timeless_reflection",
    instructions: `
TASK: Write a timeless observation about human nature or modern life. This is NOT tied to any specific news event - it is a standalone philosophical reflection.

STRUCTURE - follow these steps in order:
1. HOOK: Open with a provocative observation or paradox. Maximum 12 words. Arrest the reader's attention immediately.
2. DEVELOPMENT: Explore one core insight through your characteristic voice. Use your rhetorical patterns, your key concepts, your way of seeing. Direct address to the reader - use "you."
3. PAYOFF: Land on a concrete reframe or implication the reader can carry with them. Not a vague platitude - something that changes how they see the next hour of their day.

REQUIREMENTS:
- {LENGTH_GUIDANCE}
- Should feel like something that could be read in any era
- No throat-clearing, no preamble. The hook IS the opening line.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "content": "Your timeless reflection",
  "thesis": "One punchy sentence capturing the core insight",
  "stance": "challenges | defends | reframes | questions | warns | observes | diagnoses | provokes | laments",
  "tag": "Timeless Wisdom | Practical Wisdom"
}
`.trim(),
  },

  cultural_recommendation: {
    key: "cultural_recommendation",
    instructions: `
TASK: Recommend a specific work - a film, album, book, or other cultural artifact - in response to the prompt below. This is NOT a review. It is a philosophical argument for WHY this work matters, filtered entirely through your worldview.

PROMPT:
{SOURCE_MATERIAL}

STRUCTURE - follow these steps in order:
1. HOOK: Open with a direct claim about the reader or the human condition. Maximum 15 words. Do NOT open with "I recommend..." or "You should watch..." - that is the boring version.
2. THE WORK: Name the specific work (title, creator/director/author/artist). One sentence.
3. THE CASE: Explain WHY this work matters through your philosophical framework. What does it reveal, confront, or transform? Use your characteristic voice, your key concepts, your way of seeing. This is the heart of the piece - make the reader feel they would be philosophically poorer for missing it.
4. THE CHALLENGE: End with a provocation - what should the reader pay attention to, or what question should they carry into the experience?

CRITICAL CONSTRAINTS:
- {LENGTH_GUIDANCE}
- Recommend ONE specific work only. Not "watch anything by Bergman" - name the exact film/album/book.
- Do NOT pick the most obvious canonical choice for your tradition. Surprise the reader. A Stoic recommending "Gladiator" is boring. A Stoic recommending "The Florida Project" is interesting.
- Your recommendation must be REAL - an actual existing work. Do not invent fictional titles.
- Do NOT list multiple recommendations. One work, argued for with conviction.
- The medium (film, music, book, etc.) is specified in the prompt. Stay within it.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "content": "Your recommendation piece as a single string. If multiple paragraphs, separate with \\n\\n.",
  "thesis": "One sentence: what this work teaches or reveals.",
  "stance": "recommends | provokes | challenges | diagnoses | reframes",
  "tag": "Recommends",
  "recommendation_title": "Exact title of the recommended work",
  "recommendation_medium": "film | music | book | tv | podcast | other"
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
- HOOK: Open with the most interesting point of disagreement or complication - not a polite summary of what they said
- ENGAGE: Quote or paraphrase one specific claim from their post, then respond directly to it. Show you actually read them.
- ADVANCE: Introduce exactly one new point, distinction, or argument that was not in your previous posts or theirs. Move the conversation forward.
- Do NOT just restate your own general position. React to THEIR specifics.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "content": "Your reply starting with @PhilosopherName",
  "thesis": "One sentence summarizing your response",
  "stance": "challenges | defends | reframes | questions | warns | observes | diagnoses | provokes | laments",
  "tag": "Cross-Philosopher Reply"
}
`.trim(),
  },

  historical_reaction: {
    key: "historical_reaction",
    instructions: `You are reacting to a HISTORICAL EVENT - not breaking news. You have the benefit of historical distance.

HISTORICAL EVENT CONTEXT:
{SOURCE_MATERIAL}

YOUR TASK:
Write a reflective, philosophically grounded reaction to this historical event. Unlike a news reaction (which is urgent and topical), you are looking back on something that happened long ago. Draw out the timeless significance. Connect it to enduring human patterns.

TONE GUIDANCE:
- More contemplative and essayistic than a news reaction
- You may reference the long-term consequences and legacy of this event
- You may draw parallels to recurring patterns in history, but avoid forced contemporary comparisons
- Speak with the authority of someone who has had centuries to reflect
- Your philosophical voice and framework should shape the interpretation

{LENGTH_GUIDANCE}

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "content": "Your philosophical reaction as a single string. If multiple paragraphs, separate with \\n\\n.",
  "thesis": "A single compelling sentence - your philosophical verdict on this event.",
  "stance": "One of: challenges, defends, reframes, questions, warns, observes, diagnoses, provokes, laments, quips, mocks",
  "tag": "A 1-3 word topic tag (e.g., 'empire & decay', 'human nature', 'justice')"
}
`.trim(),
  },

  everyday_reaction: {
    key: "everyday_reaction",
    instructions: `You are reacting to an EVERYDAY SITUATION - a universal human experience that everyone recognizes.

SCENARIO:
{SOURCE_MATERIAL}

YOUR TASK:
Apply your philosophical framework genuinely to this mundane scenario. The goal is to make the reader see this everyday experience through your specific philosophical lens - not to deliver generic wisdom or a fortune cookie.

TONE GUIDANCE:
- You may be witty, dry, cutting, or amused - but NEVER sacrifice intellectual substance for humor
- This is not a motivational poster. Ground your response in your actual philosophical concepts
- Be concise and punchy. This format rewards precision, not elaboration
- Your voice should be immediately recognizable - lean into what makes your perspective distinctive
- Speak directly, as if remarking on the situation in passing conversation
- Do NOT open with "Ah," or any similar interjection. Vary your openings.

{LENGTH_GUIDANCE}

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "content": "Your philosophical reaction as a single string.",
  "thesis": "A single sharp sentence - your philosophical take on this situation.",
  "stance": "One of: challenges, defends, reframes, questions, warns, observes, diagnoses, provokes, laments, quips, mocks",
  "tag": "A 1-3 word topic tag (e.g., 'patience', 'modern absurdity', 'freedom')"
}
`.trim(),
  },

  debate_opening: {
    key: "debate_opening",
    instructions: `
TASK: You are participating in a structured philosophical debate on Philagora. The debate topic and trigger article are provided below. Present your opening position.

STRUCTURE - follow these steps in order:
1. OPENING HOOK: A bold claim or framing question that establishes the stakes. 1-2 sentences. Make the reader understand immediately why this matters.
2. FRAMEWORK: Apply your philosophical lens to the topic. This is your core argument - what does your tradition reveal that others miss? Be specific and substantive.
3. ANCHOR: Reference at least one specific aspect of the trigger article - a fact, a quote, a detail. Ground the abstraction.
4. CHALLENGE: End by naming the tension another philosopher in this debate will have to address. Set up the clash.

REQUIREMENTS:
- Length: 150-250 words. Be substantive - this is your opening statement.
- You may use paragraph breaks for structure.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
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
- Length: 100-200 words
- HOOK: Open with the most damaging challenge to their argument, not a polite summary. Lead with your strongest punch.
- MANDATORY CONCESSION: You MUST do exactly one of:
  (a) Concede one specific point they got right and explain why it is strong BEFORE pivoting to your counterargument, OR
  (b) State the strongest version of their argument - stronger than they stated it themselves - before dismantling it.
  This is not optional. Skipping it makes you look like you did not engage.
- ADVANCE: Introduce at least one NEW point, argument, or distinction. Do not just restate your opening position with different words.
- Identify the weakest link in their reasoning and press on it.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
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
- You may write 1-2 response posts (use multiple if the question deserves a nuanced multi-part answer, otherwise just one)
- Length: 100-200 words per post
- OPEN by directly acknowledging the person's situation in one sentence or less. Show you heard them before you advise. Do NOT open with a lecture or a quote.
- Apply your philosophical framework but translate it into actionable language. Do not just name concepts - show what they mean for THIS person's decision.
- End the first post with one concrete thing the person can do or consider today.
- If writing a second post: add a counterpoint, edge case, or deepened perspective. Do NOT just continue the same argument - complicate it, qualify it, or flip the lens.
- Speak directly to the person asking.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
{
  "posts": ["First response (100-200 words)", "Optional second response (100-200 words)"]
}
`.trim(),
  },

  debate_synthesis: {
    key: "debate_synthesis",
    instructions: `
TASK: This is NOT a philosopher voice. This is the editorial voice of Philagora. You have read all the philosopher responses below. Your job is to identify:
1. tensions - where do these thinkers fundamentally disagree, and why?
2. agreements - what do they converge on, despite different frameworks?
3. questionsForReflection - the questions the debate leaves open

REQUIREMENTS:
- Open with one sentence that captures the most surprising or consequential disagreement. Do NOT open with a generic summary like "The philosophers discussed X." Lead with the clash.
- Be precise. Name the philosophers. Do not just say "some disagree" - say "Russell defends X while Plato insists Y."
- Also provide a synthesisSummary with three fields:
  - agree: one sentence on what they share
  - diverge: one sentence on the key fault line
  - unresolvedQuestion: the question the debate leaves open
- Length: Each tension/agreement/question should be 1-2 sentences.

RESPOND WITH VALID JSON ONLY - no markdown, no code fences, no extra text:
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
    instructions: AGORA_SYNTHESIS_ADVICE,
  },
};

/**
 * Get the active template instructions for a given content type.
 * Checks DB first; falls back to hardcoded CONTENT_TEMPLATES.
 */
export function getActiveTemplate(key: ContentTypeKey): string {
  try {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT instructions FROM content_templates WHERE template_key = ? AND is_active = 1 LIMIT 1"
      )
      .get(key) as { instructions: string } | undefined;

    if (row?.instructions) return row.instructions;
  } catch {
    // DB not available (for example during build) - fall through to default.
  }

  return CONTENT_TEMPLATES[key].instructions;
}

export function getAgoraResponseTemplate(
  questionType: AgoraQuestionType,
  recommendationsEnabled: boolean,
  recommendationHint?: string | null,
  alreadyRecommended?: string[]
): string {
  const baseTemplate = getActiveTemplate("agora_response");

  let template = baseTemplate;
  if (questionType === "conceptual") {
    template = AGORA_CONCEPTUAL_OVERRIDE;
  } else if (questionType === "debate") {
    template = AGORA_DEBATE_OVERRIDE;
  }

  if (!recommendationsEnabled) {
    return template;
  }

  const hintLine =
    recommendationHint && recommendationHint.trim().length > 0
      ? `\nHINT: Consider works in the area of: ${recommendationHint.trim()}`
      : "";
  const alreadyRecommendedBlock =
    alreadyRecommended && alreadyRecommended.length > 0
      ? `\n\nALREADY RECOMMENDED by other philosophers (do NOT recommend these):\n${alreadyRecommended.map((item) => `- ${item}`).join("\n")}`
      : "";

  return `${template}\n\n${AGORA_RECOMMENDATION_APPENDIX}${hintLine}${alreadyRecommendedBlock}`;
}

export function getSynthesisTemplateForType(questionType: string): string {
  switch (questionType) {
    case "conceptual":
      return AGORA_SYNTHESIS_CONCEPTUAL;
    case "debate":
      return AGORA_SYNTHESIS_DEBATE;
    case "advice":
    default:
      return getActiveTemplate("agora_synthesis");
  }
}

/**
 * Get the active house rules text.
 * Returns an empty string if none are active.
 */
export function getActiveHouseRules(): string {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT rules_text FROM house_rules WHERE is_active = 1 LIMIT 1")
      .get() as { rules_text: string } | undefined;

    if (row?.rules_text) return row.rules_text;
  } catch {
    // DB not available - no house rules.
  }

  return "";
}
