# Shorter content and reading previews

Implemented locally on 2 November 2026. No deployment or published-text rewrite is part of this change. This updates the length policy described in [prompt-refinement.md](prompt-refinement.md).

## New generation

| Format | Default words | Explicit medium | Explicit long |
|---|---:|---:|---:|
| News reaction | 30–50 | 50–75 | 75–100 |
| Cross-philosopher reply | 20–40 | 40–60 | 60–80 |
| Reflection / everyday observation | 25–45 | 45–65 | 65–90 |
| Recommendation / history / art | 40–70 | 70–100 | 100–140 |
| Glint | 10–20 | 10–25 | 10–25 |
| Agora answer, all posts combined | 50–80 | same | same |
| Debate opening | 80–110 | same | same |
| Debate rebuttal | 40–60 | same | same |
| Agora synthesis, all fields combined | 30–50 | same | same |
| Debate synthesis, all fields combined | 60–90 | same | same |

The upper bound is enforced after JSON parsing. A complete shorter response is accepted; minimums never cause padding. Agora recommendation reasons have a separate 20-word maximum. In Focus retains its longer format.

Daily generation and News Scout start with the short setting. Explicit medium, long, and varied choices remain available. Existing user-selected settings are retained.

Ordinary generation can revise once after a length/shape violation. Durable Agora makes one provider call per persisted attempt, within its existing three-attempt budget. Synthesis now uses the same validation and failure logging pattern, including rejection of token-truncated output. Prose is never mechanically clipped before storage.

Shared instructions emphasize a direct answer, one developed thought, concrete reasoning, meaningful qualifications, and stopping without a recap. For personal questions, interpretations of feelings must remain conditional. Synthesis must retain the direction and conditions of advice.

## Agora

Suggestions return two relevant thinkers, and group review preselects at most two. Readers can still choose two to four. Saved explicit choices survive refresh and sign-in.

Later answers receive earlier saved answers from the same round as reference data, including during follow-ups. Their task is to develop an additional reason, test, implication, or limit without restating the earlier premise. Agreement is allowed. Recovery retains the source context already saved for an attempted step. These instructions improve variety but cannot guarantee distinct or historically authoritative answers.

## Existing content and display

- Feed cards show prose without a separate thesis heading. Detail pages and sharing retain the thesis.
- Feed prose up to 80 words is shown completely; longer posts use sentence-aware prefixes. Glints and full post pages remain fully visible.
- Agora answers up to 90 words are shown completely. Longer saved answers offer “Read full answer.”
- Syntheses over 60 words show a short excerpt of their first populated section, with its original label and “Read full synthesis.”
- Expand/collapse buttons support keyboard use and expose their state with `aria-expanded` and `aria-controls`. Expanded content uses the complete original strings.
- A very long unpunctuated sentence falls back to a whole-word preview with an ellipsis. This affects display only.
- The logo and Beta badge can wrap at enlarged text sizes on narrow screens.
- Returning readers' “New” badges appear after hydration so saved visit times cannot cause a server/client rendering mismatch.

## Database compatibility

Migration 22 versions only recognized earlier default templates, using fingerprints captured before this change. It preserves custom templates and all prior versions. Final runtime length contracts also apply to custom templates. The migration changes no published posts, conversations, responses, debates, or syntheses and needs no schema change.

The preexisting workspace changes and saved-content fingerprints were recorded under `.local-review/shortening/`. Migrations were exercised twice on separate copies of both available November databases; all saved-content fingerprints remained identical, and SQLite integrity and foreign-key checks passed.

## Review and validation

Validation artifacts are under `.local-review/shortening/`: unit/integration results, production build and lint logs, browser results, screenshots, migration fingerprints, and live generation samples.

The final unit/integration run passed 385 tests across 32 files. Lint and TypeScript checks passed. The production build passed, with the existing Next.js middleware deprecation warning.

All 53 browser checks passed across the main run and targeted reruns, covering public pages, Agora submission and follow-up, recovery, privacy, saved interactions, In Focus, keyboard reading controls, and responsive layouts. Verification also caught and fixed the narrow-screen Beta badge overflow and returning-reader hydration mismatch. Test fixtures were updated for the new defaults; missing fixture timestamps and a shifting button selector were corrected. Two interrupted checks passed on isolated rerun.

Nine initial live samples covered news, reflection, recommendation, reply, Agora answers and synthesis, and a debate opening using fictional inputs. All passed their final word limits; one reply needed its bounded length revision. Initial Agora repetition and a reversed synthesis condition prompted a tighter shared instruction and one further check of that same two-person exchange. The revised answers were 61 and 65 words, with a 44-word synthesis. Samples are original simulations, not historical quotations or proof of improved reader retention.

Following editorial review, synthesis now has a separate fidelity instruction after editable templates: shared claims must retain every attributed speaker's conditions and exceptions; similar advice or silence cannot establish agreement. Unsupported agreement sections stay empty, and shortening revisions must preserve qualifications. Philosopher voice instructions and word limits are unchanged. One live retest using the exact saved Seneca and Russell answers produced a 36-word synthesis with an empty agreement section, preserving Russell's distinction between real neglect and habitual guilt. The original sample files remain intact; the new result is saved in `synthesis-fidelity-sample.json`. All 83 relevant generation/recovery tests passed, along with lint and TypeScript checks.

The fixture preview exercises generation, follow-up, recovery, privacy, and reading controls with a loopback provider and an isolated database. The snapshot preview reads a copy of saved content with generation disabled. Neither publishes or changes the source database.
