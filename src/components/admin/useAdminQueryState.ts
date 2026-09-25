"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener("admin-query-change", notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("admin-query-change", notify);
  };
}
/** URL-backed list state; consecutive setters merge against the current URL. */
export function useAdminQueryState<T extends string | number>(
  key: string,
  fallback: T,
) {
  const params = useSearchParams();
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => `?${params.toString()}`,
  );
  const parse = useCallback(
    (query: string): T => {
      const raw = new URLSearchParams(query).get(key);
      if (raw === null) return fallback;
      return (
        typeof fallback === "number"
          ? Math.max(1, Number.parseInt(raw, 10) || fallback)
          : raw
      ) as T;
    },
    [fallback, key],
  );
  const set = useCallback(
    (update: T | ((previous: T) => T)) => {
      const next = new URLSearchParams(window.location.search);
      const value =
        typeof update === "function"
          ? update(parse(window.location.search))
          : update;
      if (value === fallback || value === "") next.delete(key);
      else next.set(key, String(value));
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${next.size ? `?${next}` : ""}`,
      );
      window.dispatchEvent(new Event("admin-query-change"));
    },
    [fallback, key, parse],
  );
  return [parse(search), set] as const;
}
