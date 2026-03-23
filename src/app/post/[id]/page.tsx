import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { getPostById } from "@/lib/data";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = getPostById(id);

  if (!post) {
    return { title: "Post Not Found - Philagora" };
  }

  const title = `${post.philosopherName} on Philagora`;
  const description = post.thesis || post.content.slice(0, 160);
  const ogImage = post.thumbnailUrl
    ? `https://philagora.social${post.thumbnailUrl}`
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "Philagora",
      url: `https://philagora.social/post/${id}`,
      images: ogImage ? [{ url: ogImage, width: 1024, height: 576 }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const post = getPostById(id);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-parchment">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
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
