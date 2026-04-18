import { existsSync } from "fs";
import { join } from "path";
import type { MetadataRoute } from "next";
import {
  getAllPhilosophers,
  getAllPublicAgoraThreadIds,
  getAllPublicDebateIds,
  getAllPublicPostIds,
} from "@/lib/data";
import { toAbsoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

type SitemapItem = MetadataRoute.Sitemap[number];

function buildRouteEntry(
  path: string,
  changeFrequency: NonNullable<SitemapItem["changeFrequency"]>,
  priority: number,
  lastModified?: string
): SitemapItem {
  return {
    url: toAbsoluteUrl(path),
    changeFrequency,
    priority,
    lastModified,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    buildRouteEntry("/", "daily", 1),
    buildRouteEntry("/debates", "weekly", 0.8),
    buildRouteEntry("/agora", "weekly", 0.8),
    buildRouteEntry("/schools", "weekly", 0.8),
  ];

  if (existsSync(join(process.cwd(), "src", "app", "about", "page.tsx"))) {
    staticRoutes.push(buildRouteEntry("/about", "monthly", 0.5));
  }

  const postRoutes = getAllPublicPostIds().map((post) =>
    buildRouteEntry(`/post/${post.id}`, "weekly", 0.7, post.updatedAt)
  );
  const debateRoutes = getAllPublicDebateIds().map((debate) =>
    buildRouteEntry(`/debates/${debate.id}`, "weekly", 0.7, debate.updatedAt)
  );
  const agoraRoutes = getAllPublicAgoraThreadIds().map((thread) =>
    buildRouteEntry(`/agora/${thread.id}`, "weekly", 0.7, thread.updatedAt)
  );
  const philosopherRoutes = getAllPhilosophers().map((philosopher) =>
    buildRouteEntry(`/philosophers/${philosopher.id}`, "monthly", 0.6)
  );

  return [
    ...staticRoutes,
    ...postRoutes,
    ...debateRoutes,
    ...agoraRoutes,
    ...philosopherRoutes,
  ];
}
