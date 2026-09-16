# Administration code review — 16 September 2026

## Outcome

Reviewed all **31 admin UI modules (22 pages)** and **40 admin API route files**, plus the authentication, generation, News Scout, configuration, date, database/schema, cache, and image helpers those routes use. Implemented bounded correctness fixes and removed concrete duplication. Larger workflow, persistence, and security-contract changes are documented below rather than mixed into this cleanup.

The working tree was clean when the review began. Changes remain local and uncommitted. No deployment, schema migration change, production database access, or paid AI generation was performed. Automated database tests use isolated databases; the production build used `.local-review/admin-review/build.db` with `RUN_SEED=false`.

**Validation:** repository-wide ESLint and TypeScript checks passed; **292 tests across 24 files passed**; the production build passed. Nine regression-test files were added and the existing generation-service tests were extended. The first `npm run check` reached its build step and failed to fetch the existing Google Fonts in the restricted network environment. A network-enabled `npm run build` retry passed. The existing Next.js middleware-to-proxy deprecation warning remains.

This was a code and automated regression review, not a live-production audit, dependency vulnerability scan, browser visual/accessibility audit, or live-provider integration test. Passing tests do not resolve the deferred findings.

## Implemented changes

### Authentication and request handling

| Finding | Change and effect | Main locations |
| --- | --- | --- |
| Missing `ADMIN_PASSWORD` opened admin access in production as well as development. | Shared the policy between Node authentication and middleware. Production now denies access when the password is missing; passwordless local development still works. **Deployment requirement: production must have `ADMIN_PASSWORD` configured.** | `src/lib/admin-constants.ts`, `src/lib/admin-auth.ts`, `src/middleware.ts` |
| Middleware exempted every path starting with `/api/admin/auth`. | Exempt only the actual auth endpoint; similarly named future routes remain protected. Removed an unreachable public-auth exception from the admin-only matcher. | `src/middleware.ts` |
| Malformed login payloads could become 500 responses; expired limiter entries remained for clients that never returned. | Validate password type/body shape, purge expired entries, handle the exact expiry boundary, and supply `Retry-After` on 429 responses. | `src/app/api/admin/auth/route.ts` |
| Repeated JSON parsing trusted null, arrays, primitives, or TypeScript assertions as valid requests. | Added a small shared JSON-object parser and adopted it across the edited CRUD, debate, Agora, generation, mood, and RSS-test handlers. Added required-field/type checks where contracts are clear. This is intentionally **not** a claim of complete field-level schema validation. | `src/lib/admin-request.ts`, affected admin routes |
| Several error handlers returned raw unexpected exception messages. | Return structured, generic 500 errors while logging exceptions server-side. Keep intentional configuration, validation, and generation diagnostics. | Content, News Scout, debate, Agora, historical, everyday and thumbnail routes |

### Generation and editorial integrity

| Finding | Change and effect | Main locations |
| --- | --- | --- |
| Daily regeneration could overwrite a post published while the model call was running. | Recheck draft status inside the write transaction after generation; return 409 if the draft was published or removed. | `src/app/api/admin/daily-generate/route.ts` |
| Client-listed dependent replies could be deleted even after publication. | Delete only replies that still belong to the parent and remain drafts. | `src/app/api/admin/daily-generate/route.ts` |
| Debate synthesis and its approval log could be updated separately. | Save both inside one transaction so either both changes succeed or neither does. | `src/app/api/admin/debates/[id]/synthesis/route.ts` |
| Generation accepted invalid participants/phases or unnecessary model calls. | Validate unique/existing participant IDs, debate/Agora membership, phases, rebuttal targets, statuses and selected payload arrays before generation/writes. | Debate/Agora routes, daily route |
| Timestamp-only debate/Agora IDs could collide. | Use UUIDs for new entity IDs. | Debate/Agora create routes |
| Replacing a thumbnail deleted the old image before the new file was successfully saved. | Save and reference the replacement first; retain identical filenames; return structured errors on exceptions. Filesystem/DB compensation remains follow-up work. | `src/app/api/admin/historical-events/[id]/thumbnail/route.ts` |
| Manual Generate classified reflections/recommendations as news. | Store their intended `source_type: "reflection"`; preserve other content types. | `src/app/admin/content/page.tsx` |
| Failed Reject requests discarded the review preview. | Retain the preview and display a retryable error. | `src/app/admin/content/page.tsx` |
| Everyday bulk publishing lost accurate progress if a later item failed. | Mark each successfully published item immediately, preserving completed progress. | `src/app/admin/everyday/page.tsx` |
| Daily review exposed only 320 characters and allowed conflicting actions. | Add expandable full drafts, disable conflicting generation/review/bulk operations, and guard review handlers while another action is pending. This does not provide cross-tab/server concurrency control. | Daily page, review component and action hook |

