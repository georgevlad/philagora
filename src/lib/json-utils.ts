export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(json || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}
