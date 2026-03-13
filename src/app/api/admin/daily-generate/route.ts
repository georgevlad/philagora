import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";
import type { TargetLength } from "@/lib/content-templates";
import type { Stance } from "@/lib/types";

type DailyItemType = "news_reaction" | "cross_reply" | "timeless_reflection";
type LengthStrategy = "varied" | TargetLength;

interface DailyGenerateRequest {
  article_ids: string[];
  config: {
    reactions_per_article: number;
    cross_replies: number;
    timeless_reflections: number;
    excluded_philosophers: string[];
    length_strategy: LengthStrategy;
  };
}

interface DailyRegenerateRequest {
  post_id: string;
  generation_log_id: number;
  type: DailyItemType;
  length: TargetLength;
  article_candidate_id?: string;
  reply_to_post_id?: string;
  prompt_seed?: string;
  dependent_replies?: Array<{
    post_id: string;
    generation_log_id?: number;
  }>;
}

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
}

interface ArticleCandidateRow {
  id: string;
  source_id: string;
  title: string;
  url: string;
  description: string;
  score: number | null;
  suggested_philosophers: string;
  suggested_stances: string;
  philosophical_entry_point: string | null;
  image_url: string | null;
  status: string;
  source_name: string;
}

interface StoredPostRow {
  id: string;
  philosopher_id: string;
  philosopher_name: string;
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  citation_image_url: string | null;
  reply_to: string | null;
  status: string;
}

interface GeneratedPostPayload {
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
}

interface DailyGeneratedItem {
  type: DailyItemType;
  post_id: string;
  generation_log_id: number;
  philosopher_id: string;
  philosopher_name: string;
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  length: TargetLength;
  article_candidate_id?: string;
  article_title?: string;
  reply_to_post_id?: string;
  reply_to_philosopher?: string;
  prompt_seed?: string;
}

const VALID_STANCES = new Set<Stance>([
  "challenges",
  "defends",
  "reframes",
  "questions",
  "warns",
  "observes",
  "diagnoses",
  "provokes",
  "laments",
]);

const CROSS_REPLY_CANDIDATES: Record<string, string[]> = {
  "marcus-aurelius": ["nietzsche", "camus", "kierkegaard", "dostoevsky", "russell"],
  seneca: ["nietzsche", "camus", "kierkegaard", "dostoevsky", "russell"],
  nietzsche: ["kant", "confucius", "marcus-aurelius", "seneca", "cicero"],
  camus: ["confucius", "marcus-aurelius", "seneca", "plato", "cicero"],
  confucius: ["nietzsche", "camus", "russell", "dostoevsky", "jung"],
  kant: ["nietzsche", "camus", "jung", "dostoevsky", "cicero"],
  plato: ["russell", "nietzsche", "camus", "cicero", "jung"],
  jung: ["russell", "kant", "cicero", "confucius", "marcus-aurelius"],
  kierkegaard: ["russell", "confucius", "marcus-aurelius", "seneca", "cicero"],
  dostoevsky: ["russell", "confucius", "marcus-aurelius", "seneca", "kant"],
  russell: ["jung", "plato", "dostoevsky", "kierkegaard", "nietzsche"],
  cicero: ["nietzsche", "camus", "jung", "russell", "plato"],
};

const PROVOCATION_PRIORITY: Record<Stance, number> = {
  provokes: 7,
  challenges: 6,
  warns: 5,
  diagnoses: 4,
  questions: 4,
  reframes: 3,
  laments: 3,
  defends: 2,
  observes: 1,
};

