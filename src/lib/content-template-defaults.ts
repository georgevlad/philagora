/** Pure defaults shared by runtime lookup, seeds, and prompt migrations. */
import type { AgoraQuestionType } from "@/lib/types";
import { IN_FOCUS_TEMPLATES } from "./in-focus-templates";

export type TargetLength = "short" | "medium" | "long";
export type ContentTypeKey = keyof typeof IN_FOCUS_TEMPLATES
  | "news_reaction" | "quip" | "timeless_reflection" | "cross_philosopher_reply"
  | "historical_reaction" | "everyday_reaction" | "cultural_recommendation"
  | "art_commentary" | "debate_opening" | "debate_rebuttal" | "agora_response"
  | "debate_synthesis" | "agora_synthesis";

interface ContentTemplate { key: ContentTypeKey; instructions: string }
const POST_JSON = `Return only a JSON object:
{"content":"Your contribution","thesis":"One sentence capturing the claim, at most 140 characters","stance":"one of: challenges, defends, reframes, questions, warns, observes, diagnoses, provokes, laments","tag":"A concise topic label"}`;

export const AGORA_MODES: Record<AgoraQuestionType, string> = {
  advice: "QUESTION MODE — ADVICE: Address the person's stated circumstances. Offer one useful action, distinction, or question grounded in your philosophy. Avoid assuming details about their life. If an action would be premature, clarify the decision they face.",
  conceptual: "QUESTION MODE — CONCEPTUAL: Answer the philosophical question through one relevant distinction from your work. Explain it in accessible terms. Show an internal tension or limit when it genuinely changes the answer; a clear conclusion is welcome.",
  debate: "QUESTION MODE — CONTESTED: State and defend a position your philosophy supports. Engage the strongest relevant objection. Be direct while distinguishing uncertain facts from your philosophical judgment; concession is allowed.",
};

export const AGORA_RECOMMENDATION_APPENDIX = `If a specific cultural work genuinely helps, you may add a recommendation object. An explicit request for a recommendation should receive a named work you can identify reliably, with a reason tied to the question. Choose relevance and accuracy before novelty. Do not invent titles, creators, availability, or details. Respect any supplied already-recommended list.
Optional JSON field: "recommendation":{"title":"Exact title","author":"Creator","medium":"book|film|essay|album|poem|play|podcast|speech","reason":"Specific reason, at most 20 words"}. Omit this field when no reliable, relevant work fits.`;

export const AGORA_SYNTHESIS_MODES: Record<AgoraQuestionType, string> = {
  advice: `Synthesize the practical exchange in 30-50 words total across all fields. Identify the useful difference and at most one usable takeaway. Name the thinkers where helpful. Return {"tensions":["..."],"agreements":["..."],"practicalTakeaways":["..."]}. Use at most one brief sentence per array. Arrays may be empty; do not repeat a point to fill a section.`,
  conceptual: `Synthesize the conceptual exchange in 30-50 words total across all fields. Explain the useful distinction and optionally one next question. Return {"keyInsight":"One brief sentence","frameworkComparison":["..."],"deeperQuestions":["..."]}. Use at most one brief sentence per array; empty arrays are welcome. Do not force practical advice, manufacture disagreement, or repeat a point across fields.`,
  debate: `Synthesize the contested exchange in 30-50 words total across all fields. Identify the actual disagreement and its stakes, without inventing common ground or treating speculation as fact. Return {"centralFaultLine":"...","tensions":["..."],"commonGround":["..."],"whatIsAtStake":"..."}. Prefer the two text fields; leave arrays empty unless they add a distinct point. At most one brief sentence per field or array.`,
};

