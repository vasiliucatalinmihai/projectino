# productino

> AI-assisted **discovery-to-delivery** engine for a software outsourcing / agency shop.
> This file is the product brief + current state — hand it to any session for full context.

## The one-liner

Turn a vague client briefing into a scoped, costed, defensible product definition. Drop in
the brief (a text blob or a meeting transcript); the app builds a structured picture of the
project, scores how well-defined it is, surfaces what's missing, and produces the exact
questions to ask the client. Paste the answers back; it converges. Once confident enough, it
emits the PRD, the delivery plan, and the priced proposal.

## The core insight

This is **not** a document generator — ChatGPT writes a nice PRD today. The value is the AI
**knowing what it doesn't know yet**, and forcing ambiguity out of the briefing *before* the
agency commits to a (often fixed-price) deal. Margin dies on scope creep; a tool that
systematically surfaces gaps, soft assumptions and risks early — and *measures* when you've
asked enough — is the whole point.

It's a **convergence engine**: one loop with a confidence gate.

```
   ┌──────────────── new info can re-enter at ANY stage ────────────────┐
   ↓                                                                     │
Brief → Extract beliefs → Score coverage → (gate: defined enough?) ─no─→ Curate questions
         (status +          (per category +        │ yes                  (rank, dedupe,
          provenance)        rollup score)         ↓                       + proposed default)
                                          Definition → Plan → Proposal
                                                                     ↑
                                       client answers (free text) ───┘
                                       re-extract → re-score → coverage VISIBLY rises
```

The **gate** (when to stop asking) and the **back-edge** (each round measurably converges)
are what make this a tool, not a chatbot.

## The model: a Belief Graph (the source of truth)

The project is **one graph**. Every node carries an **epistemic envelope** — *how we know it,
how sure we are, from where* — and the graph computes a **convergence score**. PRDs, question
docs, plans and proposals are **views** projected from it; no copy-paste drift.

```
EVIDENCE       immutable — "what was actually said"
  Source ──< quoted spans                brief / transcript / answers
UNDERSTANDING  the belief graph — where convergence happens
  BeliefNode (REQUIREMENT|ASSUMPTION|RISK|DECISION; kind: feature|goal|rule|nfr|…)
  Question · Conflict · every node: provenance, status, confidence, round
  CoverageArea (rubric category → rollup score)   ← the convergence engine
DELIVERY       DERIVED — built once Understanding clears the gate
  Epic → Story → Task (ranged estimates, MVP/Phase 2/Later phasing)
PRESENTATION   pure views: PRD · Client question doc · Delivery plan · Proposal / SOW
```

Three upgrades make it a scoping tool, not just an ontology:

