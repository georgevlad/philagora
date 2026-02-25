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
