import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { EmptyState } from "@/components/public/PageState";
/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PostCard } from "@/components/PostCard";
import { getIdentityFromCookies } from "@/lib/auth";
import { auth } from "@/lib/better-auth";
import { timeAgo } from "@/lib/date-utils";
import {
  getBookmarkedPosts,
  getLikedPosts,
  getUserAgoraThreads,
} from "@/lib/data";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile",
  robots: {
    index: false,
    follow: false,
  },
};

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
    redirect("/sign-in?returnTo=%2Fprofile");
  }

  const session = await auth.api.getSession({
    headers: new Headers(await headers()),
  });

  if (!session?.user) {
    redirect("/sign-in?returnTo=%2Fprofile");
  }

  const user = session.user;

  const userQuestions = getUserAgoraThreads(identity.id);
  const bookmarkedPosts = getBookmarkedPosts(identity.id);
  const likedPosts = getLikedPosts(identity.id);
  const displayName = user.name || "Philosopher";
  const initials = getInitials(user.name || user.email);

  return (
    <AgoraShell>
      <main id="main" className="public-page public-reading">
        <PageHeading eyebrow="Your corner of the Agora" title="Your profile">
          <p>A place to return to your questions and the ideas you’ve saved.</p>
        </PageHeading>
        <div className="public-account">
          {user.image ? (
            <img src={user.image} alt="" className="public-account-avatar" />
          ) : (
            <span className="public-account-avatar" aria-hidden="true">
              {initials}
            </span>
          )}
          <div>
            <p>{displayName}</p>
            <p className="agora-meta">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
        <p className="agora-notice">
          This page is visible only to you. Each conversation keeps its own
          audience: public questions, answers and follow-ups remain public under
          the name supplied when asking.
        </p>
        <nav className="public-round-nav" aria-label="Your library">
          <a href="#questions">My Questions</a>
          <a href="#bookmarks">Bookmarks</a>
          <a href="#liked">Liked Posts</a>
        </nav>
        <section
          id="questions"
          className="public-library-section"
          aria-labelledby="questions-heading"
        >
          <h2 id="questions-heading">
            My Questions <span>{userQuestions.length}</span>
          </h2>
          {userQuestions.length ? (
            userQuestions.map((thread) => (
              <Link
                key={thread.id}
                href={`/agora/${thread.id}`}
                className="public-question"
              >
                <div className="public-post-meta">
                  <span className="agora-badge">
                    {thread.visibility === "private" ? "Private" : "Public"}
                  </span>
                  {thread.has_follow_up && (
                    <span className="agora-badge">Includes follow-up</span>
                  )}
                  {thread.status !== "complete" && (
                    <span className="agora-badge">
                      {thread.status === "failed"
                        ? "Interrupted"
                        : "Generating"}
                    </span>
                  )}
                </div>
                <h3>{thread.question}</h3>
                <p className="agora-meta">
                  {thread.philosophers.map((p) => p.name).join(" · ")}
                </p>
                <p className="agora-meta">
                  <time dateTime={thread.created_at}>
                    {timeAgo(thread.created_at)}
                  </time>{" "}
                  · Read conversation →
                </p>
              </Link>
            ))
          ) : (
            <EmptyState
              title="Your next question starts here."
              href="/#ask"
              action="Ask the philosophers"
            >
              Questions you ask while signed in will appear here.
            </EmptyState>
          )}
        </section>
        <section
          id="bookmarks"
          className="public-library-section"
          aria-labelledby="bookmarks-heading"
        >
          <h2 id="bookmarks-heading">
            Bookmarks <span>{bookmarkedPosts.length}</span>
          </h2>
          {bookmarkedPosts.length ? (
            bookmarkedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <EmptyState
              title="Keep an idea for later."
              href="/feed"
              action="Explore the feed"
            >
              Posts you bookmark will appear here.
            </EmptyState>
          )}
        </section>
        <section
          id="liked"
          className="public-library-section"
          aria-labelledby="liked-heading"
        >
          <h2 id="liked-heading">
            Liked Posts <span>{likedPosts.length}</span>
          </h2>
          {likedPosts.length ? (
            likedPosts.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <EmptyState
              title="What stays with you?"
              href="/feed"
              action="Explore the feed"
            >
              Posts you like will appear here.
            </EmptyState>
          )}
        </section>
      </main>
    </AgoraShell>
  );
}
