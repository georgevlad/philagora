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
  return post.citation.url || post.citation.title || null;
}

function violatesSameArticleCap(units: FeedUnit[], index: number): boolean {
  const current = units[index];
  if (!current?.articleKey) {
    return false;
  }

  const windowStart = Math.max(0, index - 4);
  let sameArticleCount = 0;

  for (let i = windowStart; i <= index; i += 1) {
    if (units[i]?.articleKey === current.articleKey) {
      sameArticleCount += 1;
    }
  }

  return sameArticleCount > 2;
}

export function interleaveFeed(posts: FeedPost[]): FeedPost[] {
  if (posts.length <= 3) {
    return posts;
  }

  // Phase A: Build article clusters.
  const articleGroups = new Map<string, number[]>();
  const postArticleKey = new Map<string, string>();
  const postsById = new Map(posts.map((post) => [post.id, post]));

  for (let i = 0; i < posts.length; i += 1) {
    const post = posts[i];
    const articleKey = getArticleKey(post);
    const isNewsType = !post.sourceType || post.sourceType === "news";

    if (articleKey && isNewsType && !post.replyTo) {
      const group = articleGroups.get(articleKey) ?? [];
      group.push(i);
      articleGroups.set(articleKey, group);
      postArticleKey.set(post.id, articleKey);
    }
  }

  for (let i = 0; i < posts.length; i += 1) {
    const post = posts[i];
    const isNewsType = !post.sourceType || post.sourceType === "news";

    if (!post.replyTo || !isNewsType) {
      continue;
    }

    let articleKey = getArticleKey(post);

    if (!articleKey) {
      articleKey = postArticleKey.get(post.replyTo) ?? null;
    }

    if (!articleKey) {
      const parent = postsById.get(post.replyTo);
      if (parent) {
        articleKey = getArticleKey(parent);
      }
    }

    if (articleKey && articleGroups.has(articleKey)) {
      const group = articleGroups.get(articleKey)!;
      if (!group.includes(i)) {
        group.push(i);
      }
      postArticleKey.set(post.id, articleKey);
    }
  }

  const units: FeedUnit[] = [];
  const usedIndices = new Set<number>();

  for (const [articleKey, indices] of articleGroups) {
    if (indices.length < 2) {
      continue;
    }

    const standaloneIndices = indices.filter((index) => !posts[index].replyTo).sort((a, b) => a - b);
    const replyIndices = indices.filter((index) => posts[index].replyTo).sort((a, b) => a - b);
    const orderedIndices = [...standaloneIndices, ...replyIndices];
    const clusterPosts: FeedPost[] = [];

    for (const index of orderedIndices) {
      clusterPosts.push(posts[index]);
      usedIndices.add(index);
    }

    units.push({
      posts: clusterPosts,
      articleKey,
      philosopherIds: new Set(clusterPosts.map((post) => post.philosopherId)),
      sourceType: "news",
      stances: new Set(clusterPosts.map((post) => post.stance)),
      tag: clusterPosts[0]?.tag || "",
      isReply: false,
      isQuipOrMock: false,
      isReflection: false,
      originalIndex: Math.min(...orderedIndices),
    });
  }

  for (let i = 0; i < posts.length; i += 1) {
    if (usedIndices.has(i)) {
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

  const freshArticles = new Set<string>();
  const articleTimestamps = new Map<string, number[]>();

  for (const unit of units) {
    if (!unit.articleKey) {
      continue;
    }

    const timestamps = articleTimestamps.get(unit.articleKey) || [];
    for (const post of unit.posts) {
      timestamps.push(new Date(post.createdAt).getTime());
    }
    articleTimestamps.set(unit.articleKey, timestamps);
  }

  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  for (const [key, timestamps] of articleTimestamps) {
    if (timestamps.length < 2) {
      continue;
    }

    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    if (max - min <= FOUR_HOURS_MS) {
      freshArticles.add(key);
    }
  }

  const WINDOW_SIZE = Math.min(units.length, 16);
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

      score -= i * 1.5;
      score -= Math.max(0, candidate.originalIndex - result.length) * 0.15;

      // Heavy penalty for repeating the same cited article or everyday scenario.
      if (candidate.articleKey && !candidate.isReply) {
        const isFresh = freshArticles.has(candidate.articleKey);
        const penalty = isFresh ? 40 : 200;
        for (const recent of result.slice(-6)) {
          if (recent.articleKey === candidate.articleKey) {
            score -= penalty;
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

      for (const recent of result.slice(-5)) {
        if (candidate.sourceType === recent.sourceType) {
          score -= 35;
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
              score += 60;
            } else if (distanceFromParent <= 4) {
              score += 30;
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

  // Phase C: Flatten with cluster annotations.
  const flatPosts: FeedPost[] = [];

  for (const unit of result) {
    const isCluster = unit.posts.length >= 2 && unit.articleKey;

    for (let i = 0; i < unit.posts.length; i += 1) {
      flatPosts.push({
        ...unit.posts[i],
        _clusterId: isCluster ? unit.articleKey : null,
        _clusterOrder: isCluster ? i : undefined,
      });
    }
  }

  return flatPosts;
}
