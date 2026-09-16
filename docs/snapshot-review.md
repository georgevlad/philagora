# Local review with a live database snapshot

Run `npm run review:snapshot` from the project root. The default source is
`data/philagora-2026-09-07.db`; pass another path with
`npm run review:snapshot -- data/another-snapshot.db`.

Open http://127.0.0.1:3400. Both the application and account helper bind to
loopback only. Set `AGORA_REVIEW_PORT` to change the app port; the helper uses
the next port. The existing fixture preview can stay running separately.

Each start creates a fresh, ignored working copy under `.local-review/snapshot-*`
using SQLite's backup API, including committed WAL data. Migrations apply to
that copy only. The source snapshot, normal database, `.env.local`, design
explorations, and fixture runner state are preserved. The active copy's path is
recorded in `.local-review/snapshot-active.json`. Copies from earlier runs remain
available; restarting does not reuse changes made during a previous review.

The banner identifies real saved content. Suggestions, submissions, follow-ups,
and recovery return a clear generation-disabled error before modifying threads.
The worker is disabled, the real API key is overridden, and the provider URL
points to a loopback service that rejects all generation requests. Analytics
and Google sign-in are unconfigured in this preview. Production behavior and
the fixture runner are unchanged.

Use the banner's **Use test account** shortcut for a new ordinary local user,
or **Switch to guest**. This is not a new role and does not impersonate any live
user. Existing ownership and privacy remain in force, so the new account's
question history starts empty. Imported sessions and verification records are
removed only from the copy, and fresh local authentication secrets are used.
Bookmarks and other ordinary account interactions affect only the working copy.

Use `npm run review:agora` separately for generation and recovery scenarios with
fixtures. The snapshot preview is for inspecting actual saved content, including
its original answer lengths, prompts, and legacy conversation shapes.

Historical thumbnails are files under `data/thumbnails`, not SQLite blobs.
A database export alone does not include them. Those images will be missing locally; copy the corresponding thumbnail directory separately if needed.

