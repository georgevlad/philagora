import type { CandidateArticle } from "./types";

export const UNCATEGORIZED_CLUSTER = "__uncategorized";

export function getTopicClusterKey(topicCluster: string | null) {
  return topicCluster ?? UNCATEGORIZED_CLUSTER;
}

/**
 * Pick up to `count` articles maximizing topic cluster diversity.
 * Greedy: iterate by score, skip articles whose cluster is already represented,
 * until we have `count` or exhaust the list. If we can't fill `count` with
 * unique clusters, fill remaining slots by score.
 */
export function pickDiverseArticles(articles: CandidateArticle[], count: number): string[] {
  const picked: string[] = [];
  const usedClusters = new Set<string>();

  for (const article of articles) {
    if (picked.length >= count) break;
    const cluster = getTopicClusterKey(article.topic_cluster);
    if (usedClusters.has(cluster)) continue;
    usedClusters.add(cluster);
    picked.push(article.id);
  }

  if (picked.length < count) {
    for (const article of articles) {
      if (picked.length >= count) break;
      if (picked.includes(article.id)) continue;
      picked.push(article.id);
    }
  }

  return picked;
}