### News Scout, persistence and read correctness

| Finding | Change and effect | Main locations |
| --- | --- | --- |
| Scoring counted active sources but selected candidates from inactive sources too, with no overall batch limit. | Select active sources only, enforce the requested total batch size, keep source diversity through ranked ordering, and reject invalid batch sizes. | `src/lib/news-scout-service.ts` |
| RSS article IDs could collide across sources fetched in the same millisecond, silently losing articles through `INSERT OR IGNORE`. | Use UUIDs for IDs while keeping URL-based deduplication. | `src/lib/news-scout-service.ts` |
| News Scout skipped the first filter change after initial load. | Remove the extra skip guard; filters now fetch immediately. | `src/app/admin/news-scout/page.tsx` |
| Failed optional overview requests could put an error object into array state. | Check HTTP success and array shape before replacing overview data; check stats success too. Escape no longer closes an active generation panel. | `src/app/admin/news-scout/page.tsx` |
| Post/source deletion could partially detach or remove children before the parent delete failed. | Wrap related deletes/updates in transactions; rollback preserves replies and source candidates. | Posts and News Scout Sources routes |
| Referenced prompt deletion failed with a generic foreign-key error. | Return 409 and explain that generation history references the prompt; preserve audit history. | Prompts route |
| Some missing-record updates returned apparent success. | Return 404 for missing generation-log updates and missing source deletions. | Content and Sources routes |
| Candidate bulk update counts included duplicate/nonexistent requested IDs. | Deduplicate IDs and return actual affected-row counts. | News Scout Candidates route |
| Cleanup accepted unsafe/invalid retention values; log pagination could produce noninteger SQLite limits. | Validate positive retention periods; normalize finite integer limits/offsets. | Content/Candidates cleanup and API Logs routes |
| Mixed SQLite/ISO timestamps broke usage parsing and mood matching. | Reuse UTC-aware date parsing and normalize SQL timestamp comparisons. Mood association is still heuristic, as noted below. | Date helpers, philosopher usage, posts, admin timestamp displays |
| Philosopher edits could leave cached feed metadata stale. | Bust the feed cache after philosopher changes. | Philosophers route |
| Database downloads assumed `/tmp` and used collision-prone filenames. | Use the platform temporary directory and UUID backup names; preserve best-effort cleanup. | Download DB route |
| Valid JSON with invalid structure could crash scoring configuration readers. | Normalize object/array shapes, tier bounds and field types, and stance membership; preserve valid edits and intentional empty lists. Also tolerate malformed stored article stance/tension hints. | `src/lib/scoring-config.ts`, `src/lib/generation-service.ts` |

### UI correctness and redundancy removed

- Saving a single Scoring, Generation Settings, or Mood setting now preserves unsaved changes in other sections.
- Templates now exposes **Art Commentary** and uses the canonical `ContentTypeKey` type instead of a drifting local union.
- Failed sign-out now stays on the page with an error and a retry; pending sign-out is disabled.
- The dashboard's completed-debate total now counts only completed debates.
- Shared UTC-aware formatting replaces local timestamp implementations in Posts, Prompts, Templates, Everyday and API Logs. API Logs no longer appends a second `Z` to an ISO timestamp.
- API Logs cleanup no longer performs a duplicate refresh. Daily candidate normalization and its obsolete JSON alias were consolidated.
- Mood preview now uses the same palette loading/matching functions as generation, removing roughly 110 lines of duplicated logic.
- Feed/sample export formatting was consolidated into `src/lib/admin-export-text.ts`.
- Mood stance options derive from `STANCE_CONFIG`. Redundant tension normalization delegates to the shared configuration parser.
- Generation/daily JSON parsing reuses `safeJsonParse`; historical philosopher suggestions use the shared model-output parser.
- Debate synthesis reply-target lookup uses joins instead of one additional query per rebuttal.
- Prompts reuses the existing shared philosopher interface.

