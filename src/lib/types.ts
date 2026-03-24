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
  recommendationTitle?: string;
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
  sortOrder: number;
}

export interface AgoraSynthesis {
  tensions: string[];
  agreements: string[];
  practicalTakeaways: string[];
}

export type AgoraThreadStatus = "pending" | "in_progress" | "complete" | "failed";

export interface AgoraThreadDetail {
  id: string;
  question: string;
  askedBy: string;
  status: AgoraThreadStatus;
  createdAt: string;
  philosophers: string[];
  responses: AgoraResponse[];
  synthesis: AgoraSynthesis | null;
}
