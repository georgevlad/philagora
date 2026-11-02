# Writing model comparison

The model settings offer Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1 alongside the existing models. **Opus 5.5 is the generation and synthesis default.** The scoring selector also offers Sonnet 5.5 and Haiku 5.5; the scoring default is unchanged.

`normalizeMessageParams()` removes unsupported sampling parameters for these models, defaults to adaptive thinking at medium effort, and provides at least 8,192 output tokens for reasoning plus the JSON response. Existing word limits and output validators still govern the visible prose. Explicit effort/output formats and larger token ceilings are preserved. Existing models retain their previous settings.

The integration uses the existing SDK and shared generation/logging path. Thinking and text are already separated by block type.

## Railway rollout

Migration 24 runs through the existing database bootstrap on deployment. It upgrades saved `generation_model` and `synthesis_model` values from Opus 4.8 to Opus 5.5 and supplies Opus 5.5 when either setting is absent. Both changes run in a transaction. Other explicitly selected models, News Scout scoring, published content and prompts are preserved. There is no table/schema change or new environment variable.

After committing and pushing these changes to the Railway-linked `main` branch, the existing startup flow applies the migration against `DATABASE_PATH`. Confirm the startup log contains `Migration 24 (upgrade_writing_default_to_opus_5_5) applied`, then check both selections in Admin → Generation Settings. This verification needs no paid generation.

For rollback, select Opus 4.8 for writing and synthesis in Admin → Generation Settings. Migration 24 is recorded once, so later restarts preserve that choice.

## Run a local comparison

```powershell
# Prepare an isolated DB snapshot and 20 frozen cases without API calls.
npm run compare:writing

# Make paid requests: five models, 20 cases each, up to three concurrent requests.
npm run compare:writing -- --run

# A small smoke run, resumable by rerunning without --limit.
npm run compare:writing -- --run --limit 1
```

Use `--out .local-review/my-comparison` for a new snapshot or to resume an existing run, and `--models claude-opus-4-8,claude-opus-5-5` to limit paid calls. Existing result files are skipped, including failed results, so resuming does not silently cherry-pick better outputs. Generation-code changes require a fresh output directory.

The source is `DATABASE_PATH` from the environment or `.env.local`, falling back to `db/philagora.db`. It is opened read-only and copied with SQLite's backup API. The service then uses only the copy for migrations, model settings and API logs. No posts, publication state or live settings are changed. Output files contain prompts and source material; keep the ignored `.local-review` directory local.

The corpus uses current saved personas, DB-first templates, house rules and recent-writing context. Sources come from saved generation inputs and completed public Agora threads. Personal display names are replaced with Anonymous; private threads are excluded. Agora samples use a first-response setup with recommendations disabled. Synthesis uses fixed existing responses, so it measures summarization separately from the candidate models' answers. No claims are made that old news inputs are current or independently verified.

New models run at medium effort with reasoning headroom; the baseline uses existing Opus 4.8 settings. This evaluates deployment configurations, not equal token budgets. The service's usual one length-repair attempt is included. Results include all attempts, token usage, requested/returned model IDs, HTTP status, latency, exact request bodies (without credentials), and final validation status. A failed sample remains a failure even if it contains readable prose.

Open `comparison.html` to compare anonymous candidates and reveal model names. `blind-review.json` omits model identities, `model-key.json` contains the per-case mapping, and `summary.json` contains measured validity, first-pass success, tokens, standard-rate estimated cost and latency. Standard prices are dated in the script; thinking is billed as output. Cost estimates are not invoices. The report does not automatically score literary quality.

Judge philosophical fidelity, concrete reasoning, natural prose, source fidelity and repetition before revealing identities. One sample per model per case is exploratory evidence, not a statistically robust ranking. Run additional matched cases and repeat samples before changing a production default solely on small differences.

## Initial comparison: 2026-11-02

The completed local run produced 100 samples with 111 API calls including normal length repairs, at an estimated standard-rate cost of **$2.76**. No paid judging calls were made. All first-request system prompts and user messages matched across the five models for each case; every response reported the requested model.

| Model | First choices in blinded editorial review | Passed existing validator | First pass | Mean sample latency | Cost for 20 samples |
| --- | ---: | ---: | ---: | ---: | ---: |
| Opus 5.5 | 13/20 | 20/20 | 20/20 | 7.5s | $0.545 |
| Fable 5.1 | 4/20 | 20/20 | 17/20 | 9.5s | $1.489 |
| Sonnet 5.5 | 3/20 | 19/20 | 19/20 | 2.8s | $0.186 |
| Haiku 5.5 | 0/20 | 20/20 | 16/20 | 6.2s | $0.022 |
| Opus 4.8 | 0/20 | 20/20 | 17/20 | 4.4s | $0.517 |

Recommendation from this run: **Opus 5.5 at medium effort** for writing and synthesis. Its first-place samples more often preserved qualifications, engaged the actual argument and avoided generic philosophical ornament. It cost about 6% more per completed sample than the baseline here, despite lower per-token rates, because of thinking tokens. Fable won several excellent individual passages but did not justify its overall cost in this set. Sonnet is a credible cheaper alternative; its quip remained above the word limit after repair. Haiku's low cost makes it worth considering for non-editorial work, but this run did not evaluate scoring accuracy.

These are one assistant's subjective preferences with model labels hidden until rankings were recorded, not a human panel or benchmark of universal superiority. Passing the current broad validator is not proof of correctness: one synthesis used an unexpected summary key, some outputs spoke about their persona in the third person, and some current-event outputs introduced unsupported details. The fixed source material also includes older, imperfect outputs and a misleading film synopsis; these limit what a model change alone can improve.

The ignored local folder `.local-review/model-comparison-2026-11-02` contains `comparison.html`, every request/result, the blinded rankings and rationales, and the model key. Open the report to compare the actual prose, reveal names and expand the editorial assessment. The comparison itself left application settings unchanged; the subsequent deployment migration adopts the selected winner as described above.

## Provider references

- [Current model lineup](https://platform.claude.com/docs/en/models/overview)
- [Opus 5.5 migration](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide)
- [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)
- [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview)
- [Fable 5.1 migration](https://platform.claude.com/docs/en/models/fable-5-1/migration-guide)
