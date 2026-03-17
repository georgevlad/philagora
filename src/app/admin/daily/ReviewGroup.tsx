import { Spinner } from "@/components/Spinner";
import { STANCE_CONFIG } from "@/lib/constants";
import { ITEM_STATUS_CLASSES, truncate, type ReviewItem } from "./types";

export function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-1">{label}</p>
      <p className="font-serif text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function recommendationMediumLabel(medium?: string) {
  switch ((medium ?? "").toLowerCase()) {
    case "film":
      return "Film";
    case "music":
      return "Music";
    case "book":
      return "Book";
    case "tv":
      return "TV";
    case "podcast":
      return "Podcast";
    default:
      return "Recommendation";
  }
}

export function ReviewGroup({
  title,
  description,
  items,
  busyItemId,
  selectedDraftIds,
  onToggleSelection,
  onPublish,
  onRegenerate,
  onDelete,
}: {
  title: string;
  description: string;
  items: ReviewItem[];
  busyItemId: string | null;
  selectedDraftIds: string[];
  onToggleSelection: (postId: string) => void;
  onPublish: (item: ReviewItem) => Promise<void> | void;
  onRegenerate: (item: ReviewItem) => Promise<void> | void;
  onDelete: (item: ReviewItem) => Promise<void> | void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-4">
        <h3 className="font-serif text-xl font-bold text-ink">{title}</h3>
        <p className="text-sm text-ink-lighter mt-1">{description}</p>
      </div>
      <div className="space-y-4">
        {items.map((item) => {
          const stance = STANCE_CONFIG[item.stance];
          const isBusy = busyItemId === item.post_id;
          const isDraft = item.status === "draft";
          return (
            <article
              key={item.post_id}
              className="rounded-xl border border-border bg-parchment px-5 py-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedDraftIds.includes(item.post_id)}
                    disabled={!isDraft}
                    onChange={() => onToggleSelection(item.post_id)}
                    className="mt-1 h-4 w-4 rounded border-border text-terracotta focus:ring-terracotta disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-serif font-bold text-lg text-ink">{item.philosopher_name}</span>
                      <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full ${ITEM_STATUS_CLASSES[item.status]}`}>
                        {item.status}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full border border-border-light bg-white text-ink-lighter">
                        {item.length}
                      </span>
                      <span
                        className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full"
                        style={{
                          backgroundColor: stance.bg,
                          color: stance.color,
                          border: `1px solid ${stance.border}`,
                        }}
                      >
                        {stance.label}
                      </span>
                    </div>

                    {item.type === "news_reaction" && item.article_title && (
                      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-2">
                        Reacting to {item.article_title}
                      </p>
                    )}
                    {item.type === "cross_reply" && item.reply_to_philosopher && (
                      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-2">
                        {item.reply_to_philosopher} to {item.philosopher_name}
                      </p>
                    )}
                    {item.type === "timeless_reflection" && item.prompt_seed && (
                      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-2">
                        {truncate(item.prompt_seed, 80)}
                      </p>
                    )}
                    {item.type === "cultural_recommendation" && item.recommendation_title && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-800">
                          {recommendationMediumLabel(item.recommendation_medium)}
                        </span>
                        <p className="text-sm font-serif font-semibold text-ink">
                          Recommends {item.recommendation_title}
                        </p>
                      </div>
                    )}

                    <p className="font-serif text-xl font-bold text-ink leading-snug mb-3">
                      {item.thesis}
                    </p>
                    <div className="rounded-lg border border-border-light bg-white px-4 py-4">
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {truncate(item.content, 320)}
                      </p>
                    </div>
                    <div className="mt-3 inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full border border-border-light bg-white text-ink-lighter">
                      {item.tag}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 lg:pl-4">
                  <button
                    onClick={() => void onPublish(item)}
                    disabled={!isDraft || isBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono tracking-wide rounded-full text-white bg-[#276749] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBusy ? <><Spinner /> Working</> : "Publish"}
                  </button>
                  <button
                    onClick={() => void onRegenerate(item)}
                    disabled={!isDraft || isBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono tracking-wide rounded-full border border-border-light text-ink-lighter hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => void onDelete(item)}
                    disabled={!isDraft || isBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono tracking-wide rounded-full border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
