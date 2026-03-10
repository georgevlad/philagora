"use client";

import { useState } from "react";

const tabs = ["For You", "Debates", "Following"];

export function FeedTabs() {
  const [active, setActive] = useState("For You");

  return (
    <div className="sticky top-14 lg:top-0 z-10 bg-parchment/92 supports-[backdrop-filter]:backdrop-blur-md border-b border-border-light/90 shadow-[0_6px_16px_rgba(42,36,31,0.035)]">
      <div className="flex px-2 sm:px-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`flex-1 px-2 sm:px-4 py-4 transition-colors duration-200 relative ${
              active === tab
                ? "text-ink font-serif font-medium text-[15px]"
                : "text-ink-lighter font-body text-sm hover:text-ink-light"
            }`}
          >
            <span className="relative inline-block">
              {tab}
              {active === tab && (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-9 h-[3px] bg-athenian rounded-full shadow-[0_0_0_1px_rgba(176,138,73,0.14)]" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
