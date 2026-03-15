import { sharesSameArticle } from "@/lib/feed-utils";
import type { FeedPost } from "@/lib/types";

interface FeedUnit {
  posts: FeedPost[];
  articleKey: string | null;
  philosopherIds: Set<string>;
  sourceType: string;
  stances: Set<FeedPost["stance"]>;
  tag: string;
  isReply: boolean;
  isQuipOrMock: boolean;
  isReflection: boolean;
  originalIndex: number;
}

function getArticleKey(post: FeedPost): string | null {
  if (!post.citation) return null;
  if (post.citation.url) return post.citation.url;
  if (post.citation.title && post.citation.source) {
    return `${post.citation.title}::${post.citation.source}`;
  }
  return post.citation.title || null;
}

export function interleaveFeed(posts: FeedPost[]): FeedPost[] {
  if (posts.length <= 3) {
    return posts;
  }

  const paired = new Set<number>();
  const pairMap = new Map<number, number>();

  for (let i = 0; i < posts.length; i += 1) {
    if (paired.has(i)) {
      continue;
    }

    const first = posts[i];
    if (!getArticleKey(first) || first.replyTo) {
      continue;
    }

    for (let j = i + 1; j < posts.length; j += 1) {
      if (paired.has(j)) {
        continue;
      }

      const second = posts[j];
      if (!getArticleKey(second) || second.replyTo) {
        continue;
      }

      if (
        sharesSameArticle(first, second) &&
        first.philosopherId !== second.philosopherId &&
        first.stance !== second.stance
      ) {
        paired.add(i);
        paired.add(j);
        pairMap.set(i, j);
        pairMap.set(j, i);
        break;
      }
    }
  }

  const units: FeedUnit[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < posts.length; i += 1) {
    if (usedIndices.has(i)) {
      continue;
    }

    const partnerIndex = pairMap.get(i);

    if (partnerIndex !== undefined && !usedIndices.has(partnerIndex)) {
      const first = posts[i];
      const second = posts[partnerIndex];
      usedIndices.add(i);
      usedIndices.add(partnerIndex);

      units.push({
        posts: [first, second],
        articleKey: getArticleKey(first),
        philosopherIds: new Set([first.philosopherId, second.philosopherId]),
        sourceType: first.sourceType || "news",
        stances: new Set([first.stance, second.stance]),
        tag: first.tag || second.tag || "",
        isReply: false,
        isQuipOrMock: false,
        isReflection: false,
        originalIndex: Math.min(i, partnerIndex),
      });

      continue;
    }

    const post = posts[i];
    usedIndices.add(i);

    units.push({
      posts: [post],
      articleKey: getArticleKey(post),
      philosopherIds: new Set([post.philosopherId]),
      sourceType: post.sourceType || "news",
      stances: new Set([post.stance]),
      tag: post.tag || "",
      isReply: Boolean(post.replyTo),
      isQuipOrMock: post.stance === "quips" || post.stance === "mocks",
      isReflection: (post.sourceType || "news") === "reflection",
      originalIndex: i,
    });
  }

  const WINDOW_SIZE = Math.min(units.length, 10);
  const result: FeedUnit[] = [];
  const remaining = [...units];
  const placedPostPositions = new Map<string, number>();

  while (remaining.length > 0) {
    const windowEnd = Math.min(remaining.length, WINDOW_SIZE);
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < windowEnd; i += 1) {
      const candidate = remaining[i];
      const lastUnit = result.at(-1) ?? null;
      const lastTwoUnits = result.slice(-2);
      const lastThreeUnits = result.slice(-3);
      let score = 0;

      score -= i * 3;
      score -= Math.max(0, candidate.originalIndex - result.length) * 0.15;

      if (candidate.articleKey) {
        for (const recent of result.slice(-4)) {
          if (recent.articleKey === candidate.articleKey) {
            score -= 120;
          }
        }
      }

      for (const recent of lastTwoUnits) {
        for (const philosopherId of candidate.philosopherIds) {
          if (recent.philosopherIds.has(philosopherId)) {
            score -= 40;
          }
        }
      }

      for (const recent of lastThreeUnits) {
        if (candidate.sourceType === recent.sourceType) {
          score -= 20;
        }
      }

      if (lastUnit) {
        for (const stance of candidate.stances) {
          if (lastUnit.stances.has(stance)) {
            score -= 12;
          }
        }
      }

      if (candidate.tag) {
        for (const recent of lastTwoUnits) {
          if (recent.tag && recent.tag === candidate.tag) {
            score -= 8;
          }
        }
      }

      if (candidate.isQuipOrMock) {
        const recentNonQuips = lastThreeUnits.filter((unit) => !unit.isQuipOrMock);
        if (recentNonQuips.length >= 3) {
          score += 25;
        }
      }

      if (candidate.isReflection) {
        const recentNewsUnits = result
          .slice(-4)
          .filter((unit) => unit.sourceType === "news");
        if (recentNewsUnits.length >= 3) {
          score += 20;
        }
      }

      if (candidate.isReply) {
        const recentStandaloneUnits = lastThreeUnits.filter((unit) => !unit.isReply);
        if (recentStandaloneUnits.length >= 3) {
          score += 15;
        }

        const replyTargetId = candidate.posts[0]?.replyTo;
        if (replyTargetId) {
          const placedParentIndex = placedPostPositions.get(replyTargetId);

          if (placedParentIndex !== undefined) {
            const distanceFromParent = result.length - placedParentIndex;
            if (distanceFromParent <= 2) {
              score += 35;
            } else if (distanceFromParent <= 4) {
              score += 18;
            } else if (distanceFromParent >= 8) {
              score -= 12;
            }
          } else {
            const parentRemainingIndex = remaining.findIndex((unit) =>
              unit.posts.some((post) => post.id === replyTargetId)
            );

            if (parentRemainingIndex >= 0 && parentRemainingIndex < windowEnd) {
              score -= 18;
            } else if (parentRemainingIndex >= 0 && parentRemainingIndex < windowEnd + 4) {
              score -= 8;
            }
          }
        }
      }

      if (candidate.sourceType === "historical_event" || candidate.sourceType === "everyday") {
        const recentNewsUnits = lastThreeUnits.filter((unit) => unit.sourceType === "news");
        if (recentNewsUnits.length >= 2) {
          score += 18;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const [selectedUnit] = remaining.splice(bestIndex, 1);
    result.push(selectedUnit);

    const placedIndex = result.length - 1;
    for (const post of selectedUnit.posts) {
      placedPostPositions.set(post.id, placedIndex);
    }
  }

  return result.flatMap((unit) => unit.posts);
}
