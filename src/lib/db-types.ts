import type { ContentTypeKey } from "@/lib/content-templates";
import type { Stance } from "@/lib/types";

export interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  bio?: string;
  era?: string;
  key_works?: string;
  core_principles?: string;
  followers?: number;
  posts_count?: number;
  debates_count?: number;
}

export interface PostRow {
  id: string;
  philosopher_id: string;
  content: string;
  thesis: string;
  stance: string;
  tag: string;
  source_type?: string;
  historical_event_id?: string | null;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  citation_image_url: string | null;
  reply_to: string | null;
  likes: number;
  replies: number;
  bookmarks: number;
  status: string;
  created_at: string;
  updated_at: string;
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
  reply_target_philosopher_id: string | null;
  reply_target_philosopher_name: string | null;
  reply_target_philosopher_color: string | null;
  reply_target_philosopher_initials: string | null;
}

export interface DebateRow {
  id: string;
  title: string;
  status: string;
  debate_date: string;
  trigger_article_title: string;
  trigger_article_source: string;
  trigger_article_url: string | null;
  synthesis_tensions: string;
  synthesis_agreements: string;
  synthesis_questions: string;
  synthesis_summary_agree: string;
  synthesis_summary_diverge: string;
  synthesis_summary_unresolved: string;
}

export interface DebatePhilosopherRow {
  philosopher_id: string;
}

export interface DebatePostRow {
  id: string;
  debate_id: string;
  philosopher_id: string;
  content: string;
  phase: string;
  reply_to: string | null;
  sort_order: number;
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
}

export interface AgoraThreadRow {
  id: string;
  question: string;
  asked_by: string;
  status: string;
  created_at: string;
}

export interface AgoraResponseRow {
  id: string;
  thread_id: string;
  philosopher_id: string;
  posts: string;
  sort_order: number;
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
}

export interface AgoraSynthesisRow {
  thread_id: string;
  tensions: string;
  agreements: string;
  practical_takeaways: string;
}

export interface AgoraPhilosopherRow {
  philosopher_id: string;
}

export interface PromptRow {
  id: number;
  system_prompt_text: string;
  prompt_version: number;
}

export interface ArticleCandidateRow {
  id: string;
  source_id: string;
  title: string;
  url: string;
  description: string;
  score: number | null;
  suggested_philosophers: string;
  suggested_stances: string;
  philosophical_entry_point: string | null;
  image_url: string | null;
  status: string;
  source_name: string;
}

export interface StoredPostRow {
  id: string;
  philosopher_id: string;
  philosopher_name: string;
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  citation_image_url: string | null;
  reply_to: string | null;
  status: string;
}

export interface ContentTemplateRow {
  id: number;
  template_key: ContentTypeKey;
  version: number;
  instructions: string;
  is_active: number;
  created_at: string;
  notes: string;
}

export interface HistoricalEventRow {
  id: string;
  title: string;
  event_month: number;
  event_day: number;
  event_year: number | null;
  display_date: string;
  era: string;
  category: string;
  context: string;
  key_themes: string;
  status: string;
  created_at: string;
  updated_at: string;
  posts_count?: number;
}
