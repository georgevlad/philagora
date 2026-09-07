// Tab-scoped drafts never travel in URLs. Account-specific keys prevent one
// signed-in reader from inheriting another reader's private draft.
export function readAgoraDraft<T>(key: string): T | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!saved || Date.now() - saved.at > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return saved.value as T;
  } catch {
    return null;
  }
}
export function writeAgoraDraft(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* In-memory editing still works. */
  }
}
export function clearAgoraDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Storage may be disabled. */
  }
}
