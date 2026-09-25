# Admin UX implementation — 25 September 2026

Implemented on the existing branch. Desktop is the target; public-facing visual styles retain their existing design.

## What changed

| Area | Result |
| --- | --- |
| Shell | Wider workspace; compact, independently scrolling navigation; editorial, conversation, library, settings, and operations groups. |
| Posts | Searchable queue and adjacent full-text editor; previous/next; citation and recommendation fields; readable preview; persistent save/status actions; archive/restore; explicit permanent-delete confirmation. |
| Editorial status | Saving text preserves status. Approval and publishing are separate actions. The editor detects stale saves rather than overwriting a newer edit. Bulk actions act on explicitly selected IDs on the current page. |
| Forms | Shared associated labels across 75 existing controls, larger readable labels and inputs, visible keyboard focus, unsaved-edit guards in the principal editors, and a sticky profile save bar. Settings explain their section-level save model. |
| Dialogs | Shared native modal behavior, initial focus, contained keyboard focus, Escape handling, focus restoration, scrollable body, and persistent actions. Add Philosopher protects entered values on dismissal; News Scout uses the same foundation. |
| News Scout | Search and URL-backed tab/category/score/sort/page/usage filters. Overview's approved-unused link now opens that exact queue. Pipeline statistics collapse above the queue. |
| Generate Content | Setup and review appear beside each other. Settings lock during generation and review so the preview cannot be saved under a different philosopher. The action says “Save as draft.” Prompt inspection is optional; generation actions stay visible while scrolling. |
| Daily Planner | Sources, configuration, and review stages. Saved runs have their own URL; completed items are checkpointed during generation and restored with current post text/status. Regeneration updates the saved run's log references. Duplicate run IDs do not repeat model calls. |
| Debate / Agora | Separate searchable lists and focused workshops. A saved workshop URL restores its current step on reload. Loading guards prevent a late response from opening the wrong record. |
| Prompts / Templates | Unsaved edits are checked before record switches, stale load responses are ignored, and template saving explicitly identifies the saved version as inactive. |

## Data and compatibility

- Migration 19 adds `admin_generation_runs`; it is additive and safe to run repeatedly. The schema source and runtime migration both include it.
- Existing posts remain in the same table. The post PATCH API accepts a fixed allowlist of editable fields and an optional `expected_updated_at` version, with an atomic conditional update.
- The bulk API retains its earlier contract for existing callers; the rebuilt Posts UI always supplies selected IDs. An empty ID list is rejected.
- Saved-run reads reconcile the snapshot against current posts. Deleted posts stay deleted; the review does not recreate them.
- Checkpoints preserve completed work and review context. They are not a background-job system: unfinished AI calls do not automatically restart after a server/process failure. An inactive running run is identified as potentially interrupted after 30 minutes without progress.
- Unsaved guards cover normal admin links, explicit record/workshop switches, and browser document exits. They do not guarantee interception of every browser history traversal in the Next.js client router.

## Verification

- Full Vitest suite: **307 tests across 25 files passed**.
- TypeScript and ESLint checks passed.
- Optimized Next.js production build passed using the isolated database. The existing middleware/proxy deprecation warning remains. The first sandboxed build could not fetch existing Google Fonts; the network-enabled build completed.
- New coverage verifies full-text editing without publication, stale-write conflicts, literal text search, selection-scoped bulk status changes, empty-selection rejection, approved-unused source filtering, migration idempotence, saved-run restoration, partial/failing run checkpoints, duplicate run IDs, and regenerated log references.
- Chrome checks covered the new shell and Posts editor at the normal desktop size and 1280×800, selected-record controls, a full-text save, unsaved navigation cancellation, philosopher modal focus/Escape/cancel/discard, News Scout's filtered queue and reaction dialog, saved daily review restoration, debate creation and reload at the openings step, Agora's separate list/form, content generation layout, and template-switch dirty protection.
- Browser writes used an isolated SQLite backup and clearly marked test fixtures. No live AI generation or publishing was performed.

## Local preview

Run `npm run review:admin` for a separate admin review server at `http://127.0.0.1:3500/admin`. It copies `db/philagora.db` into an ignored `.local-review/admin-ux-*` directory, binds only to loopback, disables live AI and the Agora worker, and uses the local test password printed by the runner. An optional first argument supplies a different source database. Stop the runner with Ctrl+C.

The normal application continues to use its existing server, database, and admin authentication. Its updated admin is at `http://localhost:3000/admin`.

## Dark admin palette follow-up

- Replaced the warm admin palette with charcoal work surfaces, soft white body text, readable gray metadata, and restrained blue actions, links, selection, and keyboard focus. Success, warning, and error states retain distinct labeled colors.
- Theme variables are scoped to the admin shell and login. Legacy white panels, badges, inputs, tables, settings, and native dialogs use the same dark colors. Public color values and the public homepage appearance are unchanged.
- Textareas use 15px text with 1.7 line height; the Posts reading preview uses 16px text with 1.75 line height. Long admin prose uses the UI sans-serif face.
- Representative contrast checks: body text 13.67:1, muted text 7.18:1, muted text on selected rows 5.00:1, primary action text 5.70:1 (hover 4.82:1). These are palette checks, not a full accessibility audit.
- Long-page browser inspection also caught a scroll container preventing the sidebar from sticking. Admin-only horizontal clipping now keeps navigation visible while reading settings.
- Fixed a false unsaved-changes warning in Scoring Settings and AI Models: their shared API returns more sections than either page edits. Dirty checks now compare only that page's editable sections. Two regression tests cover clean loading and real edits with the complete response shape.
- Verified Posts table/editor/reading preview, News Scout and its Glint dialog, scoring forms and selected stance controls, login, and the public homepage in Chrome. TypeScript and ESLint passed; all **309 tests across 25 files passed**.