Some apparent duplication was deliberately retained: Node and middleware token verification serve different runtimes; DB-first templates need their code fallback; route-specific editorial workflows have meaningful differences. Removing these indiscriminately would increase risk.

## Deferred findings and implementation plan

Priority meaning: **P1** can misattribute or lose editorial work during ordinary interaction; **P2** affects correctness, reliability, or security hardening but needs a defined contract or broader change; **P3** is maintainability, growth, or secondary consistency work. Priorities reflect code evidence, not confirmed production incidents. References are to the reviewed working tree.

### F01 — P1: Late responses can attach content to the wrong selection

**Evidence:** `src/app/admin/content/page.tsx:308` starts a request and `:339` stores its preview without immutable originating philosopher/type/citations; approval at `:369` uses the current selection. Generate for A, switch to B, receive A's response, then approve: A's text can be attributed to B. Changing type after generation can also change save metadata. Similar workshop state updates exist at `agora/page.tsx:585` and `debates/page.tsx:288` when another thread/debate is resumed.

Template loading at `templates/page.tsx:83` and prompt loading at `prompts/page.tsx:51` accept whichever response finishes last. A slow A request can replace B's editor data, and mutation refreshes can bring back the old context.

**Plan:** retain immutable preview context, scope state by entity, track request identity for reads and mutations, discard stale completions, and specify whether navigation waits or preserves an in-flight job. Do not equate cancelling a browser request with undoing server work. **Acceptance:** tests for slow A/fast B/late A, switching during generation/approval/save, and changing type after generation. This needs coordinated read, mutation, and recovery behavior rather than isolated disabled buttons.

### F02 — P1/P2: Post/log operations lack a durable relationship and atomic editorial commands

**Evidence:** `daily/useReviewActions.ts:32`, `everyday/page.tsx:390`, `historical-events/[id]/page.tsx:527`, and `content/page.tsx:364` update posts and logs through separate requests. Generate ignores the log PATCH's HTTP status; a lost response after post creation also permits a duplicate retry. Server routes trust client-supplied generation-log IDs (`daily-generate/route.ts:832`, `:866`, `:872`; debate approval `:83`; Agora approval `:72`). There is no dependable artifact-to-log relationship to validate against.

Posts' mood display guesses the matching generation by philosopher and a two-minute window (`api/admin/posts/route.ts:78`). Correct timestamp parsing cannot disambiguate nearby same-philosopher runs.

**Plan:** add an explicit post/generation association and migration; backfill only unambiguous cases. Implement server-side approve/publish/reject/delete commands that derive associated logs, transact related writes, accept idempotency keys, and return authoritative state. Update callers together. **Acceptance:** failure on the second write rolls everything back; retry after lost response creates no duplicates; unrelated log IDs remain unchanged; moods remain attached to their originating generation. Deferred because schema/backfill and editorial-state decisions are required.

### F03 — P2: Remaining concurrency and approval ambiguity

**Evidence:** daily regeneration checks draft status after the model returns but not the draft revision (`daily-generate/route.ts:797`, `:840`). Two regenerations, or a manual edit and generation, can overwrite one another while status remains draft. Debate approval inserts a fresh contribution on every request (`debates/[id]/approve/route.ts:75`). Agora/Debates approval controls have no pending approval state (`agora/page.tsx:619`, `:843`; `debates/page.tsx:317`, `:577`).

**Plan:** introduce revisions/compare-and-swap or generation leases, define whether approving a contribution replaces a slot or creates another, then add idempotency/uniqueness and per-response pending state. Audit existing duplicate contributions before constraints. **Acceptance:** concurrent regeneration rejects stale output; double approval produces one intended contribution; approve/regenerate overlap has a deterministic result.

### F04 — P2: Editorial completion and approval states are inconsistent

