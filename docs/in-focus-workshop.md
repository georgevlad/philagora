# In Focus Workshop

Open **Admin → In Focus Workshop** (`/admin/in-focus`) to create a private experiment. It uses the current admin workspace controls, dialogs, notices, and unsaved-change protections.

## Try an experiment

1. Give the story a working title, add what you want to understand, and set the research's “as of” date.
2. Add sources with relevant excerpts or research notes. URLs are references only: this version does not fetch articles or search the web. Include material from the perspectives you want considered.
3. Generate a briefing, check its source markers, and edit it. You can also write a briefing yourself. Saving a reviewed briefing creates an alternative rather than replacing earlier text.
4. Write a question or request suggestions. Choose a main philosopher and a different challenger, optionally using suggestions and their rationales.
5. Generate the main argument, then a challenge to the selected argument. An optional reply lets the main philosopher respond. Add editorial feedback to steer each new alternative.
6. Use **Reading preview** to read the selected exchange. **Saved alternatives** lets you inspect original sources, the briefing, the question, feedback, and the arguments each contribution used, and compare it with the current selection.

Changing sources, the question, a philosopher, or an upstream alternative marks affected work as using earlier context. Generation requires current dependencies. Reviewing a briefing against new sources establishes a new briefing; editing an argument preserves its original context.

Setup saves before generation. Text edits save separately as alternatives. Reload asks before discarding edits. Experiments can be archived and restored. Completed alternatives survive failed generations, refreshes, and retries; an interrupted generation can be retried after ten minutes. Concurrent edits return a conflict instead of overwriting another tab's work.

## Configuration and privacy

- Live generation uses the existing `ANTHROPIC_API_KEY`, model settings, active philosopher personas, and house rules through `generation-service.ts`. Editorial steps use the synthesis model; philosophical contributions use the generation model.
- The four In Focus templates are available in the existing template editor, with code defaults and database overrides.
- API Logs has an **In Focus** filter. A successful workshop call includes JSON parsing and content validation. Processing failures retain the model's token usage and report an error such as `response_invalid_json`, `response_invalid_content`, or `response_truncated`; the experiment also displays a specific explanation.
- Admin routes and APIs inherit the existing admin authentication. Production requires `ADMIN_PASSWORD`, as for the rest of the admin.
- Migration 20 creates dedicated `in_focus_experiments` and `in_focus_versions` tables. Workshop actions do not create posts, debates, Agora threads, or publication records. Workshop actions do not publish. The first public edition is maintained separately as reviewed editorial content; see Public editions below.
- The model works from supplied text. Source markers support editorial review; they do not automatically verify whether a claim is true or supported.

## Local verification

```powershell
npm test
npm run lint
npx tsc --noEmit
npx playwright test --config playwright.in-focus.config.ts
```

The dedicated browser test copies `db/philagora.db` into `.local-review`, runs an isolated app on port 3510 and deterministic Anthropic-compatible fixtures on port 3511, and makes no paid model calls. It exercises creation, generation, editing, discarding edits, suggestions, the exchange, comparison, persistence, outdated context, failure recovery, archiving, and unauthenticated access. Screenshots are saved as `.local-review/in-focus-*.png`.

To keep this fixture preview running for manual inspection, use `npx tsx scripts/in-focus-review.ts`. Its local-only admin password is `local-in-focus-review`. The fixture tests validate the integration and workflow, not live model quality. Next.js may add the preview's generated type paths to `tsconfig.json`; those paths are local review artifacts.

## Public editions

The homepage now features the reviewed Russia–Ukraine edition at /in-focus/ukraine-air-defence-and-the-duty-to-help. This first release uses an explicit, version-controlled publication registry in src/lib/in-focus-published.ts and reader-facing copy in src/content/in-focus/ukraine-air-defence.ts. It works without copying the local workshop database to production.

The registry records the originating experiment and selected version IDs. The public data contains only the shortened editorial copy, dated source references and philosopher attribution. Public routes never query private experiment data; changing a source, question or selected alternative cannot silently update the public article.

For the linked experiment, Reading preview defaults to the published edition, using the same FocusArticle component as the public route. Preview working selection switches back to the private draft. Other experiments retain their original private preview. This release does not add a general-purpose Publish button: another story or a revision must be explicitly reviewed and added to the publication registry. A database-backed publication editor can follow once the reading experience has been tried.

To revise this edition, review the reporting and philosophical exchange, update the explicit edition and its publication date, preserve its stable slug, and run the publication checks. The former city-heat mock is retained at its existing non-indexed preview URL, but is no longer linked from the homepage.

Publication checks: npm test, npm run lint, npx tsc --noEmit, and npx playwright test --config playwright.in-focus.config.ts. The browser suite verifies the homepage link, article, source anchors, mobile and enlarged-text reflow, matching admin/public copy, and independence from private draft edits. It uses an isolated database copy and fixture model responses.
