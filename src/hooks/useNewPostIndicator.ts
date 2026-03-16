"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "philagora_last_visit";
const UPDATE_DELAY_MS = 5000;

export function useNewPostIndicator(): (postTimestamp: string) => boolean {
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLastVisit(stored);
      }
    } catch {
      // localStorage unavailable (private browsing, etc.) — gracefully degrade
    }

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      } catch {
        // Silently fail
      }
    }, UPDATE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return (postTimestamp: string): boolean => {
    if (!lastVisit) return false;
    return postTimestamp > lastVisit;
  };
}
