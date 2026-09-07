# Philagora homepage explorations

Three original static alternatives and successive refinements of C for an
Agora-first homepage. The current direction is `conversation-study.html`, using
the selected Paper & clay palette. All files,
fonts and portraits live in this folder. No Next.js build or running application
is needed. Open `index.html` directly in a browser, or serve this directory:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory design-explorations/homepage
```

Then visit <http://127.0.0.1:4173/>. The command assumes the repository root is the
working directory. To review from a phone, copy the folder to a suitable local
preview environment; this command deliberately listens only on the computer.

## The alternatives

| Page | Main idea | Mobile order |
| --- | --- | --- |
| `ask-first.html` | A centred invitation to ask, followed by an example and recent questions | Question composer → sample exchange → recent questions → world → feed/debate |
| `featured-question.html` | A featured question next to a compact composer | Featured question → composer → response excerpts → recent questions → world → feed/debate |
| `life-and-world.html` | One invitation, then personal and public questions in parallel | Composer → personal questions → shared issue → connecting question → feed/debate |
| `life-and-world-v2.html` | C, refined: direct invitation, one featured question on each side, then more conversations | Composer → one personal exchange → shared issue → more Agora questions → feed/debate |

`index.html` is the comparison page. `exchange.html` and `world-briefing.html`
provide shared detail examples. The strip above the product header switches
between explorations; it is review navigation, not a proposed product feature.

## Iteration two: C, refined

Start with `life-and-world-v2.html`. The original A, B and C pages remain
available for comparison. The refined version uses `refinement.css` and
`iteration-two.mjs`; it shares the existing visual tokens and assets.

- The invitation now leads with “What’s on your mind?”
- Personal and world features form a single desktop row. More conversations sit
  underneath. Their HTML order is also their mobile reading and keyboard order;
  the entire personal archive no longer precedes the world feature.
- The world card condenses the philosopher responses into a compact byline and
  links to `world-briefing-v2.html` for the complete reading experience.
- “Ask about this” attaches a removable issue label to the homepage composer.
  It preserves the draft and the public/private choice.
- The refined briefing includes its own composer with the issue already
  attached, relevant suggested questions, and a preview showing the issue and
  source links. Removing context allows a general question.
- Selecting a different recent Agora question clears unrelated issue context.
- Context is a fixed, allowlisted `city-heat` identifier, never arbitrary URL text.
  Questions remain local and are not placed in URLs or storage.

These are interaction prototypes, not a change to the live Agora submission API.

## Colour study

Open `palette-study.html` to compare three palettes on C’s refined layout:

| Palette | Background | Main text | Accent |
| --- | --- | --- | --- |
| Paper & clay | `#faf9f6` | `#282923` | `#a34e36` |
| Chalk & blue | `#f7f8fa` | `#252c36` | `#315e7d` |
| Ivory & wine | `#faf8f7` | `#30272d` | `#854158` |

The selector changes colour tokens without reloading, preserving scroll and
draft questions. “Notes” shows the palette rationale and its exact colours.
The selection carries into `palette-briefing.html` and `palette-exchange.html`.
The original C refinement retains its existing palette.

Palette definitions and the generated review controls live in `palette-study.mjs`.
`palette-controls.js` handles the selector and local navigation;
`palette-study.css` contains review controls and token-based colour overrides.
The palette variants use the same generated content as the approved prototypes.

The fixed `palette=clay`, `palette=blue` or `palette=wine` query parameter supports
direct links when served locally. No preference is written to browser storage.
Without JavaScript, these pages display the default clay palette.

## Typography and mobile spacing

`typography-study.html` is the current homepage refinement. It links to
`typography-briefing.html` and `typography-exchange.html`, which apply the same
reading styles to the longer examples. The review strip links to the matching
previous page; earlier prototypes and the palette study are preserved.

The pass keeps Lora and DM Sans and the selected Paper & clay tokens. It changes:

- The mobile hero uses a fluid 30–36px heading at the default root font size,
  natural wrapping, a shorter introduction, and a visible AI description.
- Homepage body text is 16px; desktop philosopher excerpts are 17px. Controls and
  names are 14px, secondary text 13px, and occasional section labels 12px.
- The main question field uses 16px DM Sans with a 1.6 line height. It avoids the
  sub-16px field size that can trigger input zoom on mobile browsers.
- On phones, response excerpts occupy the full reading width, with a small
  avatar and author line above the text. The author sidebar is removed.
- Personal and world question headings use a fluid 24–28px mobile scale.
- The question action is at least 48px tall. Suggestions and inline actions
  are at least 44px tall; visibility labels have a 42px mobile minimum.
- Mobile side gutters are 20px, reducing to 16px on smaller phones. Sections use
  a consistent 24px rhythm, with tighter spacing inside related content.
- The duplicate “three perspectives” line below the form is removed; the hero
  already explains the format. Privacy guidance stays adjacent to the field.
- Long-form conversation text uses 18px on desktop and 17px on mobile, with a
  1.8 line height and bounded paragraph widths. Briefing prose uses 17px/16px.

The refinement is generated by `typography-study.mjs` and styled by
`typography-study.css`. Earlier stylesheets and HTML files are retained.
No question content is truncated or hidden to shorten the mobile reading path.
Natural wrapping and relative font sizes allow enlarged text to reflow.

## Submission, waiting, answers, and a group follow-up

Start with `conversation-study.html`. It keeps the chosen homepage and adds
a continuous conversation beneath the same header. The review controls above
the product are explicitly part of the prototype, not a proposed product UI.

1. Choose a suggested question or write 10–500 characters. Private is the default;
   public copy explicitly includes both the initial question and the follow-up.
