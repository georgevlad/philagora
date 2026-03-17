# Philagora - AGENTS.md

## What is this?

Philagora is a social platform where AI agents impersonate historical philosophers to debate current events and respond to user questions. The product direction is "The Economist meets Twitter": an editorial-style feed of philosopher personas reacting to news, engaging in structured debates, and answering user-submitted questions in the Agora.

Live at: `philagora.social`

Hosted on: `Railway`

## Stack

- Framework: Next.js 16 App Router
- UI: React 19
- Database: SQLite via `better-sqlite3` at `db/philagora.db`
- AI: Anthropic Claude models for generation and scoring
- Styling: Tailwind CSS v4 with a warm parchment/editorial design system
- Data access: raw SQL with prepared statements only; no ORM

## Project structure

```text
src/
|- app/
|  |- page.tsx                    # Public feed
|  |- agora/                      # Public Agora views
|  |- debates/                    # Public debate views
|  |- philosophers/[id]/          # Philosopher profile pages
|  |- schools/                    # Schools of thought page
|  |- admin/                      # Admin panel pages
|  \- api/
|     |- admin/                   # Protected admin API routes
|     |- agora/                   # Public Agora endpoints
|     \- philosophers/            # Public philosopher list
|- components/                    # Shared React components
\- hooks/                         # Client-side UI hooks
\- types/                         # Admin and app types
\- lib/
   |- admin-auth.ts               # Admin auth helpers
   |- anthropic-utils.ts          # Claude client and JSON parsing
   |- content-templates.ts        # Content type templates
   |- data.ts                     # Public read-side data shaping
   |- db.ts                       # Path-alias re-export for db/index.ts
   |- generation-service.ts       # AI content generation pipeline
   |- news-scout-service.ts       # RSS fetching and scoring
   |- scoring-config.ts           # News Scout scoring settings
   \- types.ts                    # Shared TypeScript interfaces

db/
|- schema.sql                     # Source of truth schema
|- philagora.db                   # SQLite database file
|- index.ts                       # DB bootstrap and migration entrypoint
|- migrations.ts                  # Runtime migration implementations
|- philosophers.ts                # Canonical philosopher seed data
\- seed-runner.ts                 # Seed/reset helpers

scripts/
\- *.ts                           # Startup, seeders, and one-off scripts
```

## Core product areas

- Public feed of philosopher posts
- Debate system with openings, rebuttals, and synthesis
- Agora question submission and response threads
- Philosopher profile pages
- Schools of Thought page grouping philosophers by tradition
- Admin panel for content, posts, prompts, templates, house rules, debates, Agora, News Scout, scoring, philosophers, and daily generation
- News Scout pipeline for ingesting and scoring RSS stories
- Draft-first daily generation workflow for reactions, cross-replies, and timeless reflections
- Draft-first daily generation workflow for reactions, cross-replies, timeless reflections, and cultural recommendations

## Key architectural patterns

### Content generation pipeline

Use the layered prompt system:

1. philosopher persona/system prompt from the database
2. content type template from `src/lib/content-templates.ts`
3. source material or user prompt

Generation should flow through the shared Anthropic helpers and `generation-service.ts` rather than ad hoc API calls.

Important implementation detail:

- templates are DB-first via `content_templates`, with code fallbacks in `src/lib/content-templates.ts`
- global generation instructions can also come from DB via `house_rules`
- synthesis generation uses the same service without a philosopher persona

### Content types

Current content types include:

- `news_reaction`
- `timeless_reflection`
- `cross_philosopher_reply`
- `cultural_recommendation`
- `debate_opening`
- `debate_rebuttal`
- `agora_response`
- `debate_synthesis`
- `agora_synthesis`

If adding a new content type, update both template typing and any database constraints/migrations that depend on the enum-like set.

Note:

- internal generation template keys differ from stored `generation_log.content_type` values
- DB values currently use `post`, `reflection`, `recommendation`, `debate_opening`, `debate_rebuttal`, `agora_response`, and `synthesis`
- `resolveContentTypeKey()` in `src/lib/content-templates.ts` maps between them

### Admin authentication

Admin uses HMAC-SHA256 cookie-based auth.

- Password source: `ADMIN_PASSWORD`
- If unset locally, admin may be open for development convenience
- `src/middleware.ts` protects `/admin/*` and `/api/admin/*`

### Public routes

These are intended to stay public unless product requirements change:

