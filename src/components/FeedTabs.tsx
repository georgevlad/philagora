"use client";

import { useState } from "react";

const tabs = ["For You", "Debates", "Following"];

export function FeedTabs() {
  const [active, setActive] = useState("For You");

  return (
    <div className="sticky top-14 lg:top-0 z-10 bg-parchment/90 backdrop-blur-md border-b border-border-light">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`flex-1 px-2 sm:px-4 py-3 text-sm font-medium transition-colors duration-200 relative ${
              active === tab
                ? "text-athenian"
                : "text-ink-lighter hover:text-ink-light"
            }`}
          >
            {tab}
            {active === tab && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-athenian rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