**Evidence:** Everyday and Historical approve a generation log while the post remains draft (`everyday/page.tsx:335`, `historical-events/[id]/page.tsx:476`). Those workshops can display approval that Posts' approved filter cannot see. Debate/Agora Proceed buttons advance locally without awaiting a status PATCH (`debates/page.tsx:950`, `agora/page.tsx:1244`). Debate synthesis can save `{}` and mark complete (`api/admin/debates/[id]/synthesis/route.ts:140`, `:169`); status PATCH also permits completion without checking required content. Agora synthesis sections/type are loosely checked (`api/admin/agora/[id]/synthesis/route.ts:173`).

**Plan:** define approved-generation versus approved-post semantics and required completion content; centralize allowed transitions and await acknowledged transitions in the UI. Keep intentional manual editorial overrides explicit. **Acceptance:** status survives reload and agrees across workshops/Posts; failed transition leaves local state unchanged; incomplete synthesis cannot silently complete a workflow. Product/editorial decisions should precede stricter rules.

### F05 — P2: Admin batches need durable progress and recovery

**Evidence:** Daily, Everyday and Historical batches execute in HTTP requests (`api/admin/daily-generate/route.ts:221`, `everyday/generate/route.ts:133`, `historical-events/route.ts:428`). A disconnect/restart can leave partial output or model spend; retry can repeat work. Historical generation accumulates output before final insertion. Daily review and workshop previews are component-local (`admin/daily/page.tsx:29`, `daily/useDailyGeneration.ts:127`, `everyday/page.tsx:120`, `historical-events/[id]/page.tsx:115`). Posts may persist while batch/dependency/review context is lost on reload.

**Plan:** persist batch/run identity and item checkpoints; adapt relevant concepts from the durable public Agora worker; expose progress/resume APIs with bounded retries and idempotent writes. **Acceptance:** restart or disconnect after intermediate success resumes remaining items; reload restores statuses/dependencies; paid work is not silently repeated. This is a separate workflow project.

### F06 — P2: Admin tokens have no server-enforced lifetime; rate limiting is process-local

**Evidence:** `src/lib/admin-auth.ts:21` derives the same HMAC from a fixed payload and password; `:45` only compares that token. The cookie's 24-hour `maxAge` (`api/admin/auth/route.ts:83`) controls normal browser retention, not server validity. A copied token remains valid after logout/expiry until the password changes. Login attempts live in an in-memory map (`:14`), keyed by the first forwarded IP (`:19`); restart or multiple instances do not share enforcement. Expired-entry cleanup is fixed, but this does not provide a distributed limiter or establish proxy trust.

**Plan:** version the session format with signed expiry or use revocable stored sessions; define logout/revocation semantics; verify Railway's actual trusted-proxy behavior before choosing the client-IP source; use bounded/shared rate limiting if deployment topology requires it. **Acceptance:** replay after expiry/revocation fails, password rotation invalidates tokens, Node/middleware agree, and limiter behavior survives the supported instance/restart setup. Changing token format will intentionally log existing admins out, so it should be released separately.

### F07 — P2: Outbound RSS requests and response sizes need a shared policy

**Evidence:** `api/admin/news-scout/sources/test/route.ts:28` and `src/lib/news-scout-service.ts:453` call `rssParser.parseURL` on administrator-configured URLs without the safe-destination/redirect validation used by other fetch paths. This is behind admin authentication; the concern is internal-server fetching through a compromised or mistaken administrator/configuration, not a demonstrated anonymous endpoint. OG-image extraction says it reads roughly 20 KB but calls `res.text()` before truncating (`news-scout-service.ts:141`); article extraction likewise materializes the complete HTML response.

**Plan:** shared bounded RSS/HTML fetching with time and byte limits, safe protocol/destination checks at every redirect, and a considered DNS-resolution policy. Validate initial URLs alone is insufficient. **Acceptance:** legitimate feeds work; private/loopback destinations and redirect cases are rejected; oversized bodies stop downloading before full buffering. Needs integration fixtures rather than a superficial one-line URL check.

### F08 — P2: Finish field-level request and model-output validation

**Evidence:** philosopher PUT still serializes unchecked `key_works`/`core_principles` shapes and binds optional fields (`api/admin/philosophers/route.ts:145`); public consumers expect structured arrays. News Scout casts parsed JSON to `ScoreResponse` without validating score/nested fields (`src/lib/news-scout-service.ts:585`); a string score can participate in string concatenation before clamping. Historical integer coercion accepts numeric prefixes via `parseInt` (`historical-events/route.ts:55`, `[id]/route.ts:20`); date components are checked independently, and batch items count before full normalization (`historical-events/route.ts:486`, `:552`). Some historical payloads can still turn wrong field types into 500s. Tier readers now normalize types/bounds, but cross-tier overlap/order is not a validated contract.

