# Philagora: approved design → application implementation

## User decision and scope

Implement the approved Agora-first homepage and question/conversation journey
in the existing Next.js application. The design exploration is complete enough
to begin. Continue with the selected direction; do not start another layout,
palette, or typography exploration.

**Keep the editorial world-issue feature mocked.** The user specifically
identified the “The questions we share / An issue in focus” card headed
“When a city overheats, who gets protected first?” and said this feature is
not implemented yet and will be implemented separately later.

That boundary covers the curated issue, researched multi-source briefing,
philosopher policy proposals, synthesis, and new issue-context attachment
workflow. Keep a clearly labeled sample card and, if needed for its CTA, a
sample detail view. Actions that depend on this future feature must remain
clearly marked previews. Do not add an issue database, ingestion, curation,
generation, admin workflow, or automatic source attachment for it. Ordinary
Agora questions about politics and the world remain real, fully supported
questions. Preserve any existing article-link submission capability.

## Workspace and design references

- Repository/current checkout: `D:/codex/philagora`.
- Branch at handoff: `codex/homepage-explorations`.
- Design files are currently **untracked**, under `design-explorations/`.
  Preserve them. An isolated checkout from committed HEAD alone will omit
  the references. Carry the design directory into any new implementation
  branch/worktree before relying on it.
- Read the repository's `AGENTS.md` and applicable instructions.
- Create a separate `codex/` implementation branch from the current state.
  Do not discard unrelated changes or overwrite the original prototypes.

References, relative to `design-explorations/homepage/`:

1. `conversation-study.html`: latest homepage plus interactive signed-in
   submission, waiting, answers, and group follow-up study.
2. `typography-study.html` and `typography-study.css`: approved homepage
   typography and mobile spacing before the interaction study.
3. `typography-exchange.html`: longer reading example.
4. `typography-briefing.html`: sample-only future editorial feature.
5. `README.md`: decisions, behavior boundaries, and validation details.
6. `conversation-study.mjs`, `conversation-controls.js`,
   `conversation-state.js`, `conversation-study.css`: editable prototype
   source. Timers and sample responses illustrate behavior, not production
   architecture. The earlier A/B/C alternatives are historical references.

The local static preview was served at `http://127.0.0.1:4173/conversation-study.html`.
Its availability is not guaranteed in a fresh task; the checked-out files
are the reference. Do not confuse that server with the real application.

## Approved hierarchy and appearance

- Agora is the homepage's primary action and content focus.
- Support personal dilemmas and questions about public life equally.
- Expose the question composer immediately. Avoid a long mobile introduction.
- Follow the selected C layout: invitation/composer → personal conversation
  and world sample → more Agora questions → feed and debates.
- Keep feed and debates visible, useful, and accessible as full destinations.
  The existing full feed can move from `/` to `/feed`; preserve its filters,
  pagination, personalized state, and links when updating navigation.
- Use Paper & clay: paper `#faf9f6`, ink `#282923`, muted `#65665d`, clay
  `#a34e36`, dark clay `#803b28`, borders `#d9d9d1`, soft `#f0eee8`.
- Lora for headlines and philosophical prose; DM Sans for UI and supporting
  text. Reuse the existing font/asset setup and translate the approved styles
  into shared application components and tokens.
- Small portraits, roughly 28–34px; no prominent portrait galleries or
  placeholders. No green/gold panels or yellow parchment treatment.
- Comfortable full-width text on phones, 16px+ primary text, approximately
  44–48px touch controls, 20px gutters (16px on narrow phones), compact
  opening and consistent section spacing. Let enlarged text reflow.
- Existing app `terracotta` is mapped to green. Audit where tokens are shared
  before changing them so unrelated screens remain usable.

## Real homepage and submission behavior

- Replace demonstration questions/responses outside the explicitly mocked
  editorial issue with real public, eligible Agora/feed/debate data. Private
  questions must never appear in public homepage sections or metadata.
- Add designed empty/loading states when local data is absent; do not seed
  fake public content or reset the database to make the homepage look full.