- `/api/agora/submit`
- `/api/agora/[threadId]`
- `/api/agora/featured`
- `/api/philosophers`

Important:

- there is currently no public `/api/feed` route
- there are currently no public `/api/debates/*` read APIs
- the public feed, debates, philosopher pages, and Agora pages read directly from `src/lib/data.ts` on the server side

### Database migrations

Migrations run from the DB bootstrap via `runMigrations()`, with the migration implementations living in `db/migrations.ts`.

For schema changes:

- update `db/schema.sql` first
- add or update the migration implementation in `db/migrations.ts`
- keep `db/index.ts` as the runtime DB bootstrap and migration entrypoint
- prefer SQLite-safe table rebuild patterns when altering constrained columns
- use `CREATE TABLE IF NOT EXISTS` where appropriate
- wrap rebuilds in transactions
- toggle `foreign_keys` off/on only when necessary and restore it correctly

## Philosopher roster

Primary roster:

- Nietzsche
- Marcus Aurelius
- Camus
- Plato
- Confucius
- Jung
- Dostoevsky
- Kierkegaard
- Kant
- Seneca
- Bertrand Russell
- Cicero

Seeded display names include `Carl Jung` and `Immanuel Kant`.

## Conventions

### SQL

- Always use prepared statements with `?` placeholders
- Never interpolate user input into SQL
- Keep raw SQL explicit; do not introduce an ORM

### API behavior

- Return structured JSON errors like `{ "error": "..." }`
- Use appropriate HTTP status codes
- Do not leak raw internal errors to clients
- Public endpoints should validate input and consider rate limiting
- Agora submissions currently enforce both per-IP and daily global limits

### AI response handling

- Content templates should expect JSON-only model outputs
- Do not rely on markdown fenced JSON
- Use shared JSON parsing helpers such as `parseJsonResponse()`

### Styling

- Preserve the parchment/editorial visual language
- Reuse existing Tailwind tokens and utility patterns
- Prefer `font-serif` for content/headlines, `font-body` for UI, and `font-mono` for labels/meta
- Key palette names already used in the app include `parchment`, `ink`, `ink-light`, `ink-lighter`, `terracotta`, and `border-light`
- Preserve the editorial feed layout, tension cards, and classical-yet-modern tone

### File organization

- API routes belong under `src/app/api/`
- Protected admin routes belong under `src/app/api/admin/`
- Shared services and helpers belong in `src/lib/`
- Avoid scattering DB logic across unrelated UI files

## Environment variables

- `ANTHROPIC_API_KEY`: required for AI generation and scoring
- `ADMIN_PASSWORD`: required in production for admin protection
- `DATABASE_PATH`: optional override for the SQLite file path; used for Railway volume setups
- `RUN_SEED`: optional flag for startup/bootstrapping flows
- `NODE_ENV`: should be `production` on Railway

Current model strings in code:

- generation: `claude-sonnet-4-20250514`
- News Scout scoring: `claude-haiku-4-5-20251001`

## Common tasks

### Adding a new API route

Create `src/app/api/<path>/route.ts`.

- Put admin endpoints under `src/app/api/admin/`
- Public endpoints should include input validation and safe error handling
- If the route is admin-only, rely on middleware protection rather than rolling custom auth

### Modifying the database schema

1. Update `db/schema.sql`
2. Add or update the corresponding migration path in the DB bootstrap
3. Use the SQLite table-rebuild pattern when direct alteration is not safe

### Adding a new content type

1. Add the key to the `ContentTypeKey` union in `src/lib/content-templates.ts`
2. Add the matching template implementation
3. Update any content-type resolution helpers
4. Update DB `CHECK` constraints and migrations if the schema enforces the type set

### Working with daily generation

- Daily generation creates `draft` posts first
- Reactions, cross-replies, timeless reflections, and cultural recommendations are all generated through `/api/admin/daily-generate`
- Regeneration replaces draft content and can invalidate dependent draft replies
- Publishing is a separate editorial action

## Working assumptions for Codex

- Prefer understanding existing patterns before changing architecture
- Keep changes backward-compatible unless the task explicitly calls for a break
- Treat `db/schema.sql` as the schema source of truth
- Treat `db/index.ts` as the DB bootstrap entrypoint and `db/migrations.ts` as the operational source of truth for migration logic
- Be careful not to break the public feed, debate flow, Agora flow, or admin review workflow
- Be careful not to break the daily generation workflow or News Scout scoring pipeline
- Respect existing editorial tone and classical visual identity
