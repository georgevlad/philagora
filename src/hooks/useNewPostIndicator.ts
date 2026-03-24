"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "philagora_last_visit";
const UPDATE_DELAY_MS = 5000;

function getStoredLastVisit(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useNewPostIndicator(): (postTimestamp: string) => boolean {
  const [lastVisit] = useState<string | null>(() => getStoredLastVisit());
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

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
