import Link from "next/link";
import { getQuestionTypeLabel } from "@/lib/agora";
import { getPhilosophersMap, getAllDebates, getRecentAgoraThreads } from "@/lib/data";
import { PhilosopherAvatar } from "./PhilosopherAvatar";

export function RightSidebar() {
  const philosophersMap = getPhilosophersMap();
  const debates = getAllDebates().slice(0, 2);
  const agoraThreads = getRecentAgoraThreads(3);

  return (
    <aside className="hidden xl:block w-72 shrink-0 self-stretch border-l border-border-light/80 bg-parchment-dark/28 shadow-[inset_1px_0_0_rgba(255,255,255,0.35)]">
      <div className="sticky top-0 py-6 px-4">
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
                triggerArticleTitle !== "\u2014";

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
          <Link
            href="/debates"
            className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-mono tracking-wide text-ink-lighter hover:text-athenian transition-colors duration-200"
          >
            See all debates
          </Link>
        </div>

        {/* From The Agora */}
        {agoraThreads.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3 px-1">
              <h3 className="text-[9px] font-mono tracking-[0.28em] uppercase text-ink-faint shrink-0">
                From The Agora
              </h3>
              <div className="flex-1 h-px bg-gradient-to-r from-border-light/20 via-border-light to-border-light/20" />
            </div>
            <div className="space-y-2.5">
              {agoraThreads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/agora/${thread.id}`}
                  className="block px-3.5 py-3 rounded-xl border border-border-light/70 bg-card/60 hover:border-border hover:bg-parchment-tint/90 hover:shadow-[0_8px_20px_rgba(42,36,31,0.05)] hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <p className="text-[13px] font-serif text-ink leading-snug line-clamp-2 group-hover:text-athenian transition-colors duration-200">
                    &ldquo;{thread.question}&rdquo;
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-athenian/8 text-athenian text-[9px] font-mono uppercase tracking-[0.14em]">
                      {getQuestionTypeLabel(thread.question_type)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex -space-x-1.5 shrink-0">
                      {thread.philosophers.slice(0, 3).map((p) => (
                        <div key={p.id} className="ring-2 ring-card rounded-full">
                          <PhilosopherAvatar
                            philosopherId={p.id}
                            name={p.name}
                            color={p.color}
                            initials={p.initials}
                            size="xs"
                          />
                        </div>
                      ))}
                      {thread.philosophers.length > 3 && (
                        <div className="w-5 h-5 rounded-full bg-parchment-dark/60 ring-2 ring-card flex items-center justify-center">
                          <span className="text-[8px] font-mono text-ink-lighter">
                            +{thread.philosophers.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono tracking-wide text-ink-faint uppercase">
                      {thread.asked_by || "Anonymous"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/agora"
              className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-mono tracking-wide text-ink-lighter hover:text-athenian transition-colors duration-200"
            >
              Explore the Agora
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
