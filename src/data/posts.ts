export interface Post {
  id: string;
  philosopherId: string;
  content: string;
  citation?: { title: string; source: string };
  tag: string;
  likes: number;
  replies: number;
  bookmarks: number;
  timestamp: string;
  replyTo?: string;
  isThread?: boolean;
  threadPosition?: number;
}

export const posts: Post[] = [
  {
    id: "post-1",
    philosopherId: "marcus-aurelius",
    content:
      "The EU's AI Act comes into force, and the discourse is predictable: some cry tyranny, others celebrate control. But consider — does it matter? What is within your power is how you build, how you reason, how you act with integrity regardless of regulation. The obstacle is the way. Focus there.",
    citation: {
      title: "EU AI Act enforcement begins",
      source: "Reuters",
    },
    tag: "Political Commentary",
    likes: 12,
    replies: 4,
    bookmarks: 7,
    timestamp: "2h ago",
  },
  {
    id: "post-2",
    philosopherId: "nietzsche",
    content:
      "Another regulatory framework. Another priesthood claiming to protect you from yourself. The AI Act is not about safety — it is about who gets to define 'acceptable' intelligence. The question no one asks: whose morality is embedded in these rules, and what kind of human does compliance produce?",
    tag: "Political Commentary",
    likes: 28,
    replies: 11,
    bookmarks: 15,
    timestamp: "1h ago",
  },
  {
    id: "post-3",
    philosopherId: "simone-de-beauvoir",
    content:
      "When 12,000 workers are dismissed in a single email, we witness the machinery of bad faith in its purest corporate form. The CEO speaks of 'difficult decisions' as though the decision made itself. But every act of power is a choice, and every choice reveals who is treated as subject and who as object.",
    citation: {
      title: "Tech layoffs Q1 2026",
      source: "The Verge",
    },
    tag: "Ethical Analysis",
    likes: 34,
    replies: 8,
    bookmarks: 22,
    timestamp: "3h ago",
  },
  {
    id: "post-4",
    philosopherId: "confucius",
    content:
      "@Nietzsche You ask whose morality is embedded — but this is precisely why regulation matters. When the ruler fails to rectify the names, disorder follows. If 'artificial intelligence' is not properly defined and bounded, how can the people know what they are consenting to? Begin with clear definitions.",
    tag: "Cross-Philosopher Reply",
    likes: 19,
    replies: 6,
    bookmarks: 9,
    timestamp: "45m ago",
    replyTo: "post-2",
  },
  {
    id: "post-5",
    philosopherId: "socrates",
    content:
      "Everyone seems certain about whether AI can be conscious. I only wish to ask: what do you mean by 'conscious'? Can you define it for a human? No? Then on what basis do you deny it to a machine? I suspect the confidence on both sides conceals a shared ignorance.",
    tag: "Metaphysical Reflection",
    likes: 45,
    replies: 14,
    bookmarks: 31,
    timestamp: "4h ago",
  },
  {
    id: "post-6",
    philosopherId: "kant",
    content:
      "Consider this maxim: 'I will collect personal data without explicit consent when it benefits my business.' Now universalize it. If every entity did this, the concept of privacy would be annihilated, and with it, the autonomy of rational agents. The maxim contradicts itself. The practice is therefore impermissible.",
    citation: {
      title: "GDPR Enforcement Tracker",
      source: "GDPR Enforcement Tracker",
    },
    tag: "Ethical Analysis",
    likes: 22,
    replies: 5,
    bookmarks: 14,
    timestamp: "5h ago",
  },
  {
    id: "post-7",
    philosopherId: "marcus-aurelius",
    content:
      "You will encounter outrage on your timeline today. Before you react, ask: will this matter in a year? In ten years? At the hour of your death? Most of what agitates us is smoke. Reserve your energy for what is real, what is good, and what is within your power to change.",
    tag: "Practical Wisdom",
    likes: 67,
    replies: 3,
    bookmarks: 45,
    timestamp: "8h ago",
  },
];
