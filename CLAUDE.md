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

The rubric is the taxonomy of what a buildable project must define (functional scope, business
rules, workflow states, roles, data/migration, integrations, admin/back-office needs, reporting,
NFRs, compliance/GDPR, platforms, localization/content, UX/design/accessibility, operations,
acceptance, constraints, stakeholders, success metrics, commercial/change-control boundaries,
assumptions/out-of-scope). It lives in `RubricService` as a default catalog; each project may
store `{ enabled, overrides }` in its `rubric` JSON column (null = full default). Scoring,
extraction and the gate all run against the project's *effective* rubric.

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

- **Phase 2 — Agentic validation loop (critic-actor pattern).** See detailed plan below.
- **Phase 5 — Cross-project KnowledgeBase.** Reusable patterns, estimates calibrated to this
  team's velocity, "questions that always end up mattering." Retrieval is introduced here.
- **Phase 6 — Richer intake & export.** File/transcript/URL ingestion beyond paste;
  Jira/Linear/Notion export. (Change-impact traversal view is still a future nicety.)

---

## Phase 2 — Agentic validation loop

Each pipeline step currently repairs only parse/schema errors (Zod). This phase adds a
semantic validation layer: after a step produces valid JSON, a cheap critic call checks
quality; if it fails, the actor reruns with the critique injected. Loop until pass or
`maxRounds` exceeded.

```
  input
    ↓
  [actor LLM] ──→ Zod parse → semantic validator → pass? ──yes──→ output
       ↑                                  │ no
       └──────── critique + prev output ──┘   (up to maxRounds, default 3)
```

### Step 1 — Generic `runWithValidation` in `StructuredLlmService`

Add a new method alongside the existing `run()`:

```ts
runWithValidation<T>(opts: {
  prompt: string           // rendered prompt for the actor
  schema: ZodSchema<T>
  validate: (output: T) => { pass: boolean; critique: string }
  maxRounds?: number       // default 3
  criticPromptKey?: string // default 'critic' — the src/prompts/critic.md key
}): Promise<{ output: T; rounds: number }>
```

On each failure round, rebuild the actor prompt with an appended block:

```
<previous_attempt>
{{ JSON.stringify(prevOutput, null, 2) }}
</previous_attempt>
<critique>
{{ critique }}
</critique>
Revise your output to address the critique. Return the same JSON schema.
```

Log each critic call as its own prompt run row (so token costs are visible). Add a
`validationRounds` column to the prompt run log to surface which steps consistently need
retries (a prompt-quality signal).

### Step 2 — `src/prompts/critic.md`

Generic critic prompt — takes `{step, criteria, input_summary, output_json}` and returns:

```json
{ "pass": boolean, "critique": string }
```

`criteria` is injected per-step (see Step 3). The critic must be concise and actionable —
one sentence per failing criterion, no praise. Keep this prompt short and provider-neutral.

### Step 3 — Per-step semantic validators

Each validator is a pure function `(output: T) => { pass: boolean; critique: string }`.
Implement as a static method on the relevant service or in a `validators/` file under `llm/`.

**`extract-beliefs`**
- Every `STATED` node has at least one non-empty entry in `sourceSpans`
- No `INFERRED` node has `confidence > 0.7`
- At least 3 belief nodes extracted total
- No node has an empty `description`
- No `ASSUMPTION` node has `confidence > 0.5`

**`score-coverage`**
- Every rubric area from the effective rubric appears in the output
- Any area with `score < 0.4` has at least one question
- Every question has a non-empty `assumedDefault`
- No duplicate questions (same intent, different wording)

**`map-answers`**
- Every open question ID from the input is present in the output (answered or explicitly
  flagged as unanswered with a reason)
- Each mapped answer references a valid question ID

**`detect-conflicts`**
- Each conflict references exactly two belief IDs that exist in the current belief graph
- No conflict has an empty `description`

**`synthesize-prd`**
- Out-of-scope section is non-empty
- Risk register references at least one `RISK`-type belief ID
- All `REQUIREMENT` beliefs with `confidence >= 0.7` are reflected somewhere in the PRD

**`estimate-epic`**
- Every task has `minDays > 0` and `maxDays >= minDays`
- No task has identical min and max (forces ranged thinking)
- Epic total `maxDays` ≤ 30 (flag outliers — likely a decomposition problem, not an
  estimate problem)

### Step 4 — Wire into pipeline services

Replace bare `structuredLlm.run(...)` calls in each pipeline service with
`structuredLlm.runWithValidation(...)`, passing the corresponding validator.

Affected services (in execution order):
1. `ExtractBeliefsService`
2. `ScoreCoverageService`
3. `MapAnswersService`
4. `DetectConflictsService`
5. `SynthesisPrdService`
6. `GenerateEpicPlanService` (per-epic)
7. `EstimateEpicService` (per-epic)

`SynthesisProposalService` is deterministic prose + numbers — skip validation loop there.

### Step 5 — Settings & observability

- Add `maxValidationRounds` (default 3) to `Settings` so tenants can tune cost vs quality.
- The prompt run log already tracks `tokensIn`/`tokensOut` — critic calls add rows with
  `promptKey = 'critic'` so per-step cost is visible in the prompts admin page.
- If a step exits the loop without passing, log a warning and persist the best attempt
  (last output), flagging the run as `validationFailed: true`. Do not block the pipeline —
  degrade gracefully.

### Out of scope for Phase 2

- Multi-agent parallelism (each step still runs sequentially in the pipeline)
- Tool-use / function-calling for the critic (plain JSON is fine)
- Storing per-round diffs in the DB (the final output is what matters)

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
