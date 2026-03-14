import { useState } from "react";
import type React from "react";
import { publishPriority, type DailyGeneratedItem, type DraftStatus, type ReviewItem } from "./types";

export function useReviewActions({
  reviewItems,
  setReviewItems,
  selectedDraftIds,
  setSelectedDraftIds,
  setError,
  setNotice,
}: {
  reviewItems: ReviewItem[];
  setReviewItems: React.Dispatch<React.SetStateAction<ReviewItem[]>>;
  selectedDraftIds: string[];
  setSelectedDraftIds: React.Dispatch<React.SetStateAction<string[]>>;
  setError: (msg: string | null) => void;
  setNotice: (msg: string | null) => void;
}) {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [bulkPublishing, setBulkPublishing] = useState(false);

  function getDependentReplies(postId: string) {
    return reviewItems.filter(
      (item) =>
        item.type === "cross_reply" &&
        item.reply_to_post_id === postId &&
        item.status === "draft"
    );
  }

  async function publishSingleItem(item: ReviewItem) {
    const postResponse = await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.post_id, status: "published" }),
    });
    if (!postResponse.ok) throw new Error(`Failed to publish ${item.philosopher_name}.`);

    const logResponse = await fetch("/api/admin/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.generation_log_id, status: "published" }),
    });
    if (!logResponse.ok) throw new Error(`Failed to update the generation log for ${item.philosopher_name}.`);

    setReviewItems((current) =>
      current.map((entry) =>
        entry.post_id === item.post_id ? { ...entry, status: "published" } : entry
      )
    );
    setSelectedDraftIds((current) => current.filter((id) => id !== item.post_id));
  }

  async function handlePublishItem(item: ReviewItem) {
    if (item.status !== "draft") return;
    setBusyItemId(item.post_id);
    setError(null);

    try {
      await publishSingleItem(item);
      setNotice(`${item.philosopher_name} published.`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Failed to publish item.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function deleteSingleItem(item: ReviewItem) {
    const postResponse = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.post_id }),
    });
    if (!postResponse.ok) throw new Error(`Failed to delete ${item.philosopher_name}.`);

    const logResponse = await fetch("/api/admin/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.generation_log_id, status: "rejected" }),
    });
    if (!logResponse.ok) throw new Error(`Failed to update the generation log for ${item.philosopher_name}.`);

    setReviewItems((current) =>
      current.map((entry) =>
        entry.post_id === item.post_id ? { ...entry, status: "deleted" } : entry
      )
    );
    setSelectedDraftIds((current) => current.filter((id) => id !== item.post_id));
  }

  async function handleDeleteItem(item: ReviewItem) {
    if (item.status !== "draft") return;
    const dependentReplies = item.type === "news_reaction" ? getDependentReplies(item.post_id) : [];
    const publishedReplies = reviewItems.filter(
      (entry) =>
        entry.type === "cross_reply" &&
        entry.reply_to_post_id === item.post_id &&
        entry.status === "published"
    );
    if (publishedReplies.length > 0) {
      setError("Publish-state replies already exist for this reaction. Leave the parent in place and manage the replies individually.");
      return;
    }
    const itemsToDelete = [...dependentReplies, item];
    const confirmed = window.confirm(
      dependentReplies.length > 0
        ? `Delete this reaction and its ${dependentReplies.length} dependent repl${dependentReplies.length === 1 ? "y" : "ies"}?`
        : "Delete this draft?"
    );
    if (!confirmed) return;

    setBusyItemId(item.post_id);
    setError(null);

    try {
      for (const entry of itemsToDelete) {
        await deleteSingleItem(entry);
      }
      setNotice(
        dependentReplies.length > 0
          ? `Deleted ${item.philosopher_name}'s reaction and its dependent replies.`
          : `${item.philosopher_name}'s draft was deleted.`
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete draft.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRegenerateItem(item: ReviewItem) {
    if (item.status !== "draft") return;

    const publishedReplies = reviewItems.filter(
      (entry) =>
        entry.type === "cross_reply" &&
        entry.reply_to_post_id === item.post_id &&
        entry.status === "published"
    );
    if (item.type === "news_reaction" && publishedReplies.length > 0) {
      setError("Publish-state replies already exist for this reaction. Regenerate those replies separately after creating a new parent manually if needed.");
      return;
    }

    setBusyItemId(item.post_id);
    setError(null);
    setNotice(null);

    try {
      const dependentReplies = item.type === "news_reaction" ? getDependentReplies(item.post_id) : [];
      const response = await fetch("/api/admin/daily-generate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: item.post_id,
          generation_log_id: item.generation_log_id,
          type: item.type,
          length: item.length,
          article_candidate_id: item.article_candidate_id,
          reply_to_post_id: item.reply_to_post_id,
          prompt_seed: item.prompt_seed,
          dependent_replies: dependentReplies.map((reply) => ({
            post_id: reply.post_id,
            generation_log_id: reply.generation_log_id,
          })),
        }),
      });
      const data = (await response.json()) as
        | { error: string }
        | {
            success: boolean;
            item: DailyGeneratedItem;
            deleted_reply_post_ids: string[];
          };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to regenerate item.");
      }

      const payload = data as {
        success: boolean;
        item: DailyGeneratedItem;
        deleted_reply_post_ids: string[];
      };

      setReviewItems((current) =>
        current.map((entry) => {
          if (entry.post_id === payload.item.post_id) {
            return { ...payload.item, status: "draft" as DraftStatus };
          }
          if (payload.deleted_reply_post_ids.includes(entry.post_id)) {
            return { ...entry, status: "deleted" as DraftStatus };
          }
          return entry;
        })
      );
      setSelectedDraftIds((current) => {
        const next = current.filter((id) => !payload.deleted_reply_post_ids.includes(id));
        return next.includes(payload.item.post_id) ? next : [...next, payload.item.post_id];
      });
      setNotice(
        payload.deleted_reply_post_ids.length > 0
          ? "Draft regenerated. Dependent replies were removed so they can be regenerated from the new parent." 
          : "Draft regenerated."
      );
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "Failed to regenerate item.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleBulkPublish(mode: "all" | "selected") {
    const draftItems = reviewItems.filter((item) => item.status === "draft");
    const itemsToPublish = (
      mode === "all"
        ? draftItems
        : draftItems.filter((item) => selectedDraftIds.includes(item.post_id))
    ).sort((left, right) => publishPriority(left.type) - publishPriority(right.type));

    if (itemsToPublish.length === 0) {
      setError(mode === "all" ? "There are no draft items to publish." : "Select at least one draft to publish.");
      return;
    }

    setBulkPublishing(true);
    setError(null);

    try {
      for (const item of itemsToPublish) {
        await publishSingleItem(item);
      }
      setNotice(
        mode === "all"
          ? `Published ${itemsToPublish.length} draft${itemsToPublish.length === 1 ? "" : "s"}.`
          : `Published ${itemsToPublish.length} selected draft${itemsToPublish.length === 1 ? "" : "s"}.`
      );
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Failed to publish drafts.");
    } finally {
      setBulkPublishing(false);
    }
  }

  return {
    busyItemId,
    bulkPublishing,
    handlePublishItem,
    handleDeleteItem,
    handleRegenerateItem,
    handleBulkPublish,
  };
}