const TIMELESS_PROMPTS = [
  "Write a reflection on why people fear silence and what it reveals about the modern condition.",
  "Write a reflection on the difference between being productive and being useful.",
  "Write a reflection on what we lose when we optimize everything in life.",
  "Write a reflection on why people crave certainty and whether that craving is healthy.",
  "Write a reflection on the relationship between comfort and character.",
  "Write a reflection on what it means to truly pay attention in an age of distraction.",
  "Write a reflection on the tension between individual ambition and duty to others.",
  "Write a reflection on why we admire people who suffer for their principles.",
  "Write a reflection on the difference between loneliness and solitude.",
  "Write a reflection on whether technology brings people closer or pushes them apart.",
  "Write a reflection on the role of failure in building a meaningful life.",
  "Write a reflection on why humans create art even when survival is not at stake.",
  "Write a reflection on what we owe the future and whether the present is enough.",
  "Write a reflection on the paradox of choice and whether more freedom makes us happier.",
  "Write a reflection on the difference between knowing yourself and constructing yourself.",
  "Write a reflection on why forgiveness is difficult and whether it is always virtuous.",
  "Write a reflection on what courage looks like in ordinary life, not just on battlefields.",
  "Write a reflection on whether happiness is something to be pursued or something that arrives.",
  "Write a reflection on the relationship between memory and identity.",
  "Write a reflection on why people resist change even when they know it would be good for them.",
  "Write a reflection on what it means to live honestly in a world that rewards performance.",
  "Write a reflection on the tension between justice and mercy.",
  "Write a reflection on why we tell stories and what happens when we stop.",
  "Write a reflection on the difference between wisdom and intelligence.",
  "Write a reflection on what death teaches the living about how to spend their time.",
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DailyGenerateRequest;
    const validationError = validateGenerateRequest(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const db = getDb();
    const config = body.config;
    const excludedIds = new Set(config.excluded_philosophers);
    const allPhilosophers = db
      .prepare("SELECT id, name, tradition, color, initials FROM philosophers ORDER BY name ASC")
      .all() as PhilosopherRow[];
    const philosophersById = new Map(allPhilosophers.map((row) => [row.id, row]));

    const selectedArticles = Array.from(new Set(body.article_ids))
      .map((articleId) => getArticleCandidate(db, articleId))
      .filter((article): article is ArticleCandidateRow => Boolean(article));

    if (selectedArticles.length === 0) {
      return NextResponse.json(
        { error: "No valid scored articles were found for generation." },
        { status: 400 }
      );
    }

    const usedPhilosopherIds = new Set<string>();
    const errors: string[] = [];
    const generated: DailyGeneratedItem[] = [];
    const newsReactions: DailyGeneratedItem[] = [];

    for (const article of selectedArticles) {
      const suggestedIds = parseJson<string[]>(article.suggested_philosophers, []);
      const selectedIds = pickReactionPhilosophers({
        allPhilosophers,
        excludedIds,
        usedPhilosopherIds,
        suggestedIds,
        count: config.reactions_per_article,
      });

      let articleSucceeded = false;

      for (const philosopherId of selectedIds) {
        const philosopher = philosophersById.get(philosopherId);
        if (!philosopher) continue;

        const length = resolveTargetLength(config.length_strategy);
        const sourceMaterial = buildArticleSourceMaterial(article);
        const item = await generateDailyDraft({
          philosopher,
          type: "news_reaction",
          dbContentType: "post",
          sourceMaterial,
          targetLength: length,
          citation: {
            title: article.title,
            source: article.source_name,
            url: article.url,
            imageUrl: article.image_url,
          },
          articleCandidateId: article.id,
          articleTitle: article.title,
        });

        if (!item.success) {
          errors.push(`${philosopher.name} on "${article.title}": ${item.error}`);
          await sleep(500);
          continue;
        }

        usedPhilosopherIds.add(philosopher.id);
        generated.push(item.data);
        newsReactions.push(item.data);
        articleSucceeded = true;
        await sleep(500);
      }

      if (articleSucceeded) {
        db.prepare("UPDATE article_candidates SET status = 'used' WHERE id = ?").run(article.id);
      }
    }

    const crossReplyTargets = [...newsReactions]
      .sort((a, b) => PROVOCATION_PRIORITY[b.stance] - PROVOCATION_PRIORITY[a.stance])
      .slice(0, Math.min(config.cross_replies, newsReactions.length));

    for (const reaction of crossReplyTargets) {
      const sourcePhilosopher = philosophersById.get(reaction.philosopher_id);
      if (!sourcePhilosopher) continue;

      const respondingPhilosopher = pickContrastingRespondent({
        sourcePhilosopher,
        allPhilosophers,
        excludedIds,
        usedPhilosopherIds,
      });

      if (!respondingPhilosopher) {
        errors.push(`No contrasting philosopher available for ${sourcePhilosopher.name}.`);
        continue;
      }

      const sourcePost = getStoredPost(db, reaction.post_id);
      if (!sourcePost) {
        errors.push(`Could not load source reaction ${reaction.post_id} for cross-reply generation.`);
        continue;
      }

      const sourceMaterial = buildCrossReplySourceMaterial(sourcePost);
      const length = resolveTargetLength(config.length_strategy);
      const item = await generateDailyDraft({
        philosopher: respondingPhilosopher,
        type: "cross_reply",
        dbContentType: "post",
        sourceMaterial,
        targetLength: length,
        citation: {
          title: sourcePost.citation_title,
          source: sourcePost.citation_source,
          url: sourcePost.citation_url,
          imageUrl: sourcePost.citation_image_url,
        },
        replyTo: reaction.post_id,
        replyToPhilosopher: sourcePhilosopher.name,
      });

      if (!item.success) {
        errors.push(
          `${respondingPhilosopher.name} replying to ${sourcePhilosopher.name}: ${item.error}`
        );
        await sleep(500);
        continue;
      }

      usedPhilosopherIds.add(respondingPhilosopher.id);
      generated.push(item.data);
      await sleep(500);
    }

    const recentPrompts = getRecentTimelessPrompts(db);
    const reflectionCandidates = shuffle(
      allPhilosophers.filter(
        (philosopher) =>
          !excludedIds.has(philosopher.id) && !usedPhilosopherIds.has(philosopher.id)
      )
    ).slice(0, config.timeless_reflections);
    const promptsUsedThisRun = new Set<string>();

    for (const philosopher of reflectionCandidates) {
      const promptSeed = pickTimelessPrompt({
        recentPrompts,
        promptsUsedThisRun,
      });

      if (!promptSeed) {
        errors.push(`No timeless prompt available for ${philosopher.name}.`);
        continue;
      }

      const length = resolveTargetLength(config.length_strategy);
      const item = await generateDailyDraft({
        philosopher,
        type: "timeless_reflection",
        dbContentType: "reflection",
        sourceMaterial: promptSeed,
        targetLength: length,
        promptSeed,
      });

      if (!item.success) {
        errors.push(`${philosopher.name} reflection: ${item.error}`);
        await sleep(500);
        continue;
      }

      promptsUsedThisRun.add(promptSeed);
      usedPhilosopherIds.add(philosopher.id);
      generated.push(item.data);
      await sleep(500);
    }

    return NextResponse.json({
      success: generated.length > 0,
      summary: buildSummary(generated, errors),
      generated,
    });
  } catch (error) {
    console.error("Daily generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily generation failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as DailyRegenerateRequest;
    const validationError = validateRegenerateRequest(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const db = getDb();
    const existingPost = getStoredPost(db, body.post_id);
    if (!existingPost) {
      return NextResponse.json({ error: "Draft post not found." }, { status: 404 });
    }

    if (existingPost.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft posts can be regenerated." },
        { status: 400 }
      );
    }

    const philosopher = db
      .prepare("SELECT id, name, tradition, color, initials FROM philosophers WHERE id = ?")
      .get(existingPost.philosopher_id) as PhilosopherRow | undefined;

    if (!philosopher) {
      return NextResponse.json(
        { error: "Philosopher for this post could not be found." },
        { status: 404 }
      );
    }

    const dependentReplies = body.dependent_replies ?? [];
    let sourceMaterial = "";
    let promptSeed: string | undefined;
    let articleCandidateId: string | undefined;
    let articleTitle: string | undefined;
    let replyToPhilosopher: string | undefined;
    let replyToPostId: string | undefined;
    let citation = {
      title: existingPost.citation_title,
      source: existingPost.citation_source,
      url: existingPost.citation_url,
      imageUrl: existingPost.citation_image_url,
    };

    if (body.type === "news_reaction") {
      const article = body.article_candidate_id
        ? getArticleCandidate(db, body.article_candidate_id)
        : existingPost.citation_url
        ? getArticleCandidateByUrl(db, existingPost.citation_url)
        : undefined;

      if (!article) {
        return NextResponse.json(
          { error: "Source article for this reaction could not be found." },
          { status: 404 }
        );
      }

      sourceMaterial = buildArticleSourceMaterial(article);
      articleCandidateId = article.id;
      articleTitle = article.title;
      citation = {
        title: article.title,
        source: article.source_name,
        url: article.url,
        imageUrl: article.image_url,
      };
    } else if (body.type === "cross_reply") {
      const sourcePostId = body.reply_to_post_id ?? existingPost.reply_to;
      if (!sourcePostId) {
        return NextResponse.json(
          { error: "Cross-replies require a source post." },
          { status: 400 }
        );
      }

      const sourcePost = getStoredPost(db, sourcePostId);
      if (!sourcePost) {
        return NextResponse.json(
          { error: "Source post for this reply could not be found." },
          { status: 404 }
        );
      }

      sourceMaterial = buildCrossReplySourceMaterial(sourcePost);
      replyToPostId = sourcePost.id;
      replyToPhilosopher = sourcePost.philosopher_name;
      citation = {
        title: sourcePost.citation_title,
        source: sourcePost.citation_source,
        url: sourcePost.citation_url,
        imageUrl: sourcePost.citation_image_url,
      };
    } else {
      const recentPrompts = getRecentTimelessPrompts(db);
      const nextPromptSeed = pickTimelessPrompt({
        recentPrompts,
        promptsUsedThisRun: new Set<string>(),
        currentPrompt: body.prompt_seed,
      });

      if (!nextPromptSeed) {
        return NextResponse.json(
          { error: "No alternate timeless prompt is available right now." },
          { status: 422 }
        );
      }

      promptSeed = nextPromptSeed;
      sourceMaterial = nextPromptSeed;
      citation = { title: null, source: null, url: null, imageUrl: null };
    }

    const contentTypeKey =
      body.type === "news_reaction"
        ? "news_reaction"
        : body.type === "cross_reply"
        ? "cross_philosopher_reply"
        : "timeless_reflection";

    const outcome = await generateContent(
      philosopher.id,
      contentTypeKey,
      sourceMaterial,
      body.length
    );

    if (!outcome.success) {
      return NextResponse.json(
        { error: outcome.error, raw_output: outcome.rawOutput },
        { status: 422 }
      );
    }

    const normalized = normalizeGeneratedPost(body.type, outcome.data);
    if (!normalized) {
      return NextResponse.json(
        { error: "Generation returned malformed content." },
        { status: 422 }
      );
    }

    const deletedReplyPostIds: string[] = [];
    const deletedReplyLogIds: number[] = [];
    const insertLog = db.prepare(
      `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
       VALUES (?, ?, ?, ?, ?, 'generated')`
    );
    const updatePost = db.prepare(
      `UPDATE posts
       SET content = ?, thesis = ?, stance = ?, tag = ?, citation_title = ?, citation_source = ?,
           citation_url = ?, citation_image_url = ?, reply_to = ?, updated_at = datetime('now')
       WHERE id = ?`
    );
    const updateLogStatus = db.prepare("UPDATE generation_log SET status = ? WHERE id = ?");
    const deletePost = db.prepare("DELETE FROM posts WHERE id = ?");
    const findDraftReplies = db.prepare(
      "SELECT id FROM posts WHERE reply_to = ? AND status = 'draft'"
    );

    const newLogId = db.transaction(() => {
      if (body.type === "news_reaction") {
        const discoveredReplies = findDraftReplies.all(body.post_id) as Array<{ id: string }>;
        const knownReplyIds = new Set(dependentReplies.map((reply) => reply.post_id));

        for (const reply of discoveredReplies) {
          if (!knownReplyIds.has(reply.id)) {
            deletePost.run(reply.id);
            deletedReplyPostIds.push(reply.id);
          }
        }

        for (const reply of dependentReplies) {
          const existingReply = db
            .prepare("SELECT id FROM posts WHERE id = ? AND reply_to = ?")
            .get(reply.post_id, body.post_id) as { id: string } | undefined;

          if (!existingReply) continue;

          deletePost.run(reply.post_id);
          deletedReplyPostIds.push(reply.post_id);

          if (reply.generation_log_id) {
            updateLogStatus.run("rejected", reply.generation_log_id);
            deletedReplyLogIds.push(reply.generation_log_id);
          }
        }
      }

      updateLogStatus.run("rejected", body.generation_log_id);

      const result = insertLog.run(
        philosopher.id,
        body.type === "timeless_reflection" ? "reflection" : "post",
        outcome.systemPromptId,
        sourceMaterial,
        JSON.stringify(outcome.data, null, 2)
      );

      updatePost.run(
        normalized.content,
        normalized.thesis,
        normalized.stance,
        normalized.tag,
        citation.title,
        citation.source,
        citation.url,
        citation.imageUrl,
        replyToPostId ?? existingPost.reply_to,
        body.post_id
      );

      return Number(result.lastInsertRowid);
    })();

    if (body.type === "news_reaction" && articleCandidateId) {
      db.prepare("UPDATE article_candidates SET status = 'used' WHERE id = ?").run(articleCandidateId);
    }

    return NextResponse.json({
      success: true,
      item: {
        type: body.type,
        post_id: body.post_id,
        generation_log_id: newLogId,
        philosopher_id: philosopher.id,
        philosopher_name: philosopher.name,
        content: normalized.content,
        thesis: normalized.thesis,
        stance: normalized.stance,
        tag: normalized.tag,
        length: body.length,
        article_candidate_id: articleCandidateId,
        article_title: articleTitle,
        reply_to_post_id: replyToPostId ?? existingPost.reply_to ?? undefined,
        reply_to_philosopher: replyToPhilosopher,
        prompt_seed: promptSeed,
      },
      deleted_reply_post_ids: deletedReplyPostIds,
      deleted_reply_log_ids: deletedReplyLogIds,
    });
  } catch (error) {
    console.error("Daily regeneration failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily regeneration failed" },
      { status: 500 }
    );
  }
}

