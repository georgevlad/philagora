# Admin UX review — 25 September 2026

> Baseline review. The findings below describe the interface before the rebuild. Implementation and desktop-browser verification followed in this session; see [implementation notes](2026-09-25-admin-ux-implementation.md).

## Scope and recommendation

Desktop administration only. The objective is faster editorial work: finding an item, reading it fully, making a correction, deciding its status, and moving to the next item with context intact.

**Recommendation: rebuild the admin interaction patterns around an editorial workspace.** Keep Philagora's warm surfaces and restrained green accent, but use desktop space, readable controls, compact lists, persistent actions, and dedicated editors. This needs more than a visual restyle; it does not require replacing the application stack.

This first pass is grounded in the current repository. Chrome successfully opened the local admin, but it requires sign-in. Authenticated page inspection and keyboard checks remain pending. Consequently, layout consequences below are code-backed assessments, not measured browser results. An attempt to open a separate production review tab was blocked by automatic approval review; no production admin page was inspected.

No application code, content, configuration, or database was changed. No generation, publishing, or deletion was performed.

## Highest-priority findings

### 1. Posts cannot support a complete editorial review

**Evidence:** `src/app/admin/posts/page.tsx` truncates content to approximately 200 characters. The card exposes Approve/Publish, Archive, and Delete, but has no full-content expansion or content editor. The source citation appears in two places. Engagement counts and decorative metadata consume space alongside operational controls. The PATCH handler in `src/app/api/admin/posts/route.ts` updates status only.

**Effect:** the editor can promote a draft without reading its complete body, and cannot correct a sentence from the main Posts workspace. A cosmetic table conversion alone would preserve this gap.

**Change:** make Posts the central review workspace. Use a compact list/table with selection, philosopher, thesis/excerpt, type, status, and date. Selecting an item opens a substantial adjacent panel with its full text, citation, reply context, editable fields, and visible actions. Add Previous/Next and an optional public-card preview. Keep table position and filters when changing items.

**Implementation dependency:** a validated content-edit operation is needed in addition to the existing status endpoint. Define draft edits and published edits deliberately; saving an edit must not publish a draft as a side effect.

### 2. Bulk publishing is global inside a filtered workspace

**Evidence:** Posts renders “Publish all approved” alongside philosopher, status, tag, and category filters. Its request sends only `from_status` and `to_status`; `src/app/api/admin/posts/bulk/route.ts` updates every matching status in the database.

**Effect:** “all” can be mistaken for all visible or filtered records. The confirmation mentions public visibility but does not list the affected selection or explain that the other filters do not apply.

**Change:** selected-record actions should be the default. Show “Publish 6 selected posts,” explain scope before confirmation, and distinguish “select this page” from “select all matching results.” Put any global publishing command in a separate explicit action. Preserve selection on failure and report completed versus failed items.

### 3. The shell leaves desktop space unused and navigation grows too tall

**Evidence:** `src/app/admin/layout.tsx` uses a 224px sidebar and a centered `max-w-5xl` content wrapper. The sidebar has 19 destinations with generous vertical padding and is not implemented as a viewport-height, independently scrolling navigation region. Daily adds another padded wrapper inside the shell.

**Effect:** wide monitors do not translate into more useful table or editor space. Navigation competes vertically with page content. Extra nested padding makes a complex workflow narrower still.

**Change:** use a desktop shell with a persistent 216–240px sidebar, compact navigation rows, a clearly visible page header, and a flexible full-width workspace. Constrain reading width inside the editor, not the entire admin. Give the sidebar independent overflow and put infrequent settings in a grouped section.

### 4. Creation, queues, configuration, and history compete on the same pages

**Evidence:** Daily renders candidate selection, all generation settings, and review results in one long page. Debate and Agora render the existing-item list above the active workshop/new-item form. Generate places setup, prompt inspection, preview, and logs vertically. Templates stacks active instructions, a new-version editor, and version history.

**Effect:** each list's growth pushes the actual work farther away. The same task requires moving between several visually unrelated surfaces.

**Change:** separate queue/list views from item workspaces. Give debates and Agora their own detail URLs and a stable step navigation. Give Daily clear Select sources → Configure → Generate → Review stages with a persistent plan summary. Use tabs or adjacent panels for editing, preview, and history instead of long stacked sections.

### 5. Work can lose context when leaving a page or switching records

**Evidence:** Daily keeps review items and batch summary in component state. The generated posts may persist, but that review context is not reloaded as a saved run. Templates replaces editor text when a different section loads; Prompts clears new prompt text when selecting another philosopher. These paths do not expose a dirty-state guard. Several asynchronous selection/generation concerns were also documented in the September 16 code review.

**Effect:** the administrator must remember which drafts belong together, whether an edit was saved, and what an in-flight result belongs to. Refreshing is not a reliable way to regain confidence.

**Change:** show Saved/Unsaved changes in a persistent action area; retain edits or confirm discarding them on record changes. Bind generation previews to the immutable source/philosopher/configuration that produced them. Persist run identity and checkpoints so Daily can resume its review context.

**Boundary:** durable generation/resume is backend work. A new stepper or progress animation cannot provide that guarantee. Existing debate/Agora resume functions should be retained and improved, not described as wholly absent.

### 6. Long forms lack a consistent editing and saving model

**Evidence:** philosopher detail saves from the end of a multi-section form. Scoring and AI Models have independent section-level saves. Templates uses version creation and separate activation actions. Labels frequently use 10–11px uppercase monospace text, and many visible `<label>` elements are not explicitly connected to their inputs.