1. **Provenance** — every node links to the source span(s) that produced it ("why do we
   believe this?"); extraction grades quotes and downgrades ungrounded ones to `ASSUMED`.
2. **Epistemic status** — `stated | inferred | assumed | confirmed | rejected | contradicted`.
   A transcript's *"we'd probably want…"* becomes an `inferred`, low-confidence belief.
   `confidence` is capped by status so a soft default can't inflate the gate.
3. **Coverage + gate** — each `CoverageArea` rolls up a weighted confidence; the project-level
   rollup is the "defined enough?" gate (default threshold 0.70, overridable with rationale).

**Conflicts are first-class** — contradictions between beliefs are detected and tracked
(`open | resolved`) rather than hidden.

## Stages & the LLM pipeline

`Project.stage`: `BRIEFING → GAP_ANALYSIS ⇄ AWAITING_CLIENT → DEFINITION → PLANNING → PROPOSAL`.
Each generate step sets its stage and clears everything downstream (so re-running upstream
regresses the stage); the GAP_ANALYSIS ⇄ AWAITING_CLIENT back-edge carries the convergence loop.

Every LLM call uses structured output (typed JSON, validated by a Zod schema with a bounded
repair loop). Prompts live as `.md` files in `src/prompts/` (frontmatter + body), are synced
into the DB as versioned rows, and accrue run stats. Implemented calls:

- `extract-beliefs` — source → typed belief nodes with status/confidence/provenance.
- `score-coverage` — beliefs + rubric → per-area scores + ranked questions (each with an
  assumed-answer default).
- `map-answers` — client reply → answers mapped onto open questions (folded into round n+1).
- `detect-conflicts` — contradictions between beliefs.
- `synthesize-prd` — confident graph → PRD (scope, stories, NFRs, assumptions, out-of-scope,
  risk register).
- `generate-epics` then per-epic `generate-epic-plan` (decompose, no numbers) + `estimate-epic`
  (size all of an epic's tasks together — separate estimation call improves consistency).
- `synthesize-proposal` — prose only; phases/days/costs computed deterministically from the
  plan (day-rate + buffer from Settings), never hallucinated.

The PRD, client question doc, delivery plan and proposal each export to markdown.

## The rubric (per-project)

The rubric is the taxonomy of what a buildable project must define (functional scope, roles,
data/migration, integrations, NFRs, compliance/GDPR, platforms, localization, operations,
acceptance, constraints, stakeholders, success metrics, assumptions/out-of-scope). It lives in
`RubricService` as a default catalog; each project may store `{ enabled, overrides }` in its
`rubric` JSON column (null = full default). Scoring, extraction and the gate all run against the
project's *effective* rubric.

## LLM architecture (provider-agnostic)

- **Bring-your-own-AI.** Calls route to the account's configured model, resolved by
  `LlmConfigResolverService` — provider may be **anthropic / openai / deepseek / qwen / gemini**
  (or the system-default model when BYO is off). Keep prompts and parsing provider-neutral.
- **Structured outputs everywhere** — Anthropic uses strict tool-use; others use native JSON
  mode; the Zod schemas + repair loop are the universal fallback.
- **Per-model usage** — `AiModel` carries lifetime `runCount`/`tokensIn`/`tokensOut`, bumped on
  each successful call; per-project token usage is also summed from logged prompt runs.
- **No premature retrieval** — a single briefing fits in context; no vector DB until the
  cross-project KnowledgeBase exists.

## Cross-cutting

- **Multi-tenant.** Accounts (tenants) + a platform/system account. Super admins cross
  accounts and **impersonate** a tenant (mints a token for that account's admin). Permissions:
  `SUPER_ADMIN, ADMIN, VIEW_ONLY, RUN_LLM, UPDATE_SETTINGS, MANAGE_PROMPTS, RESET_PROJECT`.
- **Client outside the system.** The client never logs in: client-facing artifacts are
  exports, answer ingestion is a paste.
- **Versioning / rounds.** Convergence is measured per round so you can show "what your answers
  changed"; pipeline-reset cascades staleness when an upstream step re-runs.

## Roadmap

- **Phase 5 — Cross-project KnowledgeBase.** Reusable patterns, estimates calibrated to this
  team's velocity, "questions that always end up mattering." Retrieval is introduced here.
- **Phase 6 — Richer intake & export.** File/transcript/URL ingestion beyond paste;
  Jira/Linear/Notion export. (Change-impact traversal view is still a future nicety.)

## Current implementation

Monorepo under `code/`, orchestrated by Docker Compose + the `./pd` helper (`./pd start`,
`./pd exec <svc> …`, `./pd build`, `./pd logs`). Run dev commands inside containers via `pd`.

- **Backend** (`code/productino-backend`): NestJS + Prisma + Postgres, flat folders —
  `entities/` (active-record, extend `BaseEntity`), `repository/` (`PrismaRepository<T,…>` +
  concrete repos), `services/`, `llm/` (adapters per provider, resolver, `StructuredLlmService`,
  Zod `schemas/`), `prompts/` (`.md`), `http/` (`controller/`, `request/`, `response/`,
  `guards/`, `middleware/`, `decorators/`). Swagger at `/api/docs`.
- **Frontend** (`code/productino-frontend`): Nuxt 3 + Vue 3 + Tailwind, dark terminal theme.
  Project page is the cockpit (pipeline rail + next-step + rubric + a stage deck switching the
  belief graph / definition / delivery / proposal sections). Other pages: dashboard, accounts,
  clients, projects, users, ai-models, prompts, settings, account.
- **DB workflow:** `prisma db push` (no migration files). After a schema change:
  `./pd exec backend yarn prisma:push`. Seed: `yarn seed`. Seeded users in `README.md`
  (`super@productino.local` super admin, `admin@productino.local / admin123`,
  `viewer@productino.local / viewer123`).
- nginx proxies `dev.production.io` / `dev-api.production.io`; staging uses
  `docker-compose.staging.yml` (Let's Encrypt via acme.sh into `docker/nginx/certs`).

> The Belief Graph is the source of truth — *what* the project is, *how sure* we are, and
> *why*. PRDs, plans, estimates and proposals are views over it. The product's job is to raise
> confidence, round by round, until the graph is safe to price.
