# Durable Agora recovery (phase 4)

Implemented on `codex/agora-homepage-implementation`, directly in the existing checkout. The redesign and the mocked issue-in-focus feature are unchanged.

## Acceptance and saved context

The public submit and whole-group follow-up routes insert a thread, its participants, one `agora_jobs` row, and its `agora_job_steps` rows in the same SQLite transaction. There is no accepted-thread/unsaved-job gap. Submission replays retain the original ID and allowance. Recovery never calls submit or follow-up.

The versioned job snapshot contains the exact accepted question, author label, classification, recommendation flag/hint, ordered participants and their synthesis labels, audience, owner, and extracted article text. A follow-up additionally freezes its original question, responses, recommendations and synthesis. Recovery does not fetch an article again, reclassify a question, select another group, or rebuild follow-up context from the current parent.

Each step stores the source material and template when first attempted and reuses them on retry. Saved recommendations seed recommendation avoidance for subsequent participants. The shared generation service still supplies the persona, house rules and configured model settings. Those shared administrative settings remain DB-first and can change before a not-yet-completed call; this is not a byte-for-byte snapshot of the entire model request.

## Worker lifecycle and limits

`src/instrumentation.ts` registers a Node worker at Next server startup. It works with `next dev`, `next start`, and the existing Railway startup wrapper. It does not depend on HTTP readers. The worker scans immediately and again five seconds after draining a batch of up to 20 due jobs. Public POSTs also attempt an immediate claim to avoid waiting for a scan. There is one scan loop per process; immediate POST work may run concurrently for different threads. Multiple processes coordinate through SQLite.

Lifecycle: `queued → running → complete`, or `running → retry_wait → running`, ending at `exhausted` after the budget is used. Invalid or inconsistent saved context becomes `blocked`. Existing thread statuses remain compatible: pending/in_progress while runnable, complete only when every selected participant has a saved response and synthesis exists, failed on exhaustion or a block.

- A claim uses an IMMEDIATE transaction, a random fencing token, and a two-minute lease. The worker renews the lease every 40 seconds. A restart preserves another process's unexpired lease; recovery can begin after its expiry and the next scan. The batch drain can add queueing time.
- Each answer and synthesis gets **three total attempts**, including the initial attempt. The attempt is persisted before calling the provider, so process death also consumes budget. Failure backs off 30 seconds, then two minutes. POST recovery cannot skip backoff or replenish attempts. A new four-person job can make at most 15 durable model requests, excluding the existing pre-acceptance classification/suggestion calls.
- Durable Agora calls disable the SDK's additional HTTP retries and have a 90-second request timeout. Other generation and the admin preview workflow keep their request settings. Provider timeouts can still leave remote work in flight.
- Responses run in the original order. A failed participant pauses later work; a fresh synthesis is generated only after all participants have answers. Exhaustion requires manual editorial completion; there is no browser control that resets the budget.
- Explicit recovery is limited to **five requests per ten minutes per registered account**, across conversations. The administrator override shares its own five-request bucket. The limit is persisted in SQLite and returns HTTP 429 with Retry-After. Replays count, including no-op or ineligible requests. Unauthorized requests never enqueue work.
- `AGORA_WORKER_DISABLED=true` disables the startup scanner for builds/maintenance. It does not disable explicitly authorized generation POSTs. Production builds must run against an isolated DB with this flag, as in local validation. Build-phase registration also excludes the scanner.

## Persistence and the crash boundary

Claims, attempt reservations and result writes use transactions. Every result transaction rechecks the active token and lease, and inserts only if that participant's response or the synthesis is still absent. Expired workers cannot save late output. Completed rows, IDs, text, recommendations and synthesis are not overwritten by recovery.

This provides **idempotent database results, not exactly-once model calls**. If the provider finishes and the process dies before saving, the retry may call the provider again. Lease expiry can also overlap a slow remote call with a new attempt. Both consume the bounded budget; only the current lease holder can persist. No distributed transaction exists with the provider.

Schema migration 18 is additive, updates both schema.sql and migrations.ts, and preserves legacy rows, including existing duplicate answers. It does not silently delete, deduplicate or regenerate history. Jobs and steps cascade when their thread is deleted. Snapshots contain private content and must receive the same backup/access treatment as the conversations themselves.

## Eligibility and edge cases

| Existing state | Recovery behavior |
| --- | --- |
| New persisted job interrupted after an answer | Skip that saved answer and continue the missing participants, then synthesis. |
| All answers saved, synthesis failed | Retry synthesis only. |
| Status says complete but work is missing | Evaluate actual saved work, not status alone. A valid runnable job or eligible legacy adoption can continue it. |
| Synthesis already saved, some answers missing | Keep that synthesis exactly as written and fill only missing answers. The preserved synthesis may describe the earlier partial exchange; recovery does not revise it to incorporate later answers. |
| Interrupted follow-up with a snapshot | Recover the child job independently using its frozen context, in the same reading conversation. |
| Parent already has a follow-up | No new child is created. Recovery leaves that child's question, answers and saved context untouched. |
| Exhausted job | Keep saved content; editor can manually save missing responses/synthesis. No further automatic calls or budget resets. |
| Context mismatch, malformed saved answers or duplicates | Block automatic work for editorial review. |

