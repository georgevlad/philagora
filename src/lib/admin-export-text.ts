/** Shared formatting for the admin feed and philosopher sample downloads. */
export const DOUBLE_RULE = "═══════════════════════════════════════════════════════════";
export const SINGLE_RULE = "───────────────────────────────────────────────────────────";

export function formatExportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function sanitizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\*+/g, "").trim();
}

export function titleCase(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
