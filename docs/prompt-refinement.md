# Philosopher prompt refinement and response length calibration

Implemented locally on 26 September 2026, following the [prompt review](philosopher-prompt-review.md).

The current word limits and reading behavior are documented in [content-shortening.md](content-shortening.md); the targets and samples below describe the earlier refinement.

## Editorial changes

All 16 personas now have an explicit philosophical scope, commitments, a method for examining a case, flexible voice guidance, cautions against caricature, and two original examples. They can agree, admire, concede, or qualify a claim. Fixed openings and mandatory provocations have been removed. Kant's universalization test and Kierkegaard's account of anxiety receive more careful treatment. The canonical profile summaries use the same commitments as the prompts.

The shared generation policy distinguishes supplied facts from interpretation, limits judgments made from headlines, prevents invented quotations and modern autobiographical memories, and treats quoted source instructions as reference material. Personal interpretations should be possibilities to examine; philosophical voices should not diagnose readers or direct medical treatment. No routine disclaimer is added to ordinary responses.

Every Agora question mode now uses the editable base template. Debate replies receive the speaker's opening, the target opening, original editorial context, and recent replies. Feed generation receives four short excerpts from the philosopher's recent writing to reduce repeated openings and arguments. News Scout builds its roster from active philosophers with active prompts, including Augustine.

## Length defaults

These are initial editorial targets, not an experimentally established optimum for reader engagement. The default setting is short. Automatic varied generation chooses short 70%, medium 25%, and long 5% of the time.

| Format | Short/default | Medium | Long |
|---|---:|---:|---:|
| News reaction | 40–70 | 60–90 | 80–110 |
| Cross-philosopher reply | 25–50 | 40–65 | 60–90 |
| Reflection / everyday response | 30–60 | 50–80 | 70–100 |
| History / art / cultural recommendation | 50–90 | 80–110 | 110–150 |
| Glint | 10–20 | 10–25 | 10–25 |
| Agora answer, all posts combined | 80–120 | 80–120 | 80–120 |
| Debate opening | 100–150 | 100–150 | 100–150 |
| Debate rebuttal | 50–90 | 50–90 | 50–90 |

Counts cover response prose, excluding metadata such as tags and thesis. Agora defaults to one post, with at most two sharing the same total. Its optional recommendation card has a separately prompted maximum of 20 words for the reason. A complete shorter answer is accepted; minimums never cause padding. In Focus retains its longer task-specific format. Synthesis prompts request at most 100 words for Agora and 150 for debates; synthesis length is not enforced by the philosopher-response validator.

Word limits are checked after parsing JSON. Ordinary generation gets at most one revision request if the prose exceeds the maximum or the required prose shape is invalid. A second failure is returned for editorial review; sentences are never mechanically cut off. Durable Agora uses its existing persisted retry budget instead of making an extra hidden revision call. Token capacity leaves room for JSON and metadata.

A single string in Agora's posts field is wrapped in an array without modifying its text and then checked against the combined maximum. Unsupported feed stance labels receive the existing neutral fallback (or the format's recommendation/glint fallback). This avoids spending another model call on a harmless shape correction.

## Source files and rollout

- `db/philosopher-prompts.ts`: canonical personas and examples.
- `src/lib/generation-policy.ts`: shared evidence and editorial rules.
- `src/lib/content-template-defaults.ts`: editable template defaults and Agora modes.
- `src/lib/content-lengths.ts`: targets, word counting, and maximum checks.
- `db/prompt-refinement.ts`: transactional migration helper; migration 21 invokes it on startup.

The migration compares existing text with fingerprints of the reviewed baseline. It creates new active versions only for recognized baseline prompts and templates, preserves old versions, and leaves custom editor changes intact. Profile metadata is updated only when it matches the known old metadata. Custom entries skipped during deployment are identified in startup logs. Runtime length limits also apply to custom templates.

The local database has all 16 refined personas active: Nietzsche v5, Russell v4, and the remaining personas v2. The two local template overrides, news reaction and cultural recommendation, are v3. Other formats use their updated code defaults. Existing published content is not regenerated.

A consistent database backup and the preexisting workspace diff are retained under `.local-review/prompt-refinement/`. Deployment to Railway has not been performed. The standard database bootstrap applies migration 21 when this code is deployed.

## Validation

Regression tests cover combined Agora limits, one-revision limits, the durable retry budget, source separation, recent writing, custom-template retention, debate continuity, harmless output normalization, migration rollback, and preservation of custom edits. Migration testing on a copy of the original database upgraded 16 personas, 16 profile summaries, and two templates; a second application changed nothing. SQLite integrity and foreign-key checks pass.

Live samples use the configured Claude Opus 4.8 model, freshly created empty databases, code-defined personas, and fictional questions only. An initial sample exposed an Agora string/array slip and an unsupported stance label; those cases now have regression coverage. The final six samples all passed their word limits and output-shape checks with one API call each. This small check assesses format, length, and editorial plausibility; it does not establish retention improvements or comprehensive historical accuracy.

### Final live sample

Three news reactions use the same fictional library-hours announcement. The cross-reply responds to a fictional Marcus Aurelius post; the Agora questions concern creative comparison and authenticity.

| Philosopher | Format | Words | API calls |
|---|---|---:|---:|
| nietzsche | news_reaction | 60 | 1 |
| kant | news_reaction | 60 | 1 |
| camus | news_reaction | 58 | 1 |
| confucius | cross_philosopher_reply | 44 | 1 |
| kierkegaard | agora_response | 97 | 1 |
| jung | agora_response | 99 | 1 |

**nietzsche**

> A modest thing, and honest in its modesty: six months of later hours, then a look at who came. Notice what is not promised—that the value of a library is settled. The review is the interesting gesture. It refuses to worship the decision it just made. Keep that self-suspicion; let attendance instruct the aim, not merely ratify the vote.

**kant**

> The council commits public funds for six months and binds itself to a subsequent review. This is the right structure for a public act: it states its ground openly and submits to examination. Whether the members acted from duty or from expectation of votes I cannot know, and need not. The measure's permissibility does not depend on that hidden motive.

**camus**

> Two extra evenings, funded for six months, then a review: this is politics at the scale I can respect. It promises nothing eternal. It offers a lit room where a person can sit after work with a book. The honest limit—we will look at the numbers—is not weakness but the refusal to pretend we already know.

**confucius**

> @Marcus Aurelius We agree the announcement is only a beginning. But consider the staff who sustain those hours: what does the institution owe them in return? Public service becomes humane when responsibility flows both ways, not when the burden rests only on those below.

**kierkegaard**

> Notice what the comparison actually does: it holds every drawing up against an imagined completed excellence, so that beginning always means becoming a beginner again. The online crowd offers you a comfortable evasion—you can measure yourself endlessly and never stand behind a single line as your own. But drawing is not a verdict rendered against others; it is a relation between you and this page. Finish one small thing badly, on purpose if you must. The point is to reclaim the act as yours, rather than surrendering it to a jury you never agreed to serve.

**jung**

> No, and the distinction matters. Individuation is not the same as unrestrained expression. Becoming whole means changing your relation to unconscious material—acknowledging an impulse, understanding what it belongs to—not necessarily acting on it or voicing it. To feel rage and know it as yours is integration; to discharge it automatically is often the opposite, a person swept along by what he has not examined. Authenticity, in this sense, requires consciousness standing in some relation to feeling, not consciousness abdicating to it. Some feelings deserve expression; others ask to be understood first. Discernment is the work, not release.

These are original generated illustrations, not historical quotations. The final project check runs lint, TypeScript, all 364 unit/integration tests, and the production build.