Pre-change conversations have no job snapshots and are **never automatically adopted at startup**. An owner/admin can explicitly adopt an original public-pipeline submission (identified by a saved IP) only if the stored inputs are sufficient: 2+ participants, unique valid answers consistent with original participant insertion/response order, and no child lacking its own durable snapshot. Missing-answer recovery additionally requires no article URL and recommendations disabled, because the old pipeline discarded article bodies and recommendation hints. Synthesis-only recovery can use the retained article metadata and completed responses. Old follow-ups cannot be reconstructed faithfully and require editorial intervention. Old admin-created drafts remain on the manual workflow.

New job budgets begin at adoption; historical model calls were not durably associated with steps and cannot be counted retrospectively. Stop old application workers before rolling out the new writer against a shared database; an older binary does not honor these leases.

## Access, UI and admin paths

Only the registered owner or existing administrator override can POST `/api/agora/[threadId]/recover`. Public visibility grants read access only. Guests remain unowned after sign-in; their newly accepted persisted jobs can nevertheless recover automatically. Private reads and mutations retain the existing not-found behavior for non-owners. Recovery never consumes another initial-question allowance or changes audience/ownership. Follow-up eligibility now checks actual completeness, and an existing follow-up replay is reconciled before this completeness check.

The public API returns content-free recovery state, action permission and (when applicable) the scheduled retry time. It never returns the job snapshot, source material, lease token, provider errors or attempt inputs. Generation job logs omit question/output text; provider errors are redacted. Historical log rows are not rewritten.

The conversation UI distinguishes queued/running, scheduled retry, available legacy recovery, exhausted and blocked states. “Check for updates” remains a read. “Recover missing work” requests the same round. Received answer nodes remain keyed by philosopher, saved text/synthesis is preserved, response order is retained, and an anchor protects reading position when filling earlier holes. The requested-recovery button stays mounted so keyboard focus survives completion. Refresh and direct child navigation retain the conversation and its one follow-up.

Admin-created conversations retain preview/generate/approve/save. Active durable jobs reject competing admin generation, approval, synthesis and status mutations with 409. Durable jobs use recovery for model calls; after exhaustion/blocking an editor can manually fill missing content through the existing protected approve/synthesis save APIs, but cannot overwrite completed durable content or bypass the retry budget with the preview endpoint. Final manual completion reconciles the job state. Hiding a conversation from the feed remains available.

## Local validation and review

Run `npm run review:agora` (optionally set AGORA_REVIEW_PORT). The runner creates a fresh `.local-review/run-*` database, uses an invalid provider key and a loopback-only model fixture, and leaves the normal database alone. Review development assets use a separate `.local-review/next-<port>` directory so a production build can run alongside the review server.

The unit suite covers failure after one saved answer, synthesis failures and empty synthesis rejection, fenced stale workers, concurrent/repeated requests, budgets, backoff, rate limits, owner/non-owner/guest/admin access, immutable article/follow-up context, legacy adoption/exclusions, editorial conflicts, and migration compatibility. Browser tests cover mobile/desktop recovery, keyboard focus, reading position, refresh/navigation, background synthesis recovery, follow-ups, limits and exhausted/legacy states. A separate fixture worker process is killed after one answer; a fresh process resumes the same isolated database without a reader. That test advances only the isolated lease timestamp to avoid waiting two real minutes.

No paid generation or deployment is part of validation. Native mobile browsers, screen-reader speech, provider availability/output quality, and production operational rollout are not exercised.

### Validation completed

- 202 unit tests in 15 files passed. ESLint, TypeScript and the final production build passed. The existing Next middleware deprecation warning remains.
- All 47 distinct browser scenarios passed across the full regression run (46 passed) and the final 14-case recovery rerun (all passed, including the updated partial-completion scenario). The rerun includes real process death/restart, three viewport checks with explicit scroll/focus assertions, and recovery after the actual 30-second backoff.
- Recovery screenshots were inspected at narrow mobile and desktop widths. A final read-only smoke check confirmed the new review session’s recovery and exhausted states.
- Handoff preview: http://127.0.0.1:3300, test account shortcut: http://127.0.0.1:3301/login/owner. Review `/agora/review-failed` for eligible legacy recovery and `/agora/review-exhausted` for the exhausted state. The normal application database and design explorations are unchanged.
