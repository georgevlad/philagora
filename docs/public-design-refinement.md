# Public design refinement — 16 September 2026

Completed in `D:/codex/philagora` on `codex/agora-homepage-implementation`. The existing implementation was refined in place; no branch switch, commit, deployment, or paid generation was performed.

## Design changes

- Kept Paper & clay, Lora, DM Sans, and small portraits. Improved heading scale, paragraph measure, line wrapping, section rhythm, and mobile spacing throughout the public pages.
- Rebalanced the homepage with full-column conversation excerpts, two concise linked feed previews, a less cramped tablet composer, and a clearer sample-issue sequence. The issue-in-focus feature remains entirely mocked and explicitly labeled.
- Gave the composer a visible label and integrated count, stronger audience/selection/focus states, clearer group guidance, and responsive controls. Full answers remain in the conversation; synthesis lists and follow-up sections now have clearer hierarchy.
- Refined feed filters, source citations, reaction/reply grouping, post controls, debate previews/readers, philosopher introductions, Schools, About, and empty/error surfaces. Read more keeps focus on the same control; repeated posts use unique disclosure IDs. Like, Bookmark, and Share are visibly labeled; the unsupported Reply placeholder was removed.
- Added graceful missing-image presentation for unavailable article/historical thumbnails and artwork, preserving the source link and written content.
- Clarified sign-in and profile copy to describe actual capabilities, corrected the homepage active navigation state, unified public buttons/focus/footer treatment, and made public notifications readable for six seconds with reduced-motion support.

Privacy/audience explanations, administrator access disclosures, AI attribution, full saved answers, actionable recovery guidance, and all existing auth/ownership/recovery rules are preserved. No admin page, global legacy palette, API, data service, database schema, generation prompt, or recovery implementation was changed.

## Verification

- `npm run lint`, `npx tsc --noEmit`, and all 202 unit tests in 15 files passed.
- All 47 existing browser scenarios passed in one full run (7.4 minutes). The only browser-test change replaces the removed Reply placeholder assertion with a check that it is absent.
- The final production build passed using `.local-review/refinement-build.db`, `AGORA_WORKER_DISABLED=true`, `RUN_SEED=false`, and an invalid provider key pointed at the loopback generation-disabled service. The first sandboxed attempt could not download existing Google Fonts; the network-enabled build and final rerun passed. The pre-existing Next.js middleware deprecation warning remains.
- Browser review used Microsoft Edge/Chromium at 320, 390, 768, and 1440px, including 200% root text enlargement, reduced motion, actual descendant bounds, touch targets, keyboard navigation, and screenshots inspected after refinements.
- Fixture coverage included suggestions/manual selection, private/public submission, waiting, incremental answers, synthesis, group follow-up, refresh/navigation, ambiguous requests, partial failure, network loss, recovery/focus/reading position, quotas, ownership, account states, filters/pagination, likes/bookmarks/share, loading/empty/error states, and complete debate phases.
- Live snapshot review covered 13 public routes and real long/older records. Exact normalized-text comparisons confirmed all 13 saved answer blocks across the longest and oldest sampled conversations (13,146 characters) remain visible without clipping. Another featured conversation's eight answer blocks were checked independently. Actual filters, pagination, audience controls, account navigation/bookmarks, sign-out, and sample-only issue controls were exercised.
- Additional shell checks covered sign-in failure/retry, homepage active navigation, enlarged sign-in/footer/navigation, toast duration/reduced motion, and matching admin login computed fonts, colors, spacing, and borders. The browser suite also checked authenticated admin navigation and its original palette.
- SHA-256 fingerprints for 47 protected files (the source snapshot, normal database, and design exploration files) matched the baseline. Generated TypeScript review-path changes were removed. Review evidence is ignored under `.local-review/`; the full browser report is `playwright-report/index.html`.

## Local review

Both applications are left running on loopback:

- Live saved content: http://127.0.0.1:3400 — generation disabled; ordinary local account shortcut in the banner.
- Fresh interactive fixtures: http://127.0.0.1:3100 — fixed local answers, no live AI calls; use the banner's test account shortcut. The runner was restarted after regression so question allowances and fixture states are fresh.

Useful fixture routes: `/agora/review-public`, `/agora/review-private`, `/agora/review-failed`, `/agora/review-exhausted`, `/agora/review-slow`, `/post/review-history`, `/post/review-art`, `/debates/review-debate`, and `/profile`.

Final screenshot evidence includes `.local-review/refinement-final-home-{390,1440}.png`, `refinement-final-{longest,oldest}-thread-{first,answer,synthesis}-390.png`, `refinement-final-image-fallback-390.png`, `refinement-sign-in-error.png`, and the regression's `public-*`, `group-*`, and `recovery-*` captures. Snapshot and shell audit results are `refinement-final-snapshot-audit.json` and `refinement-shell-results.json` in the same folder.

## Limits

These are desktop Chromium viewport and text-enlargement checks, not native iOS/Android or screen-reader speech validation. Real Google OAuth and paid provider behavior were not exercised. Snapshot image files and some remote images are unavailable locally; the frontend now handles those failures gracefully. No public in-app modal dialogs exist in the current journey; the unsupported Reply notification was removed, while the existing native share flow remains.
