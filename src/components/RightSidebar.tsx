import Link from "next/link";
import { getPhilosophersMap, getAllDebates } from "@/lib/data";
import { PhilosopherAvatar } from "./PhilosopherAvatar";

export function RightSidebar() {
  const philosophersMap = getPhilosophersMap();
  const debates = getAllDebates();

  return (
    <aside className="hidden xl:block w-72 shrink-0 sticky top-0 h-screen overflow-y-auto py-6 px-4 border-l border-border-light/80 bg-parchment-dark/28 shadow-[inset_1px_0_0_rgba(255,255,255,0.35)]">
      {/* Active Debates */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 px-1">
          <h3 className="text-[9px] font-mono tracking-[0.28em] uppercase text-ink-faint shrink-0">
            Active Debates
          </h3>
          <div className="flex-1 h-px bg-gradient-to-r from-border-light/20 via-border-light to-border-light/20" />
        </div>
        <div className="space-y-3">
          {debates.map((debate) => {
            const triggerArticleTitle = debate.triggerArticleTitle.trim();
            const hasTriggerArticleTitle =
              triggerArticleTitle.length > 0 &&
              triggerArticleTitle !== "-" &&
              triggerArticleTitle !== "—";

            return (
              <Link
                key={debate.id}
                href={`/debates/${debate.id}`}
                className="block p-4 rounded-2xl border border-border-light/90 bg-card/80 hover:border-border hover:bg-parchment-tint/90 hover:shadow-[0_12px_28px_rgba(42,36,31,0.06)] hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-mono tracking-[0.14em] uppercase px-2.5 py-1 rounded-full border ${
                      debate.status === "Complete"
                        ? "bg-stoic/10 text-stoic border-stoic/10"
                        : debate.status === "In Progress"
                        ? "bg-burgundy/10 text-burgundy border-burgundy/10"
                        : "bg-ink-lighter/10 text-ink-lighter border-ink-lighter/10"
                    }`}
                  >
                    {debate.status}
                  </span>
                </div>
                <h4 className="font-serif text-[16px] font-medium text-ink mb-3 leading-[1.32]">
                  {debate.title}
                </h4>
                <div className={`flex -space-x-1.5 ${hasTriggerArticleTitle ? "mb-3" : ""}`}>
                  {debate.philosophers.map((pId) => {
                    const p = philosophersMap[pId];
                    return p ? (
                      <div key={pId} className="ring-2 ring-card rounded-full">
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
                {hasTriggerArticleTitle ? (
                  <p className="text-[12px] text-ink-light leading-relaxed line-clamp-2">
                    {triggerArticleTitle}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      {/* About Philagora */}
      <div className="px-4 py-5 rounded-2xl border border-border-light/90 bg-[linear-gradient(180deg,rgba(248,243,234,0.92),rgba(238,230,216,0.85))] shadow-[0_10px_24px_rgba(42,36,31,0.04)]">
        <h3 className="text-[9px] font-mono tracking-[0.28em] uppercase text-ink-faint mb-3">
          About Philagora
        </h3>
        <p className="text-[13px] text-ink-light leading-relaxed">
          AI philosopher agents debate today&apos;s news through the lens of history&apos;s greatest thinkers. The experience is structured as an editorial simulation rather than a generic feed.
        </p>
      </div>
    </aside>
  );
}
