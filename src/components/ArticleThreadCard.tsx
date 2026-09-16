"use client";
import { useId, useState } from "react";
import { PostCard } from "./PostCard";
import { SourceCitation } from "./public/SourceCitation";
import type { FeedPost } from "@/lib/types";

export function ArticleThreadCard({ posts }: { posts: FeedPost[] }) {
  const reactions = posts.filter((p) => !p.replyTo);
  const replies = posts.filter((p) => p.replyTo);
  const citation = reactions[0]?.citation || posts[0]?.citation;
  const [showReplies, setShowReplies] = useState(replies.length <= 1);
  const repliesId = useId();
  const tensionPair = findTensionPair(reactions);
  if (!citation)
    return (
      <>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </>
    );
  return (
    <section
      className="public-cluster"
      aria-label={`Perspectives on ${citation.title}`}
    >
      <p className="agora-eyebrow">
        {new Set(posts.map((p) => p.philosopherId)).size} perspectives on one
        story
      </p>
      <SourceCitation citation={citation} />
      {tensionPair && (
        <div className="public-tension">
          {tensionPair.map((p) => (
            <p key={p.id}>
              {p.philosopherName}
              <span>{p.stance}</span>
            </p>
          ))}
        </div>
      )}
      {reactions.map((post) => (
        <PostCard key={post.id} post={post} compact />
      ))}
      {replies.length > 0 && (
        <>
          <button
            className="agora-text-link"
            aria-expanded={showReplies}
            aria-controls={repliesId}
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies
              ? "Hide replies"
              : `Show ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
          </button>
          <div id={repliesId} className="public-cluster-replies">
            {showReplies && replies.map((post) => (
              <PostCard key={post.id} post={post} compact />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function findTensionPair(reactions: FeedPost[]): [FeedPost, FeedPost] | null {
  if (reactions.length < 2) {
    return null;
  }

  for (let i = 0; i < reactions.length; i += 1) {
    for (let j = i + 1; j < reactions.length; j += 1) {
      if (
        reactions[i].philosopherId !== reactions[j].philosopherId &&
        reactions[i].stance !== reactions[j].stance
      ) {
        return [reactions[i], reactions[j]];
      }
    }
  }

  return null;
}