function validateGenerateRequest(body: DailyGenerateRequest | null | undefined): string | null {
  if (!body) return "Request body is required.";
  if (!Array.isArray(body.article_ids) || body.article_ids.length === 0) {
    return "Select at least one article.";
  }

  const config = body.config;
  if (!config) return "config is required.";
  if (!isIntegerInRange(config.reactions_per_article, 1, 3)) {
    return "reactions_per_article must be between 1 and 3.";
  }
  if (!isIntegerInRange(config.cross_replies, 0, 3)) {
    return "cross_replies must be between 0 and 3.";
  }
  if (!isIntegerInRange(config.timeless_reflections, 0, 4)) {
    return "timeless_reflections must be between 0 and 4.";
  }
  if (!Array.isArray(config.excluded_philosophers)) {
    return "excluded_philosophers must be an array.";
  }
  if (!["varied", "short", "medium", "long"].includes(config.length_strategy)) {
    return "length_strategy must be varied, short, medium, or long.";
  }

  return null;
}

function validateRegenerateRequest(body: DailyRegenerateRequest | null | undefined): string | null {
  if (!body?.post_id) return "post_id is required.";
  if (!body.generation_log_id) return "generation_log_id is required.";
  if (!["news_reaction", "cross_reply", "timeless_reflection"].includes(body.type)) {
    return "type must be news_reaction, cross_reply, or timeless_reflection.";
  }
  if (!["short", "medium", "long"].includes(body.length)) {
    return "length must be short, medium, or long.";
  }
  if (body.type === "news_reaction" && !body.article_candidate_id) {
    return "article_candidate_id is required for news reaction regeneration.";
  }
  if (body.type === "cross_reply" && !body.reply_to_post_id) {
    return "reply_to_post_id is required for cross-reply regeneration.";
  }

  return null;
}