**Plan:** define runtime schemas for the remaining request/model contracts, including bounded numeric fields, nested strings/arrays, valid stances/philosopher IDs, and historical date rules for BCE/unknown years. Reject invalid input before writes; distinguish invalid model output (422) from server errors. **Acceptance:** malformed nested payloads leave records unchanged, invalid model batches cannot report success, and scoring cannot coerce string scores into unintended values. Keep this explicit; TypeScript casts are not runtime validation.

### F09 — P2: Automatic daily selection ignores inactive philosophers

**Evidence:** `api/admin/daily-generate/route.ts:203` reads the entire roster, while historical suggestions filter `is_active` at `historical-events/[id]/route.ts:157`.

**Plan:** define inactivity consistently: recommended default is exclusion from automatic selection, with a deliberate decision on explicit manual historical/editorial overrides. Apply to selectors, validators and UI together. **Acceptance:** inactive philosophers never enter automatic batches, and manual behavior is documented/tested. Deferred because changing the meaning of an existing editorial control without checking all workflows can be surprising.

### F10 — P2: Preview and analytics do not describe the same data window as the public feed

**Evidence:** `api/admin/feed-preview/route.ts:174` fetches/interleaves every published post; `src/lib/data.ts:215` caps public candidates at 300. Preview duplicates the SQL/mapping at `feed-preview/route.ts:30`, `:65`. Its ordering can therefore differ from what visitors see after enough posts exist. News Scout distribution/count calculations use a maximum 500-candidate array (`admin/news-scout/page.tsx:353`, `:782`) without clearly separating sample analytics from total counts.

**Plan:** share public-feed candidate retrieval/mapping for faithful preview and explicitly separate all-history analytics. Compute score distribution in SQL or label the sample. **Acceptance:** more-than-300-post fixtures give matching preview/public ordering; more-than-500-candidate fixtures show correct counts and bucket totals. A bare cap change would also alter the preview's historical metrics, so coordinate the API/UI meaning.

### F11 — P2: List requests can finish out of order

**Evidence:** Posts, News Scout and Historical lists replace state without checking whether a response still matches the current filters (`admin/posts/page.tsx:191`, `news-scout/page.tsx:315`, `historical-events/page.tsx:112`). Historical create/batch sets new filters and explicitly fetches using an older closure (`:205`, `:252`). Fixing News Scout's skipped first filter does not solve these general races.

**Plan:** add latest-request identity/cancellation with selection-scoped loading/error state; remove stale redundant refreshes. **Acceptance:** rapid filter/page changes and reverse completion order always show the latest selection, including after create/batch actions. Implement alongside F01's consistent request lifecycle.

### F12 — P3: Secondary persistence, scale and maintainability work