- Preserve existing Agora capabilities and validation rather than reducing
  them to the prototype's fixed samples. The current submission API supports
  2–4 selected philosophers; the sample's three are not a new hardcoded limit.
- Private is the preferred default where supported for signed-in users.
  Preserve the actual authentication and ownership rules. For guests, make
  private-question sign-in requirements clear and never silently change a
  private draft to public.
- Public wording must explain that the question, responses, and follow-up
  are public and accurately describe how the author is displayed.
- Review and implement guest, signed-in, non-owner, and sign-in-return
  behavior. The approved interactive study covers only the signed-in owner.
  Preserve drafts through relevant in-app steps without leaking private
  text into URLs, logs, or public data.

## Real conversation behavior

- Submission leads to a durable thread. Keep the original question, selected
  group, and audience clear throughout the conversation.
- Drive waiting and response arrival from actual server state. Do not use
  fixed demo timers, invented progress percentages, or fake completion.
- Display responses as they become available, with synthesis when available.
  Preserve text already shown, reading position, and keyboard focus as new
  responses arrive. Announce meaningful status updates accessibly.
- Let a user browse and return to their pending thread using real thread IDs
  and existing ownership rules. Refresh and navigation must not create a new
  submission or lose access to a successfully created thread.
- Handle validation errors, rejected submissions, long waits, network loss,
  generation failure, partial results, and unavailable/private threads.
  Preserve drafts and already received answers where appropriate.
- Audit actual recovery capabilities before translating the prototype's
  “Try again” into a live action. Continuing only missing responses is a
  design proposal, not an existing API. Provide an honest, functioning
  recovery action. If minimal backend support is necessary, keep it scoped,
  authenticated, rate-limited, and idempotent. Never blindly resubmit an
  ambiguous request or regenerate completed responses as a side effect.
- **A follow-up continues with the whole original group.** No individual
  recipient selector. Keep the original context and first round in the same
  reading thread, followed by the user's follow-up, new responses, and synthesis.
- Preserve the existing one-follow-up limit and registered-owner restriction.
  The follow-up inherits the thread's audience. Clearly explain that a public
  conversation's follow-up is public too. Avoid duplicate submissions.
- Remove all design-review navigation, prototype controls, sample timers,
  and sample-answer disclosures from real features. Retain honest AI-persona
  labeling and explicit sample labeling on the future editorial issue only.

## Existing implementation to inspect

Start with the actual source, preserving shared patterns:

- `src/app/page.tsx` (currently the full feed)
- `src/components/AgoraHero.tsx`, `FeedSection.tsx`, `FeedTabs.tsx`
- Public navigation/layout components and `src/app/globals.css`
- `src/app/agora/AgoraPageClient.tsx`
- `src/app/agora/[threadId]/ThreadPageClient.tsx`
- `src/app/api/agora/submit/route.ts`
- `src/app/api/agora/[threadId]/route.ts`
- `src/app/api/agora/[threadId]/follow-up/route.ts`
- `src/app/api/agora/featured/route.ts` and `my-threads/route.ts`
- `src/lib/data.ts`, `agora.ts`, `agora-generation.ts`, auth helpers and types

Use existing services and prepared SQL. Preserve feed interactions, debate
behavior, privacy/access controls, rate limits, admin workflows, News Scout,
and generation pipelines. Avoid unrelated schema or architecture changes.

## Validation and completion

The prototype passed static HTML/link/style validation and pure state checks.
It has **not** undergone browser/device visual or interaction testing.

The implementation task should explicitly perform browser testing of the real
application at narrow mobile widths (including 320px and 390px), tablet, and
desktop, plus keyboard use, 200% text enlargement, and reduced motion.
Check the entire question → waiting → answers → group follow-up path, guest
and owner rules, privacy inheritance, partial failure, and return after
navigation/refresh. Use local fixtures or stubs for deterministic generation
states; do not call paid AI generation or modify production for testing.

Run applicable lint, type checks, meaningful tests, and the application build.
Verify full feed/debate access and all mock issue CTAs. Report what was actually
tested and any remaining limitations. Keep the local app available for review.
No production deployment is requested. Work through implementation and
verification rather than stopping after a plan.