async function generateDailyDraft(args: {
  philosopher: PhilosopherRow;
  type: DailyItemType;
  dbContentType: "post" | "reflection";
  sourceMaterial: string;
  targetLength: TargetLength;
  citation?: {
    title: string | null;
    source: string | null;
    url: string | null;
    imageUrl: string | null;
  };
  replyTo?: string;
  replyToPhilosopher?: string;
  promptSeed?: string;
  articleCandidateId?: string;
  articleTitle?: string;
}): Promise<{ success: true; data: DailyGeneratedItem } | { success: false; error: string }> {
  const outcome = await generateContent(
    args.philosopher.id,
    args.type === "news_reaction"
      ? "news_reaction"
      : args.type === "cross_reply"
      ? "cross_philosopher_reply"
      : "timeless_reflection",
    args.sourceMaterial,
    args.targetLength
  );

  if (!outcome.success) {
    return { success: false, error: outcome.error };
  }

  const normalized = normalizeGeneratedPost(args.type, outcome.data);
  if (!normalized) {
    return { success: false, error: "Generation returned malformed content." };
  }

  const db = getDb();
  const postId = `post-gen-${crypto.randomUUID()}`;
  const insertLog = db.prepare(
    `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
     VALUES (?, ?, ?, ?, ?, 'generated')`
  );
  const insertPost = db.prepare(
    `INSERT INTO posts (
      id, philosopher_id, content, thesis, stance, tag,
      citation_title, citation_source, citation_url, citation_image_url,
      reply_to, likes, replies, bookmarks, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'draft', datetime('now'), datetime('now'))`
  );

  const logId = db.transaction(() => {
    const logResult = insertLog.run(
      args.philosopher.id,
      args.dbContentType,
      outcome.systemPromptId,
      args.sourceMaterial,
      JSON.stringify(outcome.data, null, 2)
    );

    insertPost.run(
      postId,
      args.philosopher.id,
      normalized.content,
      normalized.thesis,
      normalized.stance,
      normalized.tag,
      args.citation?.title ?? null,
      args.citation?.source ?? null,
      args.citation?.url ?? null,
      args.citation?.imageUrl ?? null,
      args.replyTo ?? null
    );

    return Number(logResult.lastInsertRowid);
  })();

  return {
    success: true,
    data: {
      type: args.type,
      post_id: postId,
      generation_log_id: logId,
      philosopher_id: args.philosopher.id,
      philosopher_name: args.philosopher.name,
      content: normalized.content,
      thesis: normalized.thesis,
      stance: normalized.stance,
      tag: normalized.tag,
      length: args.targetLength,
      article_candidate_id: args.articleCandidateId,
      article_title: args.articleTitle,
      reply_to_post_id: args.replyTo,
      reply_to_philosopher: args.replyToPhilosopher,
      prompt_seed: args.promptSeed,
    },
  };
}

