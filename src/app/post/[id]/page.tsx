import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { getIdentityFromCookies } from "@/lib/auth";
import { getPostById } from "@/lib/data";
import { toAbsoluteUrl, truncateSeoText } from "@/lib/seo";
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
} from "@/lib/seo/schema";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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
      { name: post.philosopherName, url: `/philosophers/${post.philosopherId}` },
    ]),
  ];

  return (
    <main className="min-h-screen bg-parchment">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <JsonLd data={postJsonLd} />
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-mono text-ink-lighter transition-colors hover:text-athenian"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 4L6 8L10 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to feed
        </Link>

        <PostCard post={post} expanded />

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-ink-lighter transition-colors hover:text-athenian"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 4L6 8L10 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to feed
          </Link>
        </div>
      </div>
    </main>
  );
}
