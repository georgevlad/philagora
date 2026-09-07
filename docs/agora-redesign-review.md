# Agora-first redesign: local review

Implementation branch: `codex/agora-homepage-implementation`.

The original design explorations are preserved. `conversation-study.html` supplied the interaction direction; `typography-study.html` supplied Paper & clay, Lora, DM Sans and responsive spacing. The approved font files and their OFL notices are bundled with the application. The Paper & clay palette is scoped to the shared public shell. Phase 3 extends it to the remaining public pages while preserving the legacy admin tokens and styling.

## Run locally

```powershell
npm run review:agora
```

This creates a new database under `.local-review/run-*/`, starts the application at `http://127.0.0.1:3100`, and directs the Anthropic SDK exclusively to a loopback fixture server at port 3101. It uses an invalid fixture API key and does not read or reset `db/philagora.db`. All content and accounts in this review environment are local test fixtures. Set `AGORA_REVIEW_PORT` if those ports are occupied.

- Guest review: `http://127.0.0.1:3100/`
- Test user sign-in: `http://127.0.0.1:3101/login/owner`
- Second test user sign-in: `http://127.0.0.1:3101/login/other`
- Private fixture: `/agora/review-private`
- Interrupted fixture with an answer preserved: `/agora/review-failed`
- Long wait fixture: `/agora/review-slow`
- Complete public conversation: `/agora/review-public`
- Full feed: `/feed`
- Debate: `/debates/review-debate`
- Entirely mocked issue: `/preview/issue-in-focus`

A visible Local test preview banner identifies fixed sample answers and provides Use test account / Switch to guest shortcuts. The banner is enabled only by the fixture runner in development. The sign-in shortcuts live on the loopback fixture server, not in any application API. They create normal signed Better Auth cookies for the isolated review accounts. Google sign-in remains the application’s authentication mechanism.

With the fixture server running, run `npm run test:browser`. Playwright uses installed Microsoft Edge in headless mode. Its latest-run report is in `playwright-report/`; screenshots are in `.local-review/`. A targeted test run replaces the previous HTML report. The tests operate only on the isolated fixture database recorded in `.local-review/active.json`.

## Representative fixture content

`scripts/fixtures/agora-review-content.ts` contains original sample prose matching the code template’s 100–200 words per response post, including a two-post answer, recommendations, expanded synthesis, and distinct follow-up responses. These are fixed samples for reading and interaction review, not live model output. Two deterministic suggestion groups illustrate personal and public-life questions; their reasons are also fixture data. Homepage cards show excerpts of up to 65 words; conversation pages display every response post in full. Production prompts, model settings and token limits are unchanged.

## Backend mapping and boundaries

- The guided flow is question → Find my philosophers → suggested thinkers with reasons → review or adjust 2–4 thinkers → Ask the philosophers. The existing suggestion route runs before submission, and its classification is passed to the existing submit API and layered generation service. Optional article links and public display names remain supported.
- Suggested reasons, classification and selected thinkers survive refresh and sign-in handoff with the draft. Editing the question or article cancels pending suggestions and invalidates the previous group and classification. Failed or incomplete suggestions offer a manual 2–4-thinker selection with no invented default group.
- Private is the default. Guests must sign in before submitting privately, or explicitly choose Public. A guest private API request now receives 401 instead of silently publishing it.
- Public questions, answers and follow-ups are public under the supplied display name, or Anonymous. Account names are not automatically shown. Guest questions remain unowned and cannot be claimed by signing in later.
- A client-generated UUID becomes the durable thread ID. Network retries reuse it, check ownership, and return the existing thread without restarting generation or spending another question allowance. Quotas are rechecked inside the insertion transaction.
- Waiting is driven by saved status and response rows. Responses append without replacing previously rendered answers. Long waits use the real creation time. Synthesis and cultural recommendations are displayed when available.
- A Check for updates action only reloads saved state. There is no automatic resume/regenerate endpoint. Failed or partially completed conversations retain available answers and explain that a fresh question is a separate submission.
- A follow-up uses every original participant, original context and audience, and stays in the same reading page. Only the registered owner (or the existing administrator override) can submit it. Retries reconcile the existing follow-up. A second distinct follow-up is rejected. Direct child links return to the original conversation.
- Thread HTML, polling APIs, metadata, structured data, OG previews, homepage selections and public indexes enforce privacy. Private generation content is omitted from new generation-log entries. Existing historical logs are not changed.
- Drafts are tab-scoped in session storage with a two-hour expiry, isolated by account, and cleared after submission. Sign-in handoff preserves the guest draft. No question text is placed in navigation URLs.
- The original full feed, filters, pagination, interactions and personalized state remain at `/feed`. Legacy `/?type=…` links redirect to the corresponding feed filter.
- The city-heat issue, briefing, proposals, synthesis and contextual-question composer are all explicitly labeled samples. They have no database, ingestion or generation implementation. Its preview never submits to Agora or silently attaches sources to a real question.

## Validation

Follow-on work restored the guided suggestion step and representative fixtures. All 23 browser scenarios passed: the 21-test regression run, followed by 14 affected/new checks after the final changes (including two added scenarios). Coverage now includes suggestion/classification reuse, edited-question cancellation, manual fallback, article-only selection, group sign-in handoff, error focus, and actual element bounds at 320px with 200% text. Lint and TypeScript pass; all 164 unit tests pass. The final production build passes (the existing middleware deprecation warning remains). A final two-case check also verified full-width suggestion text and selection after the accessibility adjustment.