function normalizeGeneratedPost(
  type: DailyItemType,
  data: Record<string, unknown>
): GeneratedPostPayload | null {
  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) return null;

  const thesis =
    typeof data.thesis === "string" && data.thesis.trim()
      ? data.thesis.trim()
      : content.split("\n")[0].trim().slice(0, 140);
  const stanceCandidate = typeof data.stance === "string" ? data.stance : "observes";
  const stance = VALID_STANCES.has(stanceCandidate as Stance)
    ? (stanceCandidate as Stance)
    : "observes";
  const tag =
    typeof data.tag === "string" && data.tag.trim()
      ? data.tag.trim()
      : defaultTagForType(type);

  return {
    content,
    thesis,
    stance,
    tag,
  };
}

function defaultTagForType(type: DailyItemType): string {
  switch (type) {
    case "cross_reply":
      return "Cross-Philosopher Reply";
    case "timeless_reflection":
      return "Timeless Wisdom";
    default:
      return "Ethical Analysis";
  }
}

function buildArticleSourceMaterial(article: ArticleCandidateRow): string {
  const suggestedStances = parseJson<Record<string, string>>(article.suggested_stances, {});
  const suggestedStanceText = Object.entries(suggestedStances)
    .map(([philosopherId, stance]) => `${philosopherId}: ${stance}`)
    .join(", ");

  return [
    `ARTICLE TITLE: ${article.title}`,
    `SOURCE: ${article.source_name}`,
    `URL: ${article.url}`,
    article.description ? `DESCRIPTION:\n${article.description}` : "",
    article.philosophical_entry_point
      ? `PHILOSOPHICAL ENTRY POINT:\n${article.philosophical_entry_point}`
      : "",
    suggestedStanceText ? `SUGGESTED STANCES: ${suggestedStanceText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildCrossReplySourceMaterial(post: StoredPostRow): string {
  return [
    `PHILOSOPHER YOU ARE REPLYING TO: ${post.philosopher_name}`,
    `THEIR STANCE: ${post.stance}`,
    post.citation_title ? `TRIGGER ARTICLE: ${post.citation_title}` : "",
    post.citation_source ? `TRIGGER SOURCE: ${post.citation_source}` : "",
    post.thesis ? `THEIR THESIS:\n${post.thesis}` : "",
    `THEIR POST:\n${post.content}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function pickReactionPhilosophers(args: {
  allPhilosophers: PhilosopherRow[];
  excludedIds: Set<string>;
  usedPhilosopherIds: Set<string>;
  suggestedIds: string[];
  count: number;
}): string[] {
  const { allPhilosophers, excludedIds, usedPhilosopherIds, suggestedIds, count } = args;
  const validRosterIds = new Set(allPhilosophers.map((philosopher) => philosopher.id));
  const selected: string[] = [];
  const selectedSet = new Set<string>();

  const takeFrom = (candidateIds: string[]) => {
    for (const philosopherId of shuffle(candidateIds)) {
      if (selected.length >= count) return;
      if (selectedSet.has(philosopherId)) continue;
      selected.push(philosopherId);
      selectedSet.add(philosopherId);
    }
  };

  takeFrom(
    suggestedIds.filter(
      (philosopherId) =>
        validRosterIds.has(philosopherId) &&
        !excludedIds.has(philosopherId) &&
        !usedPhilosopherIds.has(philosopherId)
    )
  );

  takeFrom(
    allPhilosophers
      .map((philosopher) => philosopher.id)
      .filter(
        (philosopherId) =>
          !excludedIds.has(philosopherId) &&
          !usedPhilosopherIds.has(philosopherId) &&
          !selectedSet.has(philosopherId)
      )
  );

  takeFrom(
    allPhilosophers
      .map((philosopher) => philosopher.id)
      .filter(
        (philosopherId) =>
          !excludedIds.has(philosopherId) && !selectedSet.has(philosopherId)
      )
  );

  return selected;
}

function pickContrastingRespondent(args: {
  sourcePhilosopher: PhilosopherRow;
  allPhilosophers: PhilosopherRow[];
  excludedIds: Set<string>;
  usedPhilosopherIds: Set<string>;
}): PhilosopherRow | null {
  const { sourcePhilosopher, allPhilosophers, excludedIds, usedPhilosopherIds } = args;
  const byId = new Map(allPhilosophers.map((philosopher) => [philosopher.id, philosopher]));
  const curatedIds = CROSS_REPLY_CANDIDATES[sourcePhilosopher.id] ?? [];

  const curatedUnused = curatedIds
    .map((philosopherId) => byId.get(philosopherId))
    .filter((philosopher): philosopher is PhilosopherRow => philosopher !== undefined)
    .filter(
      (philosopher) =>
        philosopher.id !== sourcePhilosopher.id &&
        !excludedIds.has(philosopher.id) &&
        !usedPhilosopherIds.has(philosopher.id)
    );
  const curatedAny = curatedIds
    .map((philosopherId) => byId.get(philosopherId))
    .filter((philosopher): philosopher is PhilosopherRow => philosopher !== undefined)
    .filter(
      (philosopher) =>
        philosopher.id !== sourcePhilosopher.id &&
        !excludedIds.has(philosopher.id)
    );
  const fallbackUnused = allPhilosophers.filter(
    (philosopher) =>
      philosopher.id !== sourcePhilosopher.id &&
      philosopher.tradition !== sourcePhilosopher.tradition &&
      !excludedIds.has(philosopher.id) &&
      !usedPhilosopherIds.has(philosopher.id)
  );
  const fallbackAny = allPhilosophers.filter(
    (philosopher) =>
      philosopher.id !== sourcePhilosopher.id && !excludedIds.has(philosopher.id)
  );

  return (
    pickRandom(curatedUnused) ??
    pickRandom(curatedAny) ??
    pickRandom(fallbackUnused) ??
    pickRandom(fallbackAny) ??
    null
  );
}

function resolveTargetLength(strategy: LengthStrategy): TargetLength {
  if (strategy === "varied") return pickWeightedLength();
  return strategy;
}

function pickWeightedLength(): TargetLength {
  const roll = Math.random();
  if (roll < 0.25) return "short";
  if (roll < 0.75) return "medium";
  return "long";
}

function buildSummary(generated: DailyGeneratedItem[], errors: string[]) {
  const usedNames = Array.from(
    new Set(generated.map((item) => item.philosopher_name))
  ).sort((left, right) => left.localeCompare(right));

  return {
    news_reactions: generated.filter((item) => item.type === "news_reaction").length,
    cross_replies: generated.filter((item) => item.type === "cross_reply").length,
    timeless_reflections: generated.filter((item) => item.type === "timeless_reflection").length,
    total_drafts: generated.length,
    philosophers_used: usedNames,
    errors,
  };
}

function getArticleCandidate(db: ReturnType<typeof getDb>, articleId: string) {
  return db
    .prepare(
      `SELECT ac.*, ns.name as source_name
       FROM article_candidates ac
       JOIN news_sources ns ON ns.id = ac.source_id
       WHERE ac.id = ? AND ac.status IN ('scored', 'used')`
    )
    .get(articleId) as ArticleCandidateRow | undefined;
}

function getArticleCandidateByUrl(db: ReturnType<typeof getDb>, url: string) {
  return db
    .prepare(
      `SELECT ac.*, ns.name as source_name
       FROM article_candidates ac
       JOIN news_sources ns ON ns.id = ac.source_id
       WHERE ac.url = ?
       ORDER BY ac.fetched_at DESC
       LIMIT 1`
    )
    .get(url) as ArticleCandidateRow | undefined;
}

function getStoredPost(db: ReturnType<typeof getDb>, postId: string) {
  return db
    .prepare(
      `SELECT
         p.id,
         p.philosopher_id,
         p.content,
         p.thesis,
         p.stance,
         p.tag,
         p.citation_title,
         p.citation_source,
         p.citation_url,
         p.citation_image_url,
         p.reply_to,
         p.status,
         ph.name as philosopher_name
       FROM posts p
       JOIN philosophers ph ON ph.id = p.philosopher_id
       WHERE p.id = ?`
    )
    .get(postId) as StoredPostRow | undefined;
}

function getRecentTimelessPrompts(db: ReturnType<typeof getDb>) {
  const rows = db
    .prepare(
      `SELECT user_input
       FROM generation_log
       WHERE content_type = 'reflection'
         AND created_at >= datetime('now', '-7 days')`
    )
    .all() as Array<{ user_input: string }>;

  return new Set(rows.map((row) => row.user_input));
}

function pickTimelessPrompt(args: {
  recentPrompts: Set<string>;
  promptsUsedThisRun: Set<string>;
  currentPrompt?: string;
}): string | null {
  const freshPool = TIMELESS_PROMPTS.filter(
    (prompt) =>
      !args.recentPrompts.has(prompt) &&
      !args.promptsUsedThisRun.has(prompt) &&
      prompt !== args.currentPrompt
  );
  if (freshPool.length > 0) return pickRandom(freshPool);

  const nonCurrentPool = TIMELESS_PROMPTS.filter(
    (prompt) => prompt !== args.currentPrompt && !args.promptsUsedThisRun.has(prompt)
  );
  if (nonCurrentPool.length > 0) return pickRandom(nonCurrentPool);

  const anyPool = TIMELESS_PROMPTS.filter((prompt) => !args.promptsUsedThisRun.has(prompt));
  return pickRandom(anyPool);
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function isIntegerInRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}




