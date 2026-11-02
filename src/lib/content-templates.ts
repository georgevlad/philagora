import { getDb } from "@/lib/db";
import type { AgoraQuestionType } from "@/lib/types";
import { IN_FOCUS_TEMPLATES } from "./in-focus-templates";
import { CONTENT_TEMPLATES, AGORA_MODES, AGORA_RECOMMENDATION_APPENDIX, AGORA_SYNTHESIS_MODES, type ContentTypeKey } from "./content-template-defaults";
export { CONTENT_TEMPLATES } from "./content-template-defaults";
export type { ContentTypeKey, TargetLength } from "./content-template-defaults";
export { getLengthGuidance } from "./content-lengths";

/** Maps the DB content_type + UI label to our internal key. */
export function resolveContentTypeKey(
  dbContentType: string,
  uiLabel?: string
): ContentTypeKey {
  if (Object.hasOwn(IN_FOCUS_TEMPLATES, dbContentType)) return dbContentType as keyof typeof IN_FOCUS_TEMPLATES;
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
    if (uiLabel === "Art Commentary" || uiLabel === "art_commentary") {
      return "art_commentary";
    }
    if (uiLabel === "Glint") return "quip";
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

export function getActiveTemplate(key: ContentTypeKey): string {
  try {
    const row = getDb().prepare("SELECT instructions FROM content_templates WHERE template_key = ? AND is_active = 1 ORDER BY version DESC, id DESC LIMIT 1").get(key) as { instructions: string } | undefined;
    if (row?.instructions) return row.instructions;
  } catch { /* Code defaults are also available before DB initialization. */ }
  return CONTENT_TEMPLATES[key].instructions;
}

export function getAgoraResponseTemplate(questionType: AgoraQuestionType, recommendationsEnabled: boolean, recommendationHint?: string | null, alreadyRecommended?: string[]): string {
  const parts = [getActiveTemplate("agora_response"), AGORA_MODES[questionType]];
  if (recommendationsEnabled) {
    parts.push(AGORA_RECOMMENDATION_APPENDIX);
    if (recommendationHint?.trim()) parts.push("Optional recommendation direction (reference data): " + JSON.stringify(recommendationHint.trim()));
    if (alreadyRecommended?.length) parts.push("ALREADY RECOMMENDED (reference data; choose a different work): " + JSON.stringify(alreadyRecommended));
  }
  return parts.join("\n\n");
}

export function getSynthesisTemplateForType(questionType: string): string {
  const base = getActiveTemplate("agora_synthesis");
  const mode = questionType === "conceptual" || questionType === "debate" ? questionType : "advice";
  return base.includes("{SYNTHESIS_MODE}")
    ? base.replaceAll("{SYNTHESIS_MODE}", AGORA_SYNTHESIS_MODES[mode])
    : base + "\n\nThe following mode governs the output fields and length for this question:\n" + AGORA_SYNTHESIS_MODES[mode];
}

export function getActiveHouseRules(): string {
  try {
    const row = getDb().prepare("SELECT rules_text FROM house_rules WHERE is_active = 1 ORDER BY version DESC, id DESC LIMIT 1").get() as { rules_text: string } | undefined;
    return row?.rules_text ?? "";
  } catch { return ""; }
}