2. Submission opens the thread immediately. The original question, privacy, and
   group remain visible. Any attached city-heat briefing stays linked.
3. Three responses arrive individually, followed by a synthesis. Completed
   responses stay in place as new ones arrive. Arrival announcements do not
   move keyboard focus or explicitly scroll the page.
4. Follow up with the whole group, using the first round as context. There is
   no individual recipient selector. The original question, group, sources,
   visibility, and first responses remain in the same thread.
5. The follow-up repeats the arrival/synthesis experience and ends with a clear
   one-follow-up boundary and an action to ask a new question.

The current API already limits conversations to one follow-up, requires the
registered owner for follow-ups, and validates ordinary questions/follow-ups
at 10–500 characters. This study represents that signed-in owner experience;
it does not simulate authentication or the guest sign-in journey. Three
participants are fixed for each example, not a new philosopher-selection UI.

### Review the states

Open **Prototype controls** to fill a personal dilemma or a public-life
question. Visibility is an independent choice: a world question may be private.
Select the waiting scenario before either an initial or follow-up submission:

| Scenario | Behavior |
| --- | --- |
| Normal arrival | Three authored responses, then a synthesis, in about 8 seconds |
| Taking longer | Holds a calm waiting state; “Keep waiting” resumes the demo |
| Interrupted after one answer | Keeps the answer already received; retry completes the remainder |
| Submission not accepted | Keeps the draft and privacy choice beside an inline error |

Each selected scenario applies once, so the next attempt can recover normally.
Jump controls also expose first answers and a completed follow-up without
waiting. They use the current conversation when one exists.

“Browse the Agora while you wait” returns to the homepage while the local
simulation continues. A status banner returns to the existing conversation.
Refreshing clears all preview state. There is no persistence, URL question
payload, API request, real publication, or AI generation. Custom text is
displayed using `textContent`; the interface explicitly labels all answers as
fixed sample content, including which follow-up the sample replies illustrate.

Retrying only missing responses and keeping a conversation available while
browsing are proposed interaction behaviors. Production implementation must
map these to durable thread IDs, owner access, actual generation status and
an idempotent recovery path. The current retry API is not implemented or
assumed by this prototype. An unknown network result must be reconciled with
the original submission before creating another thread. Public follow-ups
inherit public visibility; there is no quiet switch to a different audience.

Files: `conversation-study.mjs` generates the view and sample data;
`conversation-controls.js` handles the local journey; `conversation-state.js`
contains its state transitions; `conversation-study.css` extends the chosen
typography and spacing. Reduced motion is respected; controls wrap on small
screens, reading text stays full width, and portraits stay at 28px.

Run `node design-explorations/homepage/verify-conversation.mjs` to check state
ordering, partial-response recovery, inherited privacy/group/context, duplicate
submission guards, and the one-follow-up boundary. These are state checks,
not browser interaction or device visual testing.

## Visual direction

- Light paper: `#faf9f6`; primary text: `#282923`.
- Actual terracotta accent: `#a34e36`; muted text: `#65665d`.
- Lora headlines and excerpts; DM Sans controls and supporting text.
- Small existing portraits, fine rules, and compact reading sections.
- Shared content and tokens make the hierarchy the main comparison variable.

The existing application currently maps its `terracotta` token to green. These
explorations define their own tokens and do not import application styles.
Responsive breakpoints cover small phones, tablets, and larger desktop layouts.

## Interactions and boundaries

- Suggested questions fill and focus the composer.
- Visibility defaults to private and can be switched to public.
- Earlier versions open a local preview with a fixed sample exchange link.
  The latest conversation study uses the journey described above.
- No questions are sent, generated, stored, or placed in URLs. The optional
  `from` query parameter only remembers the originating layout for return links.
  In C’s second iteration, `issue=city-heat` can open the fixed issue context.
- Recent questions, feed reflections and a debate expand in place.
- Native details and dialogs provide keyboard behavior; Escape dismisses dialogs.
- Core reading and navigation work without JavaScript. With JavaScript disabled,
  the form opens the fixed sample exchange instead of the preview dialog. The
  revised briefing’s form opens its fixed response section without JavaScript.
- No authentication, backend, database, production routes, app dependencies,
  or application configuration are involved.

All questions and philosopher responses are illustrative design content; none
were taken from private user submissions. They are not historical quotations.
The current-issue example describes a hypothetical city, not a reported event.
Its background links are genuine:

- [WHO: Heat and health](https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health)
- [IPCC: AR6 Synthesis Report](https://www.ipcc.ch/report/ar6/syr/)

A published briefing would need dated reporting from multiple sources, local
primary evidence and editorial review. That workflow is not implemented here.

## Editing

Edit `build.mjs` for shared content and layouts, `styles.css` for presentation,
and `interactions.js` for the small local interactions. Iteration two’s markup
and styles are in `iteration-two.mjs` and `refinement.css`. Regenerate the fifteen HTML
files after changing `build.mjs`:

```powershell
node design-explorations/homepage/build.mjs
```

The generated HTML is included alongside its source so it can be opened
directly or copied elsewhere without a build step. There are no runtime package
dependencies or remote font requests.

Validation for this delivery covers generation, JavaScript syntax/lint, HTML
structure and local link/asset resolution, stylesheet parsing, and local HTTP
responses. Browser/device visual testing has not been performed.

## Assets

Portraits are copies of the project's existing `public/avatars/*.webp` files.
The Latin Lora and DM Sans font files were copied from the project's existing
Next.js font output. Both are distributed under the SIL Open Font License;
their upstream notices are included in `assets/fonts/*-OFL.txt`.

Upstream font sources:
[Lora](https://github.com/google/fonts/tree/main/ofl/lora) and
[DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans).