Initial redesign completed on 7 September 2026: lint, TypeScript, all 164 unit tests in 13 files, all 14 browser tests, and the production build passed.

- ESLint and TypeScript checks.
- Existing unit suite plus new in-memory route tests for malformed input, 2–4 thinkers, concurrent submission retries, quota limits, guest/private rejection, owner/admin reads, public-list filtering, article warnings, whole-group follow-ups, audience inheritance, duplicate follow-ups and mismatched private-child suppression.
- Browser checks at 320, 390, 768 and 1440 pixels; the full owner submission/wait/return/refresh/answer/follow-up journey at 390 pixels; desktop guest submission; screenshot review; keyboard navigation; 200% root text enlargement; reduced motion.
- Browser checks for sign-in draft return, anonymous/non-owner private access, generic private metadata, navigation and mock-only CTAs, lost submission responses, 429 errors, partial generation, network interruption, durable rendered answers, keyboard focus and scroll position, full feed pagination/likes/bookmarks, and the Agora empty state.
- Production Next.js build. The existing middleware deprecation warning remains.

No production deployment or paid generation is performed. Real Google OAuth, real Anthropic output quality, native mobile browsers and assistive-technology screen-reader speech are not exercised by the local fixture tests.

## Phase 3: remaining public pages

The public feed, individual posts, debate archive and reader, philosopher profiles, user profile, Schools of Thought and About now share the Paper & clay shell. The original design studies are unchanged.

- `src/app/public-design.css` extends the tokens from `agora-design.css` with public-only page layouts. Feed and philosopher pages use a reading column and a secondary directory; debates use opening previews and a focused reader; the account page is a private library. Typography uses Lora for headlines and prose and DM Sans for controls. Portrait links use 32px images.
- Navigation identifies the active destination. Every public destination has loading, unavailable-page and error states. Error recovery requests fresh server data before resetting the boundary. Historical context uses a native keyboard-accessible disclosure.
- Feed filters, the interleaving algorithm, automatic pagination, likes, bookmarks and sharing remain. A visible Load more posts control also supports keyboard access. Post readers preserve the entire text, inline emphasis, source links, art, historical context, recommendations and links to the replied-to post. Sign-in returns to the original post or philosopher filter.
- Debate readers include all saved opening, cross-examination, rebuttal and synthesis-phase posts, reply-target anchors, and both summary and list-based synthesis fields. The previous reader omitted cross-examination, closing posts and list-only synthesis. Scheduled and in-progress states reflect saved data; no generation or polling behavior was added.
- Philosopher biographies, principles and key works remain. The old sidebar's “Following” section was a directory, with no follow toggle, persistence or endpoint in this checkout. All philosopher links remain available through the feed, profiles and Schools; no new follow system was invented.
- The profile remains authenticated and private to its owner. It distinguishes the audience of each conversation, retains all saved questions and post interactions, refreshes after removal, and handles sign-out failures. The existing Agora access checks, submissions, suggestions, quota handling and whole-group follow-up remain unchanged.
- The entire issue-in-focus feature is still a labeled sample. No issue backend, contextual-question submission, generation recovery, prompt, model or quota changes are included. Admin styles and global legacy tokens remain unchanged.

### Additional local fixtures

`scripts/fixtures/public-page-review.ts` is called only by `scripts/agora-review.ts` against its freshly created isolated database. It adds grouped reactions and cross-replies, an aphorism, a glint, a recommendation, fictional historical context, an original SVG still life for art layout review, a paginated Seneca profile, saved account interactions, and scheduled/in-progress/complete debates including every stored phase and both synthesis formats.

Useful routes in addition to the earlier Agora fixtures:

- `/feed`, including each content filter
- `/post/review-history`, `/post/review-art`, `/post/review-recommendation`, `/post/review-reply-0`
- `/debates/review-debate`, `/debates/review-debate-scheduled`, `/debates/review-debate-progress`, `/debates/review-debate-lists`
- `/philosophers/seneca` for pagination; `/philosophers/seneca?type=replies` for an empty filter
- `/profile` with the owner account for saved content; the second account for an empty library
- `/schools` and `/about`

The Local test preview banner and account shortcuts remain. Browser screenshots use the `public-*` prefix in `.local-review/`. The browser tests restore temporary fixture content and the shared test session after sign-out.

### Phase 3 validation — 7 September 2026

- All 165 unit tests in 13 files pass, including the added complete-debate data check. ESLint, TypeScript and the final production build pass. The existing middleware deprecation warning remains. The build uses the isolated review database; network access is needed only for the existing Google Fonts build downloads.
- All 39 distinct browser scenarios passed across the full 36-case regression run and three additional state/accessibility checks. The 13 public-page scenarios were rerun after the final presentation changes and all passed. A transient development reload during an earlier desktop run was resolved by the stable rerun.
- Browser coverage includes all eight public page types at 320, 390, 768 and 1440px, actual element bounds, 200% root text at 320px, reduced motion, keyboard filters and skip navigation, touch targets, all feed filters, both feed/profile pagination, complete debate phases and synthesis, account ownership, like/bookmark persistence and rollback, sign-out, guest return paths, private access, loading/empty/error recovery, and the unchanged admin palette. Screenshots were reviewed at mobile and desktop sizes.
- The final local review session starts with fresh isolated fixtures, the visible test banner and working account shortcuts. The normal application database and design-explorations files are untouched. No deployment or paid AI calls were made.