**Effect:** the user has to learn whether a page saves everything, a section, or a new inactive version. Save controls move out of view while editing. Small labels and repeated explanatory text slow scanning.

**Change:** establish two intentional patterns: one entity editor with one persistent Save changes bar; or independent settings sections with clearly named, locally scoped Save actions. Show dirty state and save results at the relevant scope. Use readable sentence-case labels, associated inputs, field-level errors, explicit required/optional states, and consistent 36–40px controls. Keep long text editors wide and vertically resizable; place advanced fields in disclosure sections.

### 7. Modal and drawer behavior is hand-built and inconsistent

**Evidence:** Add Philosopher uses a narrow `max-w-lg`, whole-dialog scrolling overlay that closes on backdrop click or Escape. Reopening resets the form. It does not declare dialog semantics or implement a focus trap/restoration. News Scout's Glint modal does declare dialog semantics; its reaction-generation drawer uses a separate implementation. Destructive confirmations alternate between inline replacement buttons and native browser confirmation dialogs.

**Effect:** editors encounter different focus, dismissal, sizing, and action placement rules. An accidental close can discard a partially filled philosopher form.

**Change:** share one dialog/drawer foundation with appropriate semantics, initial focus, focus containment, focus restoration, dirty-close handling, and persistent header/footer. Use small dialogs for confirmations and short forms, wide drawers for quick inspection, and full pages for long profile/prompt/workshop editing. Avoid forcing every form into a modal.

### 8. Finding and returning to work needs consistent list behavior

**Evidence:** Posts already preserves filters and pagination in the URL, which is a useful existing pattern. News Scout initializes its filters locally; the Dashboard's “Approved, No Posts” link includes `?tab=approved`, but News Scout does not read that query parameter. Posts has filters but no text search. Many other admin collections use cards or tables with different discovery controls.

**Effect:** direct links can open a different state than their label promises, and administrators cannot consistently search, refresh, bookmark, or return to a queue.

**Change:** fix the Dashboard-to-News-Scout filter handoff. Standardize URL-backed search/filter/sort/page/selected-item state where appropriate. Provide result counts, empty-state recovery, a compact filter bar, persistent table headers, and selection actions. Retain the existing Posts URL behavior when rebuilding it.

## Proposed information architecture

Keep destinations recognizable while grouping them by the work being done:

| Group | Destinations | Purpose |
| --- | --- | --- |
| Editorial | Overview, News Scout, Daily Planner, Posts, Live Feed | Find sources, generate drafts, review and publish |
| Conversations | Debates, Agora | Open existing work or create a new workshop |
| Library | Philosophers, Scenarios, Today in History | Maintain reusable content and personas |
| Settings | Persona prompts, Content templates, House rules, Scoring, Mood palettes, AI models, Sources | Configure generation and ingestion; expose subsections within Settings |
| Operations | Users, API logs, Database/export tools | Account and operational administration |

Do not put every settings subsection permanently into the main sidebar. House rules deserves a visible place in the settings navigation rather than being discoverable only after entering Templates. Prompts should also be reachable from the relevant philosopher editor.

The Overview should emphasize actionable queues, recent failures, and work in progress. Preserve the existing useful counts. Move the large database/export block to Operations or a smaller utility area.

## Desktop layout direction

The core Posts workspace should have four stable regions:

1. Compact navigation with the current group and page clearly identified.
2. Page header with title, record count, and one primary action.
3. List toolbar and compact table; selection actions appear only when needed.
4. Adjacent review editor with full content, context, and persistent Save/Approve/Publish controls appropriate to the item's state.

At narrower desktop widths, use a wide review drawer; at larger widths, keep list and editor visible side by side. Design for common laptop and desktop widths, including 1280, 1440, and 1920px. Mobile layout is outside this review's scope.

Use warm neutral page backgrounds, clear white/light editor surfaces, dark readable text, and the existing restrained green accent. Use the UI sans-serif for forms and tables. Reserve serif typography for the identity, content preview, and limited headings. Replace repeated emoji navigation with a consistent restrained icon set. Reduce nested bordered cards, pill buttons, letter spacing, and decorative badges. Density should come from layout and spacing, not smaller text.

## Implementation order

| Phase | Deliverable | Observable success |
| --- | --- | --- |
| 1 | Shared shell, buttons, fields, table toolbar, status badges, dialogs, and save feedback; rebuilt Posts workspace | Read a whole draft, edit it, save it, approve/publish intentionally, and move to the next item without losing queue context |
| 2 | News Scout queue/detail pattern and correct filter links | Open an approved queue from Overview, inspect a source, prepare generation, and return to the same queue |
| 3 | Daily workflow stages and saved run/review state | Reload or navigate away and recover the correct batch, drafts, and completed/failed items |
| 4 | Debate/Agora list-detail workspaces and common entity/settings forms | Open a specific workshop directly; resume its current step; edit long records with visible save state |

Do not rebuild every screen at once. The first Posts slice should establish and validate the patterns used by the rest of the admin. Retain existing APIs where their contracts fit; extend them deliberately for content edits, selection-scoped actions, and durable runs.

## Verification still required

Authenticated desktop browser review should verify actual viewport use, navigation reachability, table density, long-form scrolling, filter persistence, modal focus/dismissal, and switching among records. Use existing content for inspection and unsaved temporary text for form checks. Review generation/publishing behavior through code or isolated test data unless explicitly authorized to create or publish content.

For implementation, add focused behavioral coverage for selection scope, full-draft access, dirty-state protection, stale response handling, and run restoration. A screenshot-only comparison is insufficient for these changes.
