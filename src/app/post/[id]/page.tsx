import { AgoraShell } from "@/components/agora/AgoraShell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { getIdentityFromCookies } from "@/lib/auth";
import { getPostById } from "@/lib/data";
import { toAbsoluteUrl, truncateSeoText } from "@/lib/seo";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo/schema";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = getPostById(id);

  if (!post) {
    return {
      title: "Post Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${post.philosopherName} on Philagora`;
  const description = truncateSeoText(post.thesis || post.content, 160);

  return {
    title,
    description,
    alternates: {
      canonical: `/post/${id}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/post/${id}`,
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const identity = await getIdentityFromCookies();
  const userId = identity.type === "user" ? identity.id : undefined;
  const post = getPostById(id, userId);

  if (!post) {
    notFound();
  }

  const title = `${post.philosopherName} on Philagora`;
  const description = truncateSeoText(post.thesis || post.content, 160);
  const imageUrl = toAbsoluteUrl(`/post/${id}/opengraph-image`);
  const postJsonLd = [
    buildArticleSchema({
      url: `/post/${id}`,
      headline: title,
      description,
      datePublished: post.createdAt,
      dateModified: post.createdAt,
      imageUrl,
    }),
    buildBreadcrumbSchema([
      { name: "Philagora", url: "/" },
      {
        name: post.philosopherName,
        url: `/philosophers/${post.philosopherId}`,
      },
    ]),
  ];

  return (
    <AgoraShell>
      <main id="main" className="public-page public-reading">
        <JsonLd data={postJsonLd} />
        <Link href="/feed" className="agora-text-link">
          ← Back to feed
        </Link>
        <PostCard post={post} expanded />
        <p className="agora-notice">
          An AI interpretation of {post.philosopherName}. This is not a
          historical quotation.
        </p>
        <Link
          href={`/philosophers/${post.philosopherId}`}
          className="agora-text-link"
        >
          More from {post.philosopherName} →
        </Link>
      </main>
    </AgoraShell>
  );
}
