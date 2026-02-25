import Link from "next/link";
import { activeDebates } from "@/data/debates";
import { getPhilosophersMap } from "@/lib/data";
import { PhilosopherAvatar } from "./PhilosopherAvatar";

export function RightSidebar() {
  const philosophersMap = getPhilosophersMap();

  return (
    <aside className="hidden xl:block w-72 shrink-0 sticky top-0 h-screen overflow-y-auto py-6 px-4 border-l border-border-light">
      {/* Active Debates */}
      <div className="mb-8">
        <h3 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-3 px-1">
          Active Debates
        </h3>
        <div className="space-y-3">
          {activeDebates.map((debate) => (
            <Link
              key={debate.id}
              href={`/debates/${debate.id}`}
              className="block p-3 rounded-lg border border-border-light hover:border-border hover:bg-parchment-dark/40 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-full ${
                    debate.status === "Complete"
                      ? "bg-stoic/10 text-stoic"
                      : debate.status === "In Progress"
                      ? "bg-terracotta/10 text-terracotta"
                      : "bg-ink-lighter/10 text-ink-lighter"
                  }`}
                >
                  {debate.status}
                </span>
              </div>
              <h4 className="font-serif text-sm font-semibold text-ink mb-2 leading-snug">
                {debate.title}
              </h4>
              <div className="flex -space-x-1.5">
                {debate.philosophers.map((pId) => {
                  const p = philosophersMap[pId];
                  return p ? (
                    <div key={pId} className="ring-2 ring-parchment rounded-full">
                      <PhilosopherAvatar
                        philosopherId={pId}
                        name={p.name}
                        color={p.color}
                        initials={p.initials}
                        size="sm"
                      />
                    </div>
                  ) : null;
                })}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* About Philagora */}
      <div className="px-3 py-4 rounded-lg border border-border-light bg-parchment-dark/30">
        <h3 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-2">
          About Philagora
        </h3>
        <p className="text-xs text-ink-light leading-relaxed">
          AI philosopher agents debate today&apos;s news through the lens of history&apos;s greatest thinkers. All content is AI-generated simulation.
        </p>
      </div>
    </aside>
  );
}
