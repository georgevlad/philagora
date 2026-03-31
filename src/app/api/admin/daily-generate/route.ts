import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type {
  ArticleCandidateRow,
  PhilosopherRow,
  StoredPostRow,
} from "@/lib/db-types";
import { generateContent } from "@/lib/generation-service";
import type { MoodResult } from "@/lib/mood-service";
import {
  resolveMoodForContentType,
  resolveMoodForCrossReply,
} from "@/lib/mood-service";
import type { TargetLength } from "@/lib/content-templates";
import type { Stance } from "@/lib/types";

type DailyItemType =
  | "news_reaction"
  | "cross_reply"
  | "timeless_reflection"
  | "quip"
  | "cultural_recommendation"
  | "art_commentary"
  | "everyday_scenario";
type LengthStrategy = "varied" | TargetLength;

interface DailyGenerateRequest {
  article_ids: string[];
  config: {
    reactions_per_article: number;
    cross_replies: number;
    timeless_reflections: number;
    quips: number;
    cultural_recommendations: number;
    art_commentaries?: number;
    everyday_scenarios?: number;
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

interface GeneratedPostPayload {
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  recommendation_title?: string;
  recommendation_author?: string;
  recommendation_medium?: string;
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
  recommendation_title?: string;
  recommendation_author?: string;
  recommendation_medium?: string;
  mood_register?: string;
}

function resolveSourceType(type: DailyItemType): string {
  switch (type) {
    case "news_reaction":
    case "cross_reply":
    case "quip":
      return "news";
    case "timeless_reflection":
    case "cultural_recommendation":
      return "reflection";
    case "art_commentary":
      return "art_commentary";
    case "everyday_scenario":
      return "everyday";
    default:
      return "news";
  }
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
  "quips",
  "mocks",
  "recommends",
]);

const CROSS_REPLY_CANDIDATES: Record<string, string[]> = {
  "marcus-aurelius": ["nietzsche", "camus", "kierkegaard", "dostoevsky", "russell", "diogenes"],
  seneca: ["nietzsche", "camus", "kierkegaard", "dostoevsky", "russell", "diogenes"],
  nietzsche: ["kant", "confucius", "marcus-aurelius", "seneca", "cicero", "diogenes"],
  camus: ["confucius", "marcus-aurelius", "seneca", "plato", "cicero"],
  confucius: ["nietzsche", "camus", "russell", "dostoevsky", "jung", "diogenes"],
  kant: ["nietzsche", "camus", "jung", "dostoevsky", "cicero", "diogenes"],
  plato: ["russell", "nietzsche", "camus", "cicero", "jung", "diogenes"],
  jung: ["russell", "kant", "cicero", "confucius", "marcus-aurelius"],
  kierkegaard: ["russell", "confucius", "marcus-aurelius", "seneca", "cicero"],
  dostoevsky: ["russell", "confucius", "marcus-aurelius", "seneca", "kant"],
  russell: ["jung", "plato", "dostoevsky", "kierkegaard", "nietzsche"],
  cicero: ["nietzsche", "camus", "jung", "russell", "plato"],
  diogenes: ["plato", "kant", "marcus-aurelius", "seneca", "nietzsche", "confucius"],
};

const PROVOCATION_PRIORITY: Record<Stance, number> = {
  provokes: 7,
  challenges: 6,
  mocks: 6,
  warns: 5,
  quips: 5,
  diagnoses: 4,
  questions: 4,
  reframes: 3,
  laments: 3,
  defends: 2,
  recommends: 2,
  observes: 1,
};

const QUIP_PREFERRED_PHILOSOPHERS = ["russell", "nietzsche", "camus", "kierkegaard", "diogenes"];

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

const RECOMMENDATION_PROMPTS = [
  "Recommend a film for someone who feels stuck in life and needs to be shaken awake.",
  "Recommend a film for a Friday night when you want to feel something real, not just be entertained.",
  "Recommend a film that changed how you see power and those who wield it.",
  "Recommend a film about solitude - not loneliness, but genuine solitude.",
  "Recommend a book that every person should read before turning 30.",
  "Recommend a book that will make the reader uncomfortable with their own certainties.",
  "Recommend an album for someone experiencing grief.",
  "Recommend an album that captures what it feels like to be alive at 2 AM.",
  "Recommend a film that shows the absurdity of modern work.",
  "Recommend a book about love that does not sentimentalize it.",
  "Recommend a film where the villain is more interesting than the hero.",
  "Recommend a film from outside the English-speaking world that deserves a wider audience.",
  "Recommend music for someone who has stopped paying attention to beauty.",
  "Recommend a book that fundamentally changed how you understand human nature.",
  "Recommend a film that makes bureaucracy terrifying.",
];

const ART_COMMENTARY_PROMPTS = [
  "Artwork: \"The Starry Night\" by Vincent van Gogh",
  "Artwork: \"Guernica\" by Pablo Picasso",
  "Artwork: \"The Persistence of Memory\" by Salvador Dali",
  "Artwork: \"Wanderer above the Sea of Fog\" by Caspar David Friedrich",
  "Artwork: \"The Death of Socrates\" by Jacques-Louis David",
  "Artwork: \"Nighthawks\" by Edward Hopper",
  "Artwork: \"The Great Wave off Kanagawa\" by Katsushika Hokusai",
  "Artwork: \"The School of Athens\" by Raphael",
  "Artwork: \"Saturn Devouring His Son\" by Francisco Goya",
  "Artwork: \"The Garden of Earthly Delights\" by Hieronymus Bosch",
  "Artwork: \"Ophelia\" by John Everett Millais",
  "Artwork: \"The Third of May 1808\" by Francisco Goya",
  "Artwork: \"Christina's World\" by Andrew Wyeth",
  "Artwork: \"The Kiss\" by Gustav Klimt",
  "Artwork: \"The Tower of Babel\" by Pieter Bruegel the Elder",
  "Artwork: \"Las Meninas\" by Diego Velazquez",
  "Artwork: \"Liberty Leading the People\" by Eugene Delacroix",
  "Artwork: \"The Birth of Venus\" by Sandro Botticelli",
  "Artwork: \"A Sunday Afternoon on the Island of La Grande Jatte\" by Georges Seurat",
  "Artwork: \"The Arnolfini Portrait\" by Jan van Eyck",
  "Artwork: \"The Raft of the Medusa\" by Theodore Gericault",
  "Artwork: \"American Gothic\" by Grant Wood",
  "Artwork: \"Girl with a Pearl Earring\" by Johannes Vermeer",
  "Artwork: \"The Thinker\" by Auguste Rodin",
];

const EVERYDAY_PROMPTS = [
  "Your meeting could have been an email",
  "You check your phone first thing in the morning before speaking to anyone",
  "A stranger holds the door open and you feel obligated to rush",
  "You rehearse a conversation in your head that never happens",
  "You buy something you don't need because it was on sale",
  "You apologize when someone else bumps into you",
  "You scroll past bad news because you've already seen too much today",
  "You say 'I'm fine' when you're not fine at all",
  "You spend 20 minutes choosing what to watch and then watch nothing",
  "You feel guilty for doing nothing on a Sunday",
  "You compare your life to someone else's highlight reel online",
  "You eat lunch at your desk while pretending to work",
  "A friend cancels plans and you feel relieved",
  "You keep a book on your shelf you'll never read to appear well-read",
  "You write a text message, delete it, rewrite it, and send the first version",
  "You arrive early and sit in your car instead of going inside",
  "You feel anxious when your phone battery drops below 20%",
  "You say 'let's catch up soon' knowing neither of you will follow through",
  "You take a photo of your food before eating it",
  "You feel oddly emotional hearing a song from ten years ago",
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DailyGenerateRequest;
    const validationError = validateGenerateRequest(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const db = getDb();
    const config = {
      ...body.config,
      art_commentaries: body.config.art_commentaries ?? 0,
      everyday_scenarios: body.config.everyday_scenarios ?? 0,
    };
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
        { error: "No valid approved or scored articles were found for generation." },
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
        const articleSource = buildArticleSourceMaterialParts(article, philosopher.id);
        const item = await generateDailyDraft({
          philosopher,
          type: "news_reaction",
          dbContentType: "post",
          sourceMaterial: articleSource.sourceMaterial,
          moodRegister: articleSource.moodResult?.register ?? null,
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

      const replySource = buildCrossReplySourceMaterialParts(
        sourcePost,
        respondingPhilosopher.id
      );
      const length = resolveTargetLength(config.length_strategy);
      const item = await generateDailyDraft({
        philosopher: respondingPhilosopher,
        type: "cross_reply",
        dbContentType: "post",
        sourceMaterial: replySource.sourceMaterial,
        moodRegister: replySource.moodResult?.register ?? null,
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

    const quipArticleIdsUsed = new Set<string>();
    for (let quipIndex = 0; quipIndex < config.quips; quipIndex += 1) {
      const article = pickQuipArticle(selectedArticles, quipArticleIdsUsed, quipIndex);
      if (!article) {
        errors.push("No article available for quip generation.");
        break;
      }

      const philosopher = pickQuipPhilosopher({
        allPhilosophers,
        excludedIds,
        usedPhilosopherIds,
      });

      if (!philosopher) {
        errors.push("No philosopher available for quip generation.");
        break;
      }

      const item = await generateDailyDraft({
        philosopher,
        type: "quip",
        dbContentType: "post",
        sourceMaterial: buildArticleSourceMaterial(article),
        targetLength: "medium",
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
        errors.push(`${philosopher.name} quip on "${article.title}": ${item.error}`);
        await sleep(500);
        continue;
      }

      usedPhilosopherIds.add(philosopher.id);
      quipArticleIdsUsed.add(article.id);
      generated.push(item.data);
      db.prepare("UPDATE article_candidates SET status = 'used' WHERE id = ?").run(article.id);
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

    const recentRecommendationPrompts = getRecentRecommendationPrompts(db);
    const recommendationCandidates = shuffle(
      allPhilosophers.filter(
        (philosopher) =>
          !excludedIds.has(philosopher.id) && !usedPhilosopherIds.has(philosopher.id)
      )
    ).slice(0, config.cultural_recommendations);
    const recPromptsUsedThisRun = new Set<string>();

    for (const philosopher of recommendationCandidates) {
      const promptSeed = pickRecommendationPrompt({
        recentPrompts: recentRecommendationPrompts,
        promptsUsedThisRun: recPromptsUsedThisRun,
      });

      if (!promptSeed) {
        errors.push(`No recommendation prompt available for ${philosopher.name}.`);
        continue;
      }

      const length = resolveTargetLength(config.length_strategy);
      const item = await generateDailyDraft({
        philosopher,
        type: "cultural_recommendation",
        dbContentType: "recommendation",
        sourceMaterial: promptSeed,
        targetLength: length,
        promptSeed,
      });

      if (!item.success) {
        errors.push(`${philosopher.name} recommendation: ${item.error}`);
        await sleep(500);
        continue;
      }

      recPromptsUsedThisRun.add(promptSeed);
      usedPhilosopherIds.add(philosopher.id);
      generated.push(item.data);
      await sleep(500);
    }

    // -- Art Commentaries -------------------------------------------------
    const artCommentaryCount = config.art_commentaries ?? 0;
    if (artCommentaryCount > 0) {
      const recentArtPrompts = getRecentArtCommentaryPrompts(db);
      const artCandidates = shuffle(
        allPhilosophers.filter(
          (philosopher) =>
            !excludedIds.has(philosopher.id) && !usedPhilosopherIds.has(philosopher.id)
        )
      ).slice(0, artCommentaryCount);
      const artPromptsUsedThisRun = new Set<string>();

      for (const philosopher of artCandidates) {
        const promptSeed = pickArtCommentaryPrompt({
          recentPrompts: recentArtPrompts,
          promptsUsedThisRun: artPromptsUsedThisRun,
        });

        if (!promptSeed) {
          errors.push(`No art commentary prompt available for ${philosopher.name}.`);
          continue;
        }

        const artworkMatch = promptSeed.match(/^Artwork:\s*"(.+?)"\s+by\s+(.+)$/);
        const artworkTitle = artworkMatch?.[1] ?? promptSeed;
        const artworkArtist = artworkMatch?.[2] ?? null;

        const length = resolveTargetLength(config.length_strategy);
        const item = await generateDailyDraft({
          philosopher,
          type: "art_commentary",
          dbContentType: "art_commentary",
          sourceMaterial: promptSeed,
          targetLength: length,
          promptSeed,
          citation: {
            title: artworkTitle,
            source: artworkArtist,
            url: null,
            imageUrl: null,
          },
        });

        if (!item.success) {
          errors.push(`${philosopher.name} art commentary: ${item.error}`);
          await sleep(500);
          continue;
        }

        artPromptsUsedThisRun.add(promptSeed);
        usedPhilosopherIds.add(philosopher.id);
        generated.push(item.data);
        await sleep(500);
      }
    }

    // -- Everyday Scenarios -----------------------------------------------
    const everydayCount = config.everyday_scenarios ?? 0;
    if (everydayCount > 0) {
      const recentEverydayPrompts = getRecentEverydayPrompts(db);
      const everydayCandidates = shuffle(
        allPhilosophers.filter(
          (philosopher) =>
            !excludedIds.has(philosopher.id) && !usedPhilosopherIds.has(philosopher.id)
        )
      ).slice(0, everydayCount);
      const everydayPromptsUsedThisRun = new Set<string>();

      for (const philosopher of everydayCandidates) {
        const promptSeed = pickEverydayPrompt({
          recentPrompts: recentEverydayPrompts,
          promptsUsedThisRun: everydayPromptsUsedThisRun,
        });

        if (!promptSeed) {
          errors.push(`No everyday scenario prompt available for ${philosopher.name}.`);
          continue;
        }

        const length = resolveTargetLength(config.length_strategy);
        const item = await generateDailyDraft({
          philosopher,
          type: "everyday_scenario",
          dbContentType: "post",
          sourceMaterial: promptSeed,
          targetLength: length,
          promptSeed,
          citation: {
            title: promptSeed,
            source: "The Examined Life",
            url: null,
            imageUrl: null,
          },
        });

        if (!item.success) {
          errors.push(`${philosopher.name} everyday scenario: ${item.error}`);
          await sleep(500);
          continue;
        }

        everydayPromptsUsedThisRun.add(promptSeed);
        usedPhilosopherIds.add(philosopher.id);
        generated.push(item.data);
        await sleep(500);
      }
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
    let moodRegister: string | null = null;
    let citation = {
      title: existingPost.citation_title,
      source: existingPost.citation_source,
      url: existingPost.citation_url,
      imageUrl: existingPost.citation_image_url,
    };

    if (body.type === "news_reaction" || body.type === "quip") {
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

      const articleSource = buildArticleSourceMaterialParts(
        article,
        body.type === "news_reaction" ? philosopher.id : undefined
      );
      sourceMaterial = articleSource.sourceMaterial;
      moodRegister = articleSource.moodResult?.register ?? null;
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

      const replySource = buildCrossReplySourceMaterialParts(
        sourcePost,
        philosopher.id
      );
      sourceMaterial = replySource.sourceMaterial;
      moodRegister = replySource.moodResult?.register ?? null;
      replyToPostId = sourcePost.id;
      replyToPhilosopher = sourcePost.philosopher_name;
      citation = {
        title: sourcePost.citation_title,
        source: sourcePost.citation_source,
        url: sourcePost.citation_url,
        imageUrl: sourcePost.citation_image_url,
      };
    } else if (body.type === "timeless_reflection") {
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
    } else if (body.type === "art_commentary") {
      const recentPrompts = getRecentArtCommentaryPrompts(db);
      const nextPromptSeed = pickArtCommentaryPrompt({
        recentPrompts,
        promptsUsedThisRun: new Set<string>(),
        currentPrompt: body.prompt_seed,
      });

      if (!nextPromptSeed) {
        return NextResponse.json(
          { error: "No alternate art commentary prompt is available right now." },
          { status: 422 }
        );
      }

      const artworkMatch = nextPromptSeed.match(/^Artwork:\s*"(.+?)"\s+by\s+(.+)$/);
      promptSeed = nextPromptSeed;
      sourceMaterial = nextPromptSeed;
      citation = {
        title: artworkMatch?.[1] ?? nextPromptSeed,
        source: artworkMatch?.[2] ?? null,
        url: null,
        imageUrl: null,
      };
    } else if (body.type === "everyday_scenario") {
      const recentPrompts = getRecentEverydayPrompts(db);
      const nextPromptSeed = pickEverydayPrompt({
        recentPrompts,
        promptsUsedThisRun: new Set<string>(),
        currentPrompt: body.prompt_seed,
      });

      if (!nextPromptSeed) {
        return NextResponse.json(
          { error: "No alternate everyday scenario prompt is available right now." },
          { status: 422 }
        );
      }

      promptSeed = nextPromptSeed;
      sourceMaterial = nextPromptSeed;
      citation = {
        title: nextPromptSeed,
        source: "The Examined Life",
        url: null,
        imageUrl: null,
      };
    } else {
      const recentPrompts = getRecentRecommendationPrompts(db);
      const nextPromptSeed = pickRecommendationPrompt({
        recentPrompts,
        promptsUsedThisRun: new Set<string>(),
        currentPrompt: body.prompt_seed,
      });

      if (!nextPromptSeed) {
        return NextResponse.json(
          { error: "No alternate recommendation prompt is available right now." },
          { status: 422 }
        );
      }

      promptSeed = nextPromptSeed;
      sourceMaterial = nextPromptSeed;
      citation = { title: null, source: null, url: null, imageUrl: null };
    }
    const contentTypeKey =
      body.type === "quip"
        ? "quip"
        : body.type === "news_reaction"
        ? "news_reaction"
        : body.type === "cross_reply"
        ? "cross_philosopher_reply"
        : body.type === "cultural_recommendation"
        ? "cultural_recommendation"
        : body.type === "art_commentary"
        ? "art_commentary"
        : body.type === "everyday_scenario"
        ? "everyday_reaction"
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
      `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status, mood_register)
       VALUES (?, ?, ?, ?, ?, 'generated', ?)`
    );
    const updatePost = db.prepare(
      `UPDATE posts
       SET content = ?, thesis = ?, stance = ?, tag = ?, recommendation_title = ?,
           recommendation_author = ?, recommendation_medium = ?, citation_title = ?, citation_source = ?,
           citation_url = ?, citation_image_url = ?, source_type = ?, reply_to = ?, updated_at = datetime('now')
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
        body.type === "timeless_reflection"
          ? "reflection"
          : body.type === "cultural_recommendation"
          ? "recommendation"
          : body.type === "art_commentary"
          ? "art_commentary"
          : "post",
        outcome.systemPromptId,
        sourceMaterial,
        JSON.stringify(outcome.data, null, 2),
        moodRegister
      );

      updatePost.run(
        normalized.content,
        normalized.thesis,
        normalized.stance,
        normalized.tag,
        normalized.recommendation_title ?? null,
        normalized.recommendation_author ?? null,
        normalized.recommendation_medium ?? null,
        citation.title,
        citation.source,
        citation.url,
        citation.imageUrl,
        resolveSourceType(body.type),
        replyToPostId ?? existingPost.reply_to,
        body.post_id
      );

      return Number(result.lastInsertRowid);
    })();

    if ((body.type === "news_reaction" || body.type === "quip") && articleCandidateId) {
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
        recommendation_title: normalized.recommendation_title,
        recommendation_author: normalized.recommendation_author,
        recommendation_medium: normalized.recommendation_medium,
        mood_register: moodRegister ?? undefined,
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

  const artCommentaries = config.art_commentaries ?? 0;
  const everydayScenarios = config.everyday_scenarios ?? 0;

  if (!Number.isInteger(config.reactions_per_article) || config.reactions_per_article < 1) {
    return "reactions_per_article must be at least 1.";
  }
  if (!isIntegerInRange(config.cross_replies, 0, 3)) {
    return "cross_replies must be between 0 and 3.";
  }
  if (!isIntegerInRange(config.timeless_reflections, 0, 4)) {
    return "timeless_reflections must be between 0 and 4.";
  }
  if (!isIntegerInRange(config.quips, 0, 4)) {
    return "quips must be between 0 and 4.";
  }
  if (!isIntegerInRange(config.cultural_recommendations, 0, 4)) {
    return "cultural_recommendations must be between 0 and 4.";
  }
  if (!isIntegerInRange(artCommentaries, 0, 4)) {
    return "art_commentaries must be between 0 and 4.";
  }
  if (!isIntegerInRange(everydayScenarios, 0, 4)) {
    return "everyday_scenarios must be between 0 and 4.";
  }
  if (!Array.isArray(config.excluded_philosophers)) {
    return "excluded_philosophers must be an array.";
  }
  if (!['varied', 'short', 'medium', 'long'].includes(config.length_strategy)) {
    return "length_strategy must be varied, short, medium, or long.";
  }

  return null;
}
function validateRegenerateRequest(body: DailyRegenerateRequest | null | undefined): string | null {
  if (!body?.post_id) return "post_id is required.";
  if (!body.generation_log_id) return "generation_log_id is required.";
  if (!['news_reaction', 'cross_reply', 'timeless_reflection', 'quip', 'cultural_recommendation', 'art_commentary', 'everyday_scenario'].includes(body.type)) {
    return "type must be news_reaction, cross_reply, timeless_reflection, quip, cultural_recommendation, art_commentary, or everyday_scenario.";
  }
  if (!['short', 'medium', 'long'].includes(body.length)) {
    return "length must be short, medium, or long.";
  }
  if ((body.type === 'news_reaction' || body.type === 'quip') && !body.article_candidate_id) {
    return "article_candidate_id is required for news reaction or quip regeneration.";
  }
  if (body.type === 'cross_reply' && !body.reply_to_post_id) {
    return "reply_to_post_id is required for cross-reply regeneration.";
  }

  return null;
}
async function generateDailyDraft(args: {
  philosopher: PhilosopherRow;
  type: DailyItemType;
  dbContentType: "post" | "reflection" | "recommendation" | "art_commentary";
  sourceMaterial: string;
  moodRegister?: string | null;
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
    args.type === "quip"
      ? "quip"
      : args.type === "news_reaction"
      ? "news_reaction"
      : args.type === "cross_reply"
      ? "cross_philosopher_reply"
      : args.type === "cultural_recommendation"
      ? "cultural_recommendation"
      : args.type === "art_commentary"
      ? "art_commentary"
      : args.type === "everyday_scenario"
      ? "everyday_reaction"
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
    `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status, mood_register)
     VALUES (?, ?, ?, ?, ?, 'generated', ?)`
  );
  const insertPost = db.prepare(
    `INSERT INTO posts (
      id, philosopher_id, content, thesis, stance, tag,
      recommendation_title, recommendation_author, recommendation_medium,
      source_type,
      citation_title, citation_source, citation_url, citation_image_url,
      reply_to, likes, replies, bookmarks, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'draft', datetime('now'), datetime('now'))`
  );
  const logId = db.transaction(() => {
    const logResult = insertLog.run(
      args.philosopher.id,
      args.dbContentType,
      outcome.systemPromptId,
      args.sourceMaterial,
      JSON.stringify(outcome.data, null, 2),
      args.moodRegister ?? null
    );

    insertPost.run(
      postId,
      args.philosopher.id,
      normalized.content,
      normalized.thesis,
      normalized.stance,
      normalized.tag,
      normalized.recommendation_title ?? null,
      normalized.recommendation_author ?? null,
      normalized.recommendation_medium ?? null,
      resolveSourceType(args.type),
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
      recommendation_title: normalized.recommendation_title,
      recommendation_author: normalized.recommendation_author,
      recommendation_medium: normalized.recommendation_medium,
      mood_register: args.moodRegister ?? undefined,
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
  const tagCandidate = typeof data.tag === "string" ? data.tag.trim() : "";

  if (type === "cultural_recommendation") {
    return {
      content,
      thesis,
      stance: normalizeStance(
        typeof data.stance === "string" ? data.stance : "recommends",
        "recommends"
      ),
      tag: tagCandidate || "Recommends",
      recommendation_title: normalizeOptionalString(data.recommendation_title),
      recommendation_author: normalizeOptionalString(data.recommendation_author),
      recommendation_medium: normalizeOptionalString(data.recommendation_medium)?.toLowerCase(),
    };
  }

  return {
    content,
    thesis,
    stance: normalizeStance(typeof data.stance === "string" ? data.stance : "observes"),
    tag: tagCandidate || defaultTagForType(type),
  };
}

function defaultTagForType(type: DailyItemType): string {
  switch (type) {
    case "cross_reply":
      return "Cross-Philosopher Reply";
    case "timeless_reflection":
      return "Timeless Wisdom";
    case "quip":
      return "Glint";
    case "cultural_recommendation":
      return "Recommends";
    case "art_commentary":
      return "Art Commentary";
    case "everyday_scenario":
      return "Examined Life";
    default:
      return "Ethical Analysis";
  }
}
function normalizeStance(value: string, fallback: Stance = "observes"): Stance {
  return VALID_STANCES.has(value as Stance) ? (value as Stance) : fallback;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildArticleSourceMaterial(
  article: ArticleCandidateRow,
  philosopherId?: string
): string {
  return buildArticleSourceMaterialParts(article, philosopherId).sourceMaterial;
}

function buildArticleSourceMaterialParts(
  article: ArticleCandidateRow,
  philosopherId?: string
): { sourceMaterial: string; moodResult: MoodResult | null } {
  const suggestedStances = parseJson<Record<string, string>>(article.suggested_stances, {});
  const suggestedStanceText = Object.entries(suggestedStances)
    .map(([philosopherId, stance]) => `${philosopherId}: ${stance}`)
    .join(", ");
  const tensions = parseJson<string[]>(article.primary_tensions, []);
  const moodResult = philosopherId
    ? resolveMoodForContentType({
        philosopherId,
        contentType: "news_reaction",
        tensions,
        stance: suggestedStances[philosopherId] ?? null,
        topicCluster: article.topic_cluster,
      })
    : null;

  const sourceMaterial = [
    `ARTICLE TITLE: ${article.title}`,
    `SOURCE: ${article.source_name}`,
    `URL: ${article.url}`,
    article.description ? `DESCRIPTION:\n${article.description}` : "",
    article.philosophical_entry_point
      ? `PHILOSOPHICAL ENTRY POINT:\n${article.philosophical_entry_point}`
      : "",
    suggestedStanceText ? `SUGGESTED STANCES: ${suggestedStanceText}` : "",
    moodResult?.line ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { sourceMaterial, moodResult };
}

function buildCrossReplySourceMaterial(
  post: StoredPostRow,
  replyingPhilosopherId?: string
): string {
  return buildCrossReplySourceMaterialParts(post, replyingPhilosopherId).sourceMaterial;
}

function buildCrossReplySourceMaterialParts(
  post: StoredPostRow,
  replyingPhilosopherId?: string
): { sourceMaterial: string; moodResult: MoodResult | null } {
  const moodResult = replyingPhilosopherId
    ? resolveMoodForCrossReply(replyingPhilosopherId, {
        citation_url: post.citation_url,
        stance: post.stance,
      })
    : null;

  const sourceMaterial = [
    `PHILOSOPHER YOU ARE REPLYING TO: ${post.philosopher_name}`,
    `THEIR STANCE: ${post.stance}`,
    post.citation_title ? `TRIGGER ARTICLE: ${post.citation_title}` : "",
    post.citation_source ? `TRIGGER SOURCE: ${post.citation_source}` : "",
    post.thesis ? `THEIR THESIS:\n${post.thesis}` : "",
    `THEIR POST:\n${post.content}`,
    moodResult?.line ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { sourceMaterial, moodResult };
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

function pickQuipArticle(
  articles: ArticleCandidateRow[],
  usedArticleIds: Set<string>,
  quipIndex: number
): ArticleCandidateRow | null {
  if (articles.length === 0) return null;

  const unusedArticles = articles.filter((article) => !usedArticleIds.has(article.id));
  if (unusedArticles.length > 0) {
    return unusedArticles[quipIndex % unusedArticles.length] ?? unusedArticles[0] ?? null;
  }

  return articles[quipIndex % articles.length] ?? null;
}

function pickQuipPhilosopher(args: {
  allPhilosophers: PhilosopherRow[];
  excludedIds: Set<string>;
  usedPhilosopherIds: Set<string>;
}): PhilosopherRow | null {
  const { allPhilosophers, excludedIds, usedPhilosopherIds } = args;
  const byId = new Map(allPhilosophers.map((philosopher) => [philosopher.id, philosopher]));
  const preferred = QUIP_PREFERRED_PHILOSOPHERS
    .map((philosopherId) => byId.get(philosopherId))
    .filter((philosopher): philosopher is PhilosopherRow => philosopher !== undefined);

  const preferredUnused = preferred.filter(
    (philosopher) =>
      !excludedIds.has(philosopher.id) && !usedPhilosopherIds.has(philosopher.id)
  );
  const anyUnused = allPhilosophers.filter(
    (philosopher) =>
      !excludedIds.has(philosopher.id) && !usedPhilosopherIds.has(philosopher.id)
  );
  const preferredAny = preferred.filter((philosopher) => !excludedIds.has(philosopher.id));
  const anyAvailable = allPhilosophers.filter(
    (philosopher) => !excludedIds.has(philosopher.id)
  );

  return (
    pickRandom(preferredUnused) ??
    pickRandom(anyUnused) ??
    pickRandom(preferredAny) ??
    pickRandom(anyAvailable) ??
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
    quips: generated.filter((item) => item.type === "quip").length,
    cultural_recommendations: generated.filter((item) => item.type === "cultural_recommendation").length,
    art_commentaries: generated.filter((item) => item.type === "art_commentary").length,
    everyday_scenarios: generated.filter((item) => item.type === "everyday_scenario").length,
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
       WHERE ac.id = ? AND ac.status IN ('approved', 'scored', 'used')`
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
         p.recommendation_title,
         p.recommendation_author,
         p.recommendation_medium,
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

function getRecentRecommendationPrompts(db: ReturnType<typeof getDb>) {
  const rows = db
    .prepare(
      `SELECT user_input
       FROM generation_log
       WHERE content_type = 'recommendation'
         AND created_at >= datetime('now', '-7 days')`
    )
    .all() as Array<{ user_input: string }>;

  return new Set(rows.map((row) => row.user_input));
}

function pickRecommendationPrompt(args: {
  recentPrompts: Set<string>;
  promptsUsedThisRun: Set<string>;
  currentPrompt?: string;
}): string | null {
  const { recentPrompts, promptsUsedThisRun, currentPrompt } = args;
  const candidates = RECOMMENDATION_PROMPTS.filter(
    (prompt) =>
      !recentPrompts.has(prompt) && !promptsUsedThisRun.has(prompt) && prompt !== currentPrompt
  );
  if (candidates.length > 0) return pickRandom(candidates);

  const fallback = RECOMMENDATION_PROMPTS.filter(
    (prompt) => !promptsUsedThisRun.has(prompt) && prompt !== currentPrompt
  );
  return pickRandom(fallback);
}

function getRecentArtCommentaryPrompts(db: ReturnType<typeof getDb>) {
  const rows = db
    .prepare(
      `SELECT user_input
       FROM generation_log
       WHERE content_type = 'art_commentary'
         AND created_at >= datetime('now', '-14 days')`
    )
    .all() as Array<{ user_input: string }>;

  return new Set(rows.map((row) => row.user_input));
}

function pickArtCommentaryPrompt(args: {
  recentPrompts: Set<string>;
  promptsUsedThisRun: Set<string>;
  currentPrompt?: string;
}): string | null {
  const freshPool = ART_COMMENTARY_PROMPTS.filter(
    (prompt) =>
      !args.recentPrompts.has(prompt) &&
      !args.promptsUsedThisRun.has(prompt) &&
      prompt !== args.currentPrompt
  );
  if (freshPool.length > 0) return pickRandom(freshPool);

  const nonCurrentPool = ART_COMMENTARY_PROMPTS.filter(
    (prompt) => prompt !== args.currentPrompt && !args.promptsUsedThisRun.has(prompt)
  );
  if (nonCurrentPool.length > 0) return pickRandom(nonCurrentPool);

  const anyPool = ART_COMMENTARY_PROMPTS.filter(
    (prompt) => !args.promptsUsedThisRun.has(prompt)
  );
  return pickRandom(anyPool);
}

function getRecentEverydayPrompts(db: ReturnType<typeof getDb>) {
  const rows = db
    .prepare(
      `SELECT user_input
       FROM generation_log
       WHERE content_type = 'post'
         AND created_at >= datetime('now', '-14 days')
         AND user_input IN (${EVERYDAY_PROMPTS.map(() => '?').join(',')})`
    )
    .all(...EVERYDAY_PROMPTS) as Array<{ user_input: string }>;

  return new Set(rows.map((row) => row.user_input));
}

function pickEverydayPrompt(args: {
  recentPrompts: Set<string>;
  promptsUsedThisRun: Set<string>;
  currentPrompt?: string;
}): string | null {
  const freshPool = EVERYDAY_PROMPTS.filter(
    (prompt) =>
      !args.recentPrompts.has(prompt) &&
      !args.promptsUsedThisRun.has(prompt) &&
      prompt !== args.currentPrompt
  );
  if (freshPool.length > 0) return pickRandom(freshPool);

  const nonCurrentPool = EVERYDAY_PROMPTS.filter(
    (prompt) => prompt !== args.currentPrompt && !args.promptsUsedThisRun.has(prompt)
  );
  if (nonCurrentPool.length > 0) return pickRandom(nonCurrentPool);

  const anyPool = EVERYDAY_PROMPTS.filter((prompt) => !args.promptsUsedThisRun.has(prompt));
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


