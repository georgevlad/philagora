import type { Stance } from "@/lib/types";

// Stance badge styling
export const STANCE_CONFIG: Record<Stance, { label: string; color: string; bg: string; border: string }> = {
  challenges: { label: "Challenges", color: "#7A3E3A", bg: "#EFE1DD", border: "#D7BBB3" },
  defends:    { label: "Defends",    color: "#314E3D", bg: "#DEE8E0", border: "#BDD0C0" },
  reframes:   { label: "Reframes",   color: "#8B6E38", bg: "#F0E7D5", border: "#D9C5A2" },
  questions:  { label: "Questions",  color: "#3E5166", bg: "#E0E6ED", border: "#BECCD9" },
  warns:      { label: "Warns",      color: "#8B5F37", bg: "#F0E2D2", border: "#D9C0A4" },
  observes:   { label: "Observes",   color: "#58544E", bg: "#E7E2DB", border: "#CFC4B6" },
  diagnoses:  { label: "Diagnoses",  color: "#4A6670", bg: "#E0E9EC", border: "#B8CDD4" },
  provokes:   { label: "Provokes",   color: "#9B2C2C", bg: "#F5E1E1", border: "#E2B4B4" },
  laments:    { label: "Laments",    color: "#5B4A8A", bg: "#E8E3F1", border: "#CBBFE0" },
  quips:      { label: "Quips",      color: "#6B5B3E", bg: "#F0EBE0", border: "#D4C9B0" },
  mocks:      { label: "Mocks",      color: "#8B4049", bg: "#F2E0E3", border: "#D9B3BA" },
};

// Workshop status badge colors (Tailwind classes)
export const DEBATE_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
};

export const AGORA_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
};

// Generation status badge colors (Tailwind classes)
export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  generated: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  published: "bg-burgundy/10 text-burgundy",
  error: "bg-red-100 text-red-800",
};

// Content type display labels
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  quip: "Quip",
  reflection: "Reflection",
  debate_opening: "Debate Opening",
  debate_rebuttal: "Debate Rebuttal",
  agora_response: "Agora Response",
  synthesis: "Synthesis",
};

// Post content truncation
export const POST_CONTENT_TRUNCATE_LIMIT = 300;

// Valid values
export const DEBATE_PHASES = ["opening", "rebuttal"] as const;
export const POST_STATUSES = ["draft", "approved", "published", "archived"] as const;