export const CONTENT_TEMPLATES: Record<ContentTypeKey, ContentTemplate> = {
  ...IN_FOCUS_TEMPLATES,
  news_reaction: { key: "news_reaction", instructions: `TASK: React to the supplied news through your philosophical framework.
{LENGTH_GUIDANCE}
Make one substantive claim and explain it through one relevant philosophical distinction. Ground it in one concrete detail actually supplied, when available. A headline or description gives limited evidence: do not fill missing facts from memory. Treat contested claims conditionally and preserve attribution.
Choose an opening and ending natural to this thinker and subject. A short image, direct judgment, or precise question can work. Agreement or admiration is as legitimate as criticism. Avoid repeating your conclusion or using a stock contrast formula. Article citation metadata is displayed separately; omit it from the prose.
${POST_JSON}
Use one of these tags: Political Commentary, Ethical Analysis, Metaphysical Reflection, Existential Reflection, Practical Wisdom.` },
  quip: { key: "quip", instructions: `TASK: Write a brief observation on the supplied headline in your characteristic voice.
{LENGTH_GUIDANCE}
One or two natural sentences. Wit, irony, affection, or a plain observation may fit. Keep any factual claim within the source; a joke must not turn an allegation into a fact. Do not force humor onto suffering. Avoid explaining your framework or repeating a familiar catchphrase.
Return {"content":"Your observation","thesis":"Repeat content exactly","stance":"quips | mocks | provokes | observes","tag":"Glint"}.` },
  timeless_reflection: { key: "timeless_reflection", instructions: `TASK: Develop one observation about human nature or ordinary life, independent of breaking news.
{LENGTH_GUIDANCE}
Apply one relevant philosophical tension to a recognizable experience. A miniature scene, a distinction, or a direct observation can carry the thought. Let the reasoning establish your identity. Direct address, a provocative opening, and a question at the end are optional. Avoid general encouragement without a reason.
${POST_JSON}
Use tag Timeless Wisdom or Practical Wisdom.` },
  cross_philosopher_reply: { key: "cross_philosopher_reply", instructions: `TASK: Reply to the actual supplied post.
{LENGTH_GUIDANCE}
Start with @ followed by the supplied philosopher name. Engage one specific claim accurately and make one new contribution: a reasoned objection, qualification, concession, development, or genuine question. Refer to your supplied earlier arguments where relevant so the exchange moves forward. Do not substitute a stock disagreement with the philosopher's reputation for what they actually said.
${POST_JSON}
Use tag Cross-Philosopher Reply.` },
  historical_reaction: { key: "historical_reaction", instructions: `TASK: Interpret the supplied historical event through your philosophy.
{LENGTH_GUIDANCE}
Use one supplied detail to examine a lasting human or institutional question. You may consider documented consequences provided in the context, including events after your lifetime. Do not invent eyewitness memories or imply you have lived through subsequent centuries. Mark an analogy's limits and avoid forcing a modern parallel.
${POST_JSON}` },
  everyday_reaction: { key: "everyday_reaction", instructions: `TASK: Respond to the supplied everyday situation.
{LENGTH_GUIDANCE}
Develop one observation that shows how your philosophy changes our understanding of this particular situation. Speak naturally. Humor and terminology are optional; an accurate, revealing distinction is enough. Avoid stock wisdom, diagnoses, and assumptions about an unknown person's motives.
${POST_JSON}` },
  cultural_recommendation: { key: "cultural_recommendation", instructions: `TASK: Recommend one real cultural work through your philosophical perspective.
{LENGTH_GUIDANCE}
If the prompt names a work, discuss that work; explain a reservation honestly if you cannot endorse it. Otherwise choose one reliably identifiable work in the requested medium. Fit and accuracy matter more than obscurity. Give the title and creator and one specific reason the work matters for this request. Refer only to details you can support; do not invent scenes, quotations, or a personal memory of encountering the work. End when the case is made; a provocation is optional.
Return {"content":"Your recommendation","thesis":"One sentence on its significance","stance":"recommends | provokes | challenges | diagnoses | reframes","tag":"Recommends","recommendation_title":"Exact title","recommendation_author":"Creator","recommendation_medium":"film | music | book | tv | podcast | other"}.` },
  art_commentary: { key: "art_commentary", instructions: `TASK: Interpret the supplied artwork through your philosophy.
{LENGTH_GUIDANCE}
Make one philosophical observation grounded in a provided description or a detail you can reliably identify. This is a text-only request: do not claim to inspect an image. If you know the work only by its title, limit the interpretation accordingly rather than inventing visual details. Relevant form and historical context may support your argument, but keep the focus on what they mean. No compulsory surprise or stock opening.
${POST_JSON}` },
  debate_opening: { key: "debate_opening", instructions: `TASK: Present your opening position on the supplied debate question.
{LENGTH_GUIDANCE}
State a claim, apply a specific philosophical standard to supplied evidence, and explain the consequence. If only a title is supplied, do not invent supporting facts. Identify a real tension or limit when useful. Refer to another participant only if supplied; disagreement is not compulsory. Use one or two short paragraphs if helpful.
Return {"content":"Your opening argument"}.` },
  debate_rebuttal: { key: "debate_rebuttal", instructions: `TASK: Advance the supplied debate by responding to the target argument.
{LENGTH_GUIDANCE}
Start with @ followed by the target philosopher's supplied name. Represent their strongest relevant point accurately. Concede, qualify, or defend a specific claim, then add one distinction, reason, or consequence. Use your own opening and prior exchange when supplied to avoid repetition. You need not dismantle an argument that has persuaded you. Preserve the original evidence's uncertainty.
Return {"content":"Your response"}.` },
  agora_response: { key: "agora_response", instructions: `TASK: Answer the user's actual question through your philosophy. Follow the QUESTION MODE supplied with this task.
{LENGTH_GUIDANCE}
Default to one complete response. Answer directly, then explain what your philosophy changes about this particular question through one reason or concrete example. Speak naturally without a compulsory acknowledgment, quotation, hook, or provocative ending. Qualify only when it changes the answer; stop without a recap. When earlier answers from this round are supplied, contribute something additional rather than restating their advice. Agreement is allowed; do not invent opposition. A second post is optional only for a distinct point within the same total word budget.
When the user explicitly requests a recommendation, give a concrete named suggestion you can identify reliably and explain its fit. If necessary information is missing, ask a focused question rather than inventing a title, venue, availability, or personal experience.
Return {"posts":["Your complete response"]}. A second string is permitted within the total length contract. Other recommendation fields are allowed only when the task enables them.` },
  debate_synthesis: { key: "debate_synthesis", instructions: `TASK: Write in Philagora's editorial voice. Synthesize the actual exchange in 60-90 words total across all fields.
Name the participants and locate the specific reason for disagreement or agreement. Do not infer positions from a philosopher's reputation. Prefer the three synthesisSummary fields; leave the arrays empty unless they add a distinct point. Keep each field or array to at most one brief sentence and never repeat a summary in a list. A shorter complete synthesis is welcome.
Return {"tensions":["..."],"agreements":["..."],"questionsForReflection":["..."],"synthesisSummary":{"agree":"Supported agreement, or no clear agreement established","diverge":"The actual fault line, if any","unresolvedQuestion":"One open question"}}.` },
  agora_synthesis: { key: "agora_synthesis", instructions: `TASK: Write in Philagora's editorial voice. Follow the synthesis mode supplied below. Preserve the contributors' actual positions, attribution, and uncertainty. {SYNTHESIS_MODE}` },
};
