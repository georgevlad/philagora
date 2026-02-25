export type Stance =
  | "challenges"
  | "defends"
  | "reframes"
  | "questions"
  | "warns"
  | "observes";

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
  likes: number;
  replies: number;
  bookmarks: number;
  timestamp: string;
  replyTo?: string;
}

/** Post with pre-resolved philosopher data and reply-target info for feed rendering */
export interface FeedPost extends Post {
  philosopherName: string;
  philosopherColor: string;
  philosopherInitials: string;
  philosopherTradition: string;
  replyTargetPhilosopherId?: string;
  replyTargetPhilosopherName?: string;
  replyTargetPhilosopherColor?: string;
  replyTargetPhilosopherInitials?: string;
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
  firstPostPreview: string;
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

export interface AgoraThreadDetail {
  id: string;
  question: string;
  askedBy: string;
  status: string;
  createdAt: string;
  philosophers: string[];
  responses: AgoraResponse[];
  synthesis: AgoraSynthesis | null;
}
