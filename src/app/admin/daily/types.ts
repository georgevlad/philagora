import { STANCE_CONFIG } from "@/lib/constants";
import { safeJsonParse } from "@/lib/json-utils";

export type { Philosopher } from "@/types/admin";

export type DailyItemType =
  | "news_reaction"
  | "cross_reply"
  | "timeless_reflection"
  | "quip"
  | "cultural_recommendation";
export type LengthStrategy = "varied" | "short" | "medium" | "long";
export type DraftStatus = "draft" | "published" | "deleted";

export interface RawCandidateArticle {
  id: string;
  title: string;
  source_name: string;
  url: string;
  description: string;
  score: number | null;
  philosophical_entry_point: string | null;
  topic_cluster: string | null;
  image_url: string | null;
  suggested_philosophers: string;
  suggested_stances: string;
  published_posts?: Array<{
    philosopher_id: string;
    status: string;
    post_id: string;
  }>;
}

export interface CandidateArticle {
  id: string;
  title: string;
  source_name: string;
  url: string;
  description: string;
  score: number | null;
  philosophical_entry_point: string | null;
  topic_cluster: string | null;
  image_url: string | null;
  suggested_philosophers: string[];
  suggested_stances: Record<string, string>;
  published_posts: Array<{
    philosopher_id: string;
    status: string;
    post_id: string;
  }>;
}

export interface PhilosopherUsage {
  posts_7d: number;
  last_post_at: string | null;
  days_since_last: number | null;
}

export interface PipelineResult {
  fetchResult?: {
    sourcesChecked: number;
    newArticles: number;
    errors: string[];
  };
  scoreResult?: {
    scored: number;
    errors: string[];
  };
}

export interface DailySummary {
  news_reactions: number;
  cross_replies: number;
  timeless_reflections: number;
  quips: number;
  cultural_recommendations: number;
  total_drafts: number;
  philosophers_used: string[];
  errors: string[];
}

export interface DailyGeneratedItem {
  type: DailyItemType;
  post_id: string;
  generation_log_id: number;
  philosopher_id: string;
  philosopher_name: string;
  content: string;
  thesis: string;
  stance: keyof typeof STANCE_CONFIG;
  tag: string;
  length: Exclude<LengthStrategy, "varied">;
  article_candidate_id?: string;
  article_title?: string;
  reply_to_post_id?: string;
  reply_to_philosopher?: string;
  prompt_seed?: string;
  recommendation_title?: string;
  recommendation_medium?: string;
}

export interface ReviewItem extends DailyGeneratedItem {
  status: DraftStatus;
}

export const DEFAULT_CONFIG = {
  reactions_per_article: 1,
  cross_replies: 1,
  timeless_reflections: 2,
  quips: 0,
  cultural_recommendations: 0,
  excluded_philosophers: [] as string[],
  length_strategy: "varied" as LengthStrategy,
};

export const ITEM_STATUS_CLASSES: Record<DraftStatus, string> = {
  draft: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  deleted: "bg-red-100 text-red-800",
};

export const LENGTH_OPTIONS: Array<{ value: LengthStrategy; label: string }> = [
  { value: "varied", label: "Varied" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export const TOPIC_CLUSTER_LABELS: Record<string, { label: string; color: string }> = {
  geopolitics: { label: "Geopolitics", color: "bg-red-100 text-red-800 border-red-200" },
  domestic_politics: { label: "Politics", color: "bg-orange-100 text-orange-800 border-orange-200" },
  technology: { label: "Technology", color: "bg-blue-100 text-blue-800 border-blue-200" },
  science: { label: "Science", color: "bg-purple-100 text-purple-800 border-purple-200" },
  economics: { label: "Economics", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  culture: { label: "Culture", color: "bg-pink-100 text-pink-800 border-pink-200" },
  environment: { label: "Environment", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  health: { label: "Health", color: "bg-teal-100 text-teal-800 border-teal-200" },
  law_justice: { label: "Law & Justice", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  society: { label: "Society", color: "bg-amber-100 text-amber-800 border-amber-200" },
};

export const parseJson = safeJsonParse;

export function truncate(text: string, max = 220) {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "...";
}

export function publishPriority(type: DailyItemType) {
  switch (type) {
    case "news_reaction":
      return 0;
    case "cross_reply":
      return 1;
    case "quip":
      return 2;
    case "cultural_recommendation":
      return 3;
    default:
      return 4;
  }
}
