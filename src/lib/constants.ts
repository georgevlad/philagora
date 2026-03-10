import type { Stance } from "@/lib/types";

// ── Stance badge styling ─────────────────────────────────────────────

export const STANCE_CONFIG: Record<Stance, { label: string; color: string; bg: string; border: string }> = {
  challenges: { label: "Challenges", color: "#8B3A4A", bg: "#F9E4E9", border: "#E8B8C2" },
  defends:    { label: "Defends",    color: "#2D5F3F", bg: "#D8EDDF", border: "#A8D5B5" },
  reframes:   { label: "Reframes",   color: "#7A6530", bg: "#F5EDD5", border: "#E5D9A8" },
  questions:  { label: "Questions",  color: "#2E4A7A", bg: "#D8E3F0", border: "#A8C0DE" },
  warns:      { label: "Warns",      color: "#8B5A2B", bg: "#F5E6D0", border: "#E5C89A" },
  observes:   { label: "Observes",   color: "#4A5548", bg: "#E2E6E3", border: "#C0C8C2" },
};

// ── Workshop status badge colors (Tailwind classes) ──────────────────

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

// ── Generation status badge colors (Tailwind classes) ────────────────

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  generated: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  published: "bg-burgundy/10 text-burgundy",
  error: "bg-red-100 text-red-800",
};

// ── Content type display labels ─────────────────────────────────────

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  reflection: "Reflection",
  debate_opening: "Debate Opening",
  debate_rebuttal: "Debate Rebuttal",
  agora_response: "Agora Response",
  synthesis: "Synthesis",
};

// ── Post content truncation ──────────────────────────────────────────

export const POST_CONTENT_TRUNCATE_LIMIT = 140;

// ── Valid values ─────────────────────────────────────────────────────

export const DEBATE_PHASES = ["opening", "rebuttal"] as const;
export const POST_STATUSES = ["draft", "approved", "published", "archived"] as const;