| Finding / evidence | Proposed work and verification |
| --- | --- |
| Thumbnail filesystem and DB writes remain separate; failure can orphan a new file, and concurrent replacement/deletion has no revision guard. Deleting an unused historical event does not remove its thumbnail. `historical-events/[id]/thumbnail/route.ts:50`, `:91`; `[id]/route.ts:371`. | Add version-aware ownership, compensation and orphan reconciliation/GC. Verify DB/file failures and concurrent requests; avoid pretending a SQLite transaction includes filesystem writes. |
| Prompt/template/house-rule versions use `MAX(version)+1` and application-managed active state; schema lacks matching uniqueness/single-active constraints. `prompts/route.ts:64`, `content-templates/route.ts:129`, `house-rules/route.ts:64`. | Audit duplicates first, then add transaction-safe allocation and appropriate unique/partial indexes through migrations. Test supported multiple-writer behavior. Current synchronous single-process execution lowers immediate risk. |
| Users and preview queries return unbounded history; users have correlated counters. `users/route.ts:32`, `feed-preview/route.ts:174`. | Add pagination and measure query plans on representative data. Keep payloads bounded; preserve needed aggregate totals. |
| Export labels classify citation-less formats too broadly as Timeless Reflection. `export-feed/route.ts:33`, `export-samples/route.ts:36`. | Reuse the content classifier and decide which recommendation/art/everyday metadata belongs in each format; snapshot representative exports. Formatting duplication is removed already. |
| Candidate numeric filters and diverse mode have inconsistent semantics. `news-scout/candidates/route.ts:89`, `:98`. | Use typed numeric filter parsing and document which user filters diverse mode honors. Test invalid thresholds and each mode's result set. |
| Everyday/historical generated-post normalization and insert/log code remain similar; Daily has repeated prompt-pool readers/selectors and exceeds 1,400 lines. `everyday/generate/route.ts:35`, `historical-events/[id]/generate/route.ts:18`, `daily-generate/route.ts`. | Extract cohesive draft-persistence and prompt-selection helpers after parity tests capture intentional tags/source-type differences. Avoid a generic workflow framework. |
| News Scout is roughly 2,000 lines; Agora/Debates repeat workshop state and locally define card components/types. `admin/agora/page.tsx:728`, `debates/page.tsx:499`. | After correctness work, extract focused components and shared typed API contracts; preserve differences between workflows. Do not introduce a fetch-library rewrite solely for uniformity. |
| Several input labels lack explicit associations, the sidebar is fixed-width, and modal focus behavior lacks review coverage. `generation-settings/page.tsx:178`, `daily/page.tsx:505`, `admin/layout.tsx:34`. | Dedicated keyboard/mobile/browser pass with label associations, focus management and responsive checks. React regression tests are not visual/accessibility QA. |
| Next.js warns about the middleware convention. `src/middleware.ts`. | Migrate to the supported proxy convention separately, preserving every page/API/auth exemption and the production fail-closed policy; verify browser redirects and 401 responses. The current build still succeeds. |

## Recommended delivery sequence

1. **Editor/request correctness:** F01 and F11. Address selection identity for reads, generation previews and mutation refreshes together; add delayed-response browser tests.
2. **Editorial integrity:** F02–F04. Agree state semantics, introduce the post/log association, transactional commands, idempotency and revision checks. Plan/back up/backfill before schema constraints.
3. **Security and data contracts:** F06–F09. Session expiry/revocation, trusted limiter inputs, bounded outbound fetching, nested schemas, and inactive-roster policy. These can be separate focused changes in parallel with phase 2 once contracts are decided.
4. **Durable admin generation:** F05. Build on stable editorial commands and use persisted runs to support reload/restart recovery.
5. **Read-model accuracy and maintainability:** F10 and F12. Align feed preview/analytics, then pagination, migrations, filesystem reconciliation, accessibility, and component/service extraction. Measure before optimizing.

Keep each change independently reviewable. Each phase should carry the acceptance tests listed above rather than relying only on a successful build.

## Coverage and verification details

- UI: dashboard, layout/navigation/login/logout, Generate, Posts, Prompts, Templates/house rules, Scoring, Generation Settings, Mood Palettes, News Scout/Sources, Daily modules, Agora, Debates, Everyday, Historical list/detail, Philosophers list/detail, Users, API Logs and Feed Preview; shared admin types and relevant hooks.
- APIs: all 40 route files under `src/app/api/admin`, including authentication, CRUD/bulk, generation/approval/synthesis, settings, historical thumbnails, RSS testing, exports, backup, stats and user/usage reads.
- Shared paths: Node/middleware auth, generation service/templates, News Scout scoring/fetching, mood resolution, JSON/date/config helpers, image storage, database constraints/migrations and public feed/cache consumers. Public Agora recovery tests were included in the full suite; the public durable worker was inspected for interactions and was not refactored.
- New tests: admin UI (9), CRUD (23), daily/workshop/thumbnail routes (25), auth/config/News Scout (28); existing generation-service tests gained 5 article-context cases. Total added regression cases: **90**.
- Full suite: **292 passed, 24 files**. Includes deletion rollback, generation-versus-publication race, published-reply preservation, atomic synthesis rollback, malformed requests, participant checks before model calls, thumbnail-save failure, login/rate-window behavior, configuration shapes, batch limits, same-millisecond ingestion, settings preservation and failed-action recovery.
- `git diff --check` passed. No new dependency was added. No DB schema change was made.
