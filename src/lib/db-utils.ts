/** Split a GROUP_CONCAT result string into an array, returning [] for null/empty. */
export function parseGroupConcat(concatenated: string | null | undefined): string[] {
  return concatenated ? concatenated.split(",") : [];
}
