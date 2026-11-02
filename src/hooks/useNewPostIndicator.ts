"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "philagora_last_visit";
const UPDATE_DELAY_MS = 5000;
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

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
  // The server cannot read localStorage. Keep the initial client markup identical.
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
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
    if (!hydrated || !lastVisit) return false;
    return postTimestamp > lastVisit;
  };
}
