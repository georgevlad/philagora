import type { Stance } from "@/data/posts";

// ── Stance badge styling ─────────────────────────────────────────────

export const STANCE_CONFIG: Record<Stance, { label: string; color: string; bg: string; border: string }> = {
  challenges: { label: "Challenges", color: "#9B2C2C", bg: "#FED7D7", border: "#FEB2B2" },
  defends:    { label: "Defends",    color: "#276749", bg: "#C6F6D5", border: "#9AE6B4" },
  reframes:   { label: "Reframes",   color: "#744210", bg: "#FEFCBF", border: "#FAF089" },
  questions:  { label: "Questions",  color: "#2A4365", bg: "#BEE3F8", border: "#90CDF4" },
  warns:      { label: "Warns",      color: "#9C4221", bg: "#FEEBC8", border: "#FBD38D" },
  observes:   { label: "Observes",   color: "#4A5568", bg: "#E2E8F0", border: "#CBD5E0" },
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

// ── Post content truncation ──────────────────────────────────────────

export const POST_CONTENT_TRUNCATE_LIMIT = 140;

// ── Valid values ─────────────────────────────────────────────────────

export const DEBATE_PHASES = ["opening", "rebuttal"] as const;
export const POST_STATUSES = ["draft", "approved", "published"] as const;
