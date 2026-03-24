/* eslint-disable @next/next/no-img-element */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Footer } from "@/components/Footer";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { PostCard } from "@/components/PostCard";
import { getIdentityFromCookies } from "@/lib/auth";
import { auth } from "@/lib/better-auth";
import { getAllPhilosophers, getBookmarkedPosts, getLikedPosts } from "@/lib/data";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

function getInitials(value: string) {
  return value
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ProfilePage() {
  const identity = await getIdentityFromCookies();

  if (identity.type !== "user") {
    redirect("/sign-in");
  }

  const session = await auth.api.getSession({
    headers: new Headers(await headers()),
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const user = session.user;
  const philosophers = getAllPhilosophers();
  const bookmarkedPosts = getBookmarkedPosts(identity.id);
  const likedPosts = getLikedPosts(identity.id);
  const displayName = user.name || "Philosopher";
  const initials = getInitials(user.name || user.email);

  return (
    <div className="min-h-screen flex flex-col pt-24 lg:flex-row lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 bg-[linear-gradient(180deg,rgba(248,243,234,0.5),rgba(244,239,230,0.12))] lg:border-r lg:border-l border-border-light">
        <div className="mx-auto max-w-[700px] px-4 py-8 sm:py-12">
          <div className="mb-10 flex items-center gap-5">
            {user.image ? (
              <img
                src={user.image}
                alt={`${displayName} avatar`}
                className="h-16 w-16 rounded-full border-2 border-border-light object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-athenian/20 bg-athenian/15 text-lg font-mono font-medium text-athenian">
                {initials}
              </div>
            )}
            <div>
              <h1 className="font-serif text-2xl font-bold text-ink">{displayName}</h1>
              <p className="mt-1 text-sm font-mono text-ink-lighter">{user.email}</p>
            </div>
          </div>

          <div className="mb-8">
            <SignOutButton />
          </div>

          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path
                  d="M3 2H13V14L8 11L3 14V2Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h2 className="font-serif text-lg font-semibold text-ink">Bookmarks</h2>
              {bookmarkedPosts.length > 0 && (
                <span className="text-xs font-mono text-ink-lighter">
                  {bookmarkedPosts.length}
                </span>
              )}
            </div>
            {bookmarkedPosts.length > 0 ? (
              <div className="space-y-0">
                {bookmarkedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border-light/80 bg-parchment-dark/20 px-6 py-8 text-center">
                <p className="text-sm font-body text-ink-lighter">
                  Posts you bookmark will appear here.
                </p>
              </div>
            )}
          </section>

          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path
                  d="M8 14L1.5 7.5C0.5 6.5 0.5 4.5 1.5 3.5C2.5 2.5 4.5 2.5 5.5 3.5L8 6L10.5 3.5C11.5 2.5 13.5 2.5 14.5 3.5C15.5 4.5 15.5 6.5 14.5 7.5L8 14Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h2 className="font-serif text-lg font-semibold text-ink">Liked Posts</h2>
              {likedPosts.length > 0 && (
                <span className="text-xs font-mono text-ink-lighter">
                  {likedPosts.length}
                </span>
              )}
            </div>
            {likedPosts.length > 0 ? (
              <div className="space-y-0">
                {likedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border-light/80 bg-parchment-dark/20 px-6 py-8 text-center">
                <p className="text-sm font-body text-ink-lighter">
                  Posts you like will appear here.
                </p>
              </div>
            )}
          </section>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
