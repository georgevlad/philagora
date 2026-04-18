export type Stance =
  | "challenges"
  | "defends"
  | "reframes"
  | "questions"
  | "warns"
  | "observes"
  | "diagnoses"
  | "provokes"
  | "laments"
  | "quips"
  | "mocks"
  | "recommends";

export interface PostCitation {
  title: string;
  source: string;
  url?: string;
  imageUrl?: string;
}

export type AgoraQuestionType = "advice" | "conceptual" | "debate";
export type AgoraRecommendationMedium =
  | "book"
  | "film"
  | "essay"
  | "album"
  | "poem"
  | "play"
  | "podcast"
  | "speech";

export interface AgoraRecommendation {
  title: string;
  author?: string;
  medium: AgoraRecommendationMedium;
  reason: string;
}

export interface AdviceSynthesis {
  tensions: string[];
  agreements: string[];
  practicalTakeaways: string[];
}

export interface ConceptualSynthesis {
  keyInsight: string;
  frameworkComparison: string[];
  deeperQuestions: string[];
}

export interface DebateSynthesis {
  centralFaultLine: string;
  tensions: string[];
  commonGround: string[];
  whatIsAtStake: string;
}

export type AgoraSynthesisSections =
  | AdviceSynthesis
  | ConceptualSynthesis
  | DebateSynthesis;

export interface Post {
  id: string;
  philosopherId: string;
  content: string;
  thesis: string;
  stance: Stance;
  citation?: PostCitation;
  tag: string;
  sourceType?: string;
  historicalEventId?: string;
  thumbnailUrl?: string;
  eventContext?: string;
  eventDisplayDate?: string;
  recommendationTitle?: string;
  recommendationAuthor?: string;
  recommendationMedium?: string;
  likes: number;
  replies: number;
  bookmarks: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  timestamp: string;
  replyTo?: string;
}

/** Post with pre-resolved philosopher data and reply-target info for feed rendering */
export interface FeedPost extends Post {
  createdAt: string;
  philosopherName: string;
  philosopherColor: string;
  philosopherInitials: string;
  philosopherTradition: string;
  replyTargetPhilosopherId?: string;
  replyTargetPhilosopherName?: string;
  replyTargetPhilosopherColor?: string;
  replyTargetPhilosopherInitials?: string;
  replyTargetThesis?: string;
  /** Cluster ID for article thread grouping. Null for standalone posts. */
  _clusterId?: string | null;
  /** Ordering position within a cluster (0-based). */
  _clusterOrder?: number;
}

export interface HistoricalEventPostUsage {
  postId: string;
  philosopherId: string;
  philosopherName: string;
  philosopherInitials: string;
  philosopherColor: string;
  status: string;
  stance: Stance;
  createdAt: string;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  eventMonth: number;
  eventDay: number;
  eventYear?: number | null;
  displayDate: string;
  era: string;
  category: string;
  context: string;
  keyThemes: string[];
  status: string;
  thumbnailFilename: string | null;
  createdAt: string;
  updatedAt: string;
  postsCount?: number;
  posts?: HistoricalEventPostUsage[];
}

export interface Philosopher {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  bio: string;
  era: string;
  followers: number;
  postsCount: number;
  debatesCount: number;
  keyWorks: string[];
  corePrinciples: { title: string; description: string }[];
}

// ── Debates ──────────────────────────────────────────────────

export interface DebateListItem {
  id: string;
  title: string;
  status: "Complete" | "In Progress" | "Scheduled";
  debateDate: string;
  debateDateRaw?: string;
  triggerArticleTitle: string;
  triggerArticleSource: string;
  triggerArticleUrl: string | null;
  philosophers: string[];
  openingPreviews: {
    philosopherId: string;
    snippet: string;
  }[];
}

export interface DebatePost {
  id: string;
  philosopherId: string;
  content: string;
  phase: "opening" | "cross-examination" | "rebuttal" | "synthesis";
  replyTo: string | null;
  sortOrder: number;
  philosopherName: string;
  philosopherColor: string;
  philosopherInitials: string;
  philosopherTradition: string;
}

export interface DebateDetail {
  id: string;
  title: string;
  status: "Complete" | "In Progress" | "Scheduled";
  debateDate: string;
  debateDateRaw?: string;
  triggerArticleTitle: string;
  triggerArticleSource: string;
  triggerArticleUrl: string | null;
  philosophers: string[];
  openings: DebatePost[];
  rebuttals: DebatePost[];
  synthesisTensions: string[];
  synthesisAgreements: string[];
  synthesisQuestions: string[];
  synthesisSummaryAgree: string;
  synthesisSummaryDiverge: string;
  synthesisSummaryUnresolved: string;
}

// ── Agora ────────────────────────────────────────────────────

export interface AgoraResponse {
  philosopherId: string;
  philosopherName: string;
  philosopherColor: string;
  philosopherInitials: string;
  philosopherTradition: string;
  posts: string[];
  recommendation?: AgoraRecommendation | null;
  sortOrder: number;
}

export interface AgoraSynthesis {
  type: AgoraQuestionType;
  sections: AgoraSynthesisSections;
}

export type AgoraThreadStatus = "pending" | "in_progress" | "complete" | "failed";
export type AgoraThreadVisibility = "public" | "private";

export interface AgoraThreadArticle {
  url: string;
  title: string | null;
  source: string | null;
  excerpt: string | null;
}

export interface AgoraThreadFollowUp {
  id: string;
  question: string;
  status: AgoraThreadStatus;
  createdAt: string;
  responses: AgoraResponse[];
  synthesis: AgoraSynthesis | null;
}

export interface AgoraThreadDetail {
  id: string;
  question: string;
  askedBy: string;
  status: AgoraThreadStatus;
  createdAt: string;
  questionType: AgoraQuestionType;
  recommendationsEnabled: boolean;
  visibility: AgoraThreadVisibility;
  hiddenFromFeed?: boolean;
  userId?: string | null;
  article: AgoraThreadArticle | null;
  philosophers: string[];
  responses: AgoraResponse[];
  synthesis: AgoraSynthesis | null;
  followUpTo?: string | null;
  followUp?: AgoraThreadFollowUp | null;
}
