# productino — Development Track

> Living progress tracker for the **Belief Graph** build. Update the status markers as work
> lands so any session knows exactly where we are. See `CLAUDE.md` for the product thesis and
> the Belief Graph model.

**Status legend:** ✅ done · 🚧 in progress · ⬜ not started · ⏸ blocked

---

## 📍 Current position

- **Phase:** Phases 6, 7, and 8 (Proposal/SOW) ✅ complete (verified live). The full discovery→delivery→proposal pipeline is built. Remaining: KnowledgeBase + change-impact traversal.
- **Post-pipeline enhancements landed** (see *Cross-cutting enhancements*): per-project token usage, a backend readability pass, and **auto-cascade reset** (+ `RESET_PROJECT` permission).
- **Branch:** `prompt-manager`
- **Last updated:** 2026-06-16
- **Next action:** (optional / lower priority) cross-project **KnowledgeBase** (calibrate
  estimates to team actuals, reusable questions; introduce retrieval here) and task
  **dependencies + change-impact traversal**. Also worth: point an account at a stronger
  model (Claude) — output granularity is currently capped by Qwen.
- **Pricing settings** (account-scoped, with fallbacks): `default_currency` (EUR), `day_rate`
  (600), `estimation_buffer_pct` (20). Costs are computed deterministically in `ProposalService`.
- **Confidence gate** for PRD generation = `DEFINITION_GATE` 0.7 in `definition.service.ts`.
- **⚠️ Keep prompts within the smallest provider cap** — Qwen rejects `maxTokens` > 8192 (cap 8000).
- **⚠️ Qwen returns weak/degenerate nested JSON** (echoes keys, e.g. `"stories":"stories"`).
  Always normalize structured output defensively (see `DeliveryService.normalizeEpics`,
  `DefinitionService` list coercion). A stronger model yields finer structure.
- **Run things in Docker via `./pd` / `docker compose` (node_modules live in the backend
  container). Dev DB syncs with `prisma db push --accept-data-loss` on backend boot. After
  backend edits, file-watch over the bind mount is flaky — `docker compose restart backend`
  for a guaranteed clean recompile.**
- **Endpoints:** `GET /api/projects/:id/graph`, `POST /api/projects/:id/extract` (RUN_LLM),
  `POST /api/projects/:id/score` (RUN_LLM).
- **⚠️ Prompts are provider-agnostic** — LLM routes to the account's configured model (qwen/
  openai/deepseek/anthropic), not necessarily Claude. No `model:` in prompt frontmatter.

---

## Foundation already in place (keep — the Belief Graph reuses all of it)

- ✅ `Account` (tenant root / "company"), `bringYourOwnAi`, `isSystem`
- ✅ `Client` (agency customer, account-scoped)
- ✅ `User` / `Permission` (SUPER_ADMIN, ADMIN, VIEW_ONLY, RUN_LLM, UPDATE_SETTINGS, MANAGE_PROMPTS), `Setting`
- ✅ **LLM module** (`src/llm/`) — `LlmService.run(accountId, req)`, adapters: anthropic / openai / deepseek / qwen, BYO-vs-system resolution, structured-output passthrough
- ✅ **Prompt manager** — file-based markdown prompts → immutable `PromptVersion` (checksum), Handlebars render, `PromptRun` logging, `PromptExperiment` scaffold, `prompt.service` admin views, `PromptKey` enum
- ✅ **AI models + catalog** — `AiModel` CRUD (masked keys, one active/account, test-connection), `ai-catalog.ts` + `AI_MODEL_CATALOG` setting

## To remove

- ⬜ `GapAnalysis` feature — entity, `gap-analysis.service.ts`, `gap-analysis.controller.ts`, response DTOs, repo, `prompts/gap-analysis.md`, `PromptKey.GAP_ANALYSIS`, `Project.gapAnalyses` relation. (Fully isolated — nothing else depends on it. Its rubric + assumed-answer logic is salvaged into Phase 3.)

## To change

- ⬜ `Project` — keep `{ id, accountId, clientId, name, stage }`; `briefing` migrates into a `Source(kind=BRIEFING, round=1)`. `stage` enum unchanged: `BRIEFING → GAP_ANALYSIS → AWAITING_CLIENT → DEFINITION → PLANNING → DELIVERY`.

---

## Schema decisions (locked)

- **Belief nodes = one polymorphic `BeliefNode` table** with a `nodeType` discriminator + shared
  epistemic envelope + Json `extra` for per-type fields. `CoverageArea` and `Question` are
  separate tables. `Risk`/`Decision`/`Conflict` ride in later as `nodeType` values / `extra`
  shapes — no new tables for the first two.

```
KEEP   Account · Client · User · Permission · Setting · AiModel
       Prompt · PromptVersion · PromptRun · PromptExperiment

ADD    Source        projectId, kind(BRIEFING|TRANSCRIPT|EMAIL|ANSWERS), content, round
       BeliefNode    projectId, nodeType(REQUIREMENT|ASSUMPTION|RISK|DECISION),
                     kind(feature|goal|rule|nfr|integration|data|platform|stakeholder),
                     name, description,
                     status(STATED|INFERRED|ASSUMED|CONFIRMED|REJECTED|CONTRADICTED),
                     confidence(Float), coverageKey, provenance(Json), round(Int),
                     extra(Json), createdAt, updatedAt
       CoverageArea  projectId, key, name, weight, rollupConfidence, status, round
       Question      projectId, coverageKey, text, assumedAnswer, impact,
                     status(OPEN|INCLUDED|EXCLUDED|ANSWERED), answerText, round
       ProjectRound  projectId, index, rollupConfidence   (snapshots → delta display)

LATER  Conflict · ProductDefinition · Epic/Story/Task · Proposal
```

New prompt keys (same file-based manager): `EXTRACT_BELIEFS`, `SCORE_COVERAGE`, `MAP_ANSWERS`,
`SYNTHESIZE_PRD`.

---

## Phases

### Phase 1 — Reshape the data model ✅
*The data layer + a read-only graph view. No new LLM behavior.*
- [x] Remove the `GapAnalysis` feature end-to-end (entity, service, controller, DTOs, repo, prompt file, `PromptKey.GAP_ANALYSIS`, `Project.gapAnalyses`; orphan prompt row deleted)
- [x] Add entities + Prisma models: `Source`, `BeliefNode`, `CoverageArea`, `Question`, `ProjectRound` (active-record `BaseEntity` pattern; concrete repos; registered in `app.module.ts`)
- [x] Migration: `Project.briefing` → `Source(kind=BRIEFING, round=1)`; `briefing` column dropped. `Project.briefing` is now a derived getter; `ProjectService` upserts the BRIEFING source on create/update
- [x] Read-only endpoint: `GET /projects/:projectId/graph` (`ProjectGraphController` + `BeliefGraphService` + `BeliefGraphResponse`)
- [x] Update `seed.ts` (seed a BRIEFING `Source` per demo project instead of a `briefing` column)
- [x] **Frontend**: project detail page (`pages/projects/[id].vue`) gap-analysis UI replaced with a Belief Graph viewer (sources + coverage + beliefs + questions; empty-Understanding state until Phase 2)
- [x] Verified end-to-end: API (`/graph`, briefing read/upsert) + SSR-rendered page

### Phase 2 — Extraction (Ingest → beliefs) ✅
- [x] `prompts/extract-beliefs.md` + `PromptKey.EXTRACT_BELIEFS` (provider-agnostic; no hardcoded model)
- [x] Shared rubric `src/common/rubric.ts` (RUBRIC + keys + prompt list) — reused by Phase 3
- [x] `ExtractionService` (render → `LlmService.run` → tolerant JSON parse → persist) → `BeliefNode`s with nodeType/kind/status/confidence/provenance/round; idempotent per round (deletes + re-inserts that round); CONFIRMED downgraded; coverageKey validated; provenance span located in source; advances BRIEFING→GAP_ANALYSIS
- [x] `POST /projects/:id/extract` (`RUN_LLM`) on `ProjectGraphController`; returns refreshed graph; logs via `PromptManager.recordOutcome`
- [x] **Frontend**: "Extract beliefs / Re-extract" button (RUN_LLM-gated) on the project detail page; swaps in the returned graph
- [x] Verified live end-to-end: ran on `qwen-max`, produced 4 well-formed nodes (STATED/INFERRED/ASSUMED, graded confidence, located provenance spans)

### Phase 3 — Coverage scoring + questions ✅
*Gap analysis, reborn normalized — the hero screen's data.*
- [x] `prompts/score-coverage.md` + `PromptKey.SCORE_COVERAGE` (provider-agnostic)
- [x] `CoverageService`: nodes (grouped by area) + rubric → LLM judges per-area `rollupConfidence` + `summary`; service derives `CoverageStatus`, upserts all 11 `CoverageArea`s, and computes the weighted **project rollup = the gate** (`WEIGHT_VALUE` high/med/low = 3/2/1 in `rubric.ts`)
- [x] `Question`s regenerated each run (assumed answers + impact; preserves `ANSWERED`)
- [x] Snapshot a `ProjectRound` (index = prior count + 1, carries the rollup)
- [x] `POST /projects/:id/score` (`RUN_LLM`) on `ProjectGraphController`; returns refreshed graph
- [x] **Frontend**: "Score coverage / Re-score" button; coverage bars + questions render (Phase-1 template already handled the shape)
- [x] Verified live: rollup 0.13 on a thin briefing, 11 areas with derived status, 10 prioritized questions (HIGH compliance/budget/timeline) with assumed answers; round 1 snapshotted

### Phase 4 — The convergence loop ✅
- [x] Question curation: `PATCH /projects/:id/questions/:qid` (status include/exclude/edit) — `QuestionService`
- [x] Client-doc markdown export: `GET /projects/:id/questions/doc` (included or all-open; no internal scores) — `QuestionsDocResponse`
- [x] `prompts/map-answers.md` + `PromptKey.MAP_ANSWERS`; `AnswerService.ingest`: map free-text reply → mark questions ANSWERED → store ANSWERS `Source` (round n+1) → re-extract (nodes forced `CONFIRMED`) → re-score → new `ProjectRound`
- [x] `POST /projects/:id/answers` (`RUN_LLM`) on `ProjectGraphController`; returns refreshed graph
- [x] **Frontend**: rounds delta ("13% → 55%"), per-question include/exclude curation, "Export for client" modal (copy), "Submit client answers" textarea
- [x] Verified live (qwen, ~27s for 3 calls): 0.13 → 0.55, 8 CONFIRMED beliefs, 5 questions answered, data/integrations/compliance/constraints → SOLID, fresh question round for the remaining gap (`non_functional`)

### Phase 5 — Definition / PRD ✅
- [x] `prompts/synthesize-prd.md` + `PromptKey.SYNTHESIZE_PRD` (maxTokens 8000 — provider cap)
- [x] `ProductDefinition` model/entity/repo (versioned; `content` JSON, `confidenceAtGeneration`, `gateOverride`, `overrideReason`) + Prisma push
- [x] `DefinitionService.generate`: projects graph (coverage + beliefs + answered Q&A) → PRD JSON (summary, in/out scope, user stories + acceptance criteria, NFRs, assumptions, risk register); advances stage → `DEFINITION`
- [x] Confidence gate (`DEFINITION_GATE` 0.7): below it returns 422 `{ gate, rollupConfidence, threshold }`; `override` (+reason) recorded on the definition
- [x] `GET` (latest) + `POST` (generate) `/projects/:id/definition` — `DefinitionController`
- [x] **Frontend**: Product Definition section (summary, scope, stories+AC, NFRs, assumptions, risks); Generate/Regenerate with gate-override confirm dialog; "gate overridden" badge
- [x] Verified live: gate 422 at 55%, then override → PRD v1 (5 in-scope, 6 out-of-scope, stories+AC, 3 risks), stage → DEFINITION

### Phase 6 — Hardening ✅
- [x] First-class `Conflict` model + `detect-conflicts` prompt + `ConflictService` (detect + resolve/reopen); self-contained (stores belief names, survives re-extraction); `POST /projects/:id/conflicts`, `PATCH …/conflicts/:id`; included in the graph response
- [x] `Risk` / `Decision` node types surfaced — nodeType badge on each belief (colored)
- [x] Provenance UI — belief nodes show their supporting quotes ("why we believe this")
- [x] Gate-override rationale surfaced on the PRD (reason shown under the "gate overridden" badge)
- [x] **Frontend**: conflicts collapsible (detect/resolve), nodeType badges, provenance quotes, override reason
- [x] Verified live: detection returns 0 on non-contradictory beliefs (correct); all UI renders
- [ ] (deferred) jump-from-quote-to-source-span highlight — quotes shown, scroll/highlight not wired

### Phase 7 — Delivery layer ✅
- [x] `DeliveryItem` model (single polymorphic table, self-parent, `level` EPIC/STORY/TASK) + Prisma push
- [x] `DeliveryService`: PRD → epics/stories/tasks, ranged day estimates, MVP/Phase 2/Later phase; story/epic/project totals rolled up on read; advances stage → `PLANNING`
- [x] **Split generation** (weak-model-friendly): `generate-epics` (flat list) then `generate-epic-plan` per epic (stories+tasks, 2 levels, scoped), epics planned in parallel; a failed epic plan is skipped, not fatal. Replaced the single deep `generate-tasks` call. Richer output on Qwen (6 epics, multiple stories/tasks vs 1 flat epic before)
- [x] `GET` (tree) + `POST` (generate) `/projects/:id/delivery` — `DeliveryController`
- [x] **Frontend**: Delivery Plan section — project total estimate, per-epic collapsibles, stories + tasks with phase chips and ranged estimates; Generate/Regenerate
- [x] Verified live on a rich PRD (project 11): 17–26 days, 4 epics with estimates + MVP phase, rollups correct

### Phase 8 — Proposal/SOW ✅
- [x] `Proposal` model (versioned; `content` JSON + `currency`/`dayRate`/`totalLowCost`/`totalHighCost`) + Prisma push; `day_rate` seed setting
- [x] **Deterministic pricing**: `ProposalService` groups delivery tasks by phase (MVP/Phase 2/Later), sums day ranges, applies `estimation_buffer_pct`, × `day_rate` → costs (never model-invented). Reuses PRD assumptions/out-of-scope.
- [x] `synthesize-proposal` prompt writes prose only (intro/per-phase narrative/closing); merged by phase name; a failed prose call still yields a fully-priced proposal
- [x] `GET` (latest) + `GET doc` (client-facing markdown) + `POST` (generate) `/projects/:id/proposal` — `ProposalController`
- [x] **Frontend**: Proposal section — investment headline (cost + day range + rate + buffer), per-phase collapsibles (days + cost + scope + narrative), assumptions/out-of-scope, closing; Generate/Regenerate + Export (reuses the copy modal, now titled dynamically)
- [x] Verified live (project 11): 28–41 days, EUR 16,800–24,600 (= buffered 23–34d × €600), prose + assumptions/out-of-scope, clean markdown export

### Phase 9 — KnowledgeBase + change-impact (optional, later) ⬜
- [ ] Cross-project KnowledgeBase (calibrated estimates, reusable questions; retrieval introduced here)
- [ ] Task dependencies + change-impact traversal

---

## Cross-cutting enhancements (post-pipeline)

### Per-project token usage ✅
- [x] Aggregated from `prompt_runs` (every LLM call already logs `subjectType:'project'` + `subjectId` + tokens) — no counter, no migration. `PromptRunRepository.tokenUsageForSubject` / `tokenUsageByPromptForSubject`; `ProjectService.tokenUsage`; `GET /projects/:id/usage` → `ProjectUsageResponse` (totals + per-stage breakdown). Fixed proposal-prose call to log its tokens. Frontend: a collapsible "// token usage" card (auto-refreshes after LLM actions).

### Readability pass ✅
- [x] Renamed cryptic AI-style locals across services / responses / common (e.g. `s`→`trimmed`, `obj`→`parsed`, single-letter callback params → domain nouns, `str/int/list/parse`→`toText/toInt/toStringList/parseJsonObject`). Public method names, Prisma/DTO fields, and LLM JSON keys untouched. Verified by `tsc`.

### Auto-cascade reset ✅
- [x] `PipelineResetService`: re-running a step clears everything **downstream** of it (`afterExtraction`/`afterScoring`/`afterDefinition`/`afterDelivery`, wired into the step services). `ProjectRound` ledger and answered questions are preserved by auto-cascade.
- [x] Manual reset: `POST /projects/:id/reset` `{ from: graph|definition|delivery|proposal }` — cascades downstream; `graph` wipes the whole Understanding layer + downstream but **keeps sources** and resets stage to `BRIEFING`. Gated by the new **`RESET_PROJECT`** permission (added to `PermissionKey`, `ALL_PERMISSIONS`, seed; ADMIN/SUPER_ADMIN bypass).
- [x] Frontend: red **Reset** button per main section (gated by `canReset`), danger confirm, refetches downstream after cascades.
- [x] Verified live: re-score cleared the PRD but kept the 4-round ledger; `reset graph` → 0 nodes/0 rounds, sources kept, stage `BRIEFING`.

---

### LLM hardening (validation + repair + robustness) ✅
- [x] **`StructuredLlmService`** (`src/llm/structured-llm.service.ts`) — single path for all structured model calls: render → run → tolerant JSON extract (`json-extract.ts`) → Zod validate → bounded **repair loop** (feeds bad output + errors back, ≤2 retries) → record. Migrated all 7 pipeline services onto it; deleted their bespoke parse/normalize helpers.
- [x] **Zod schemas** (`src/llm/schemas/`) — one per prompt; normalization is declarative (enum.catch, confidence clamp, list-coercion, coverageKey validation, epic-plan nesting rescue). Content-bearing schemas **reject emptiness** so degenerate output triggers repair.
- [x] **Timeout + transient retry/backoff** in `BaseLlmAdapter.postJson` (AbortController; 429/5xx/network, honors `Retry-After`); `LlmProviderError` carries `status`/`retryable`.
- [x] **Provider capability table** (`provider-capabilities.ts`) — clamps `maxTokens` to provider cap (removed the hardcoded Qwen 8000) and enables JSON mode where supported.
- [x] **Truncation detection** — `finishReason` threaded through adapters → result; repair prompt + clear error on `length`.
- [x] **Failure observability** — `PromptRun.meta` now stores `rawPreview` + `attempts` + `finishReason` on failure (verified: failed run shows attempts=3 + rawPreview).
- [x] **Concurrency** — `KeyedMutex` per-project lock on mutating endpoints (`PipelineLockService`) + `pLimit(3)` on delivery's epic fan-out.
- [x] **Injection hygiene** — shared system preamble: untrusted SOURCE/answers are data, not instructions.
- [x] Verified live (Qwen): repair lifted delivery from **1/6 → 5/6 epics with tasks** (14–22d → 51–71d).
- [x] **Provider structured output (capability-gated)** — `provider-capabilities.ts` exposes `structuredOutput: 'tool' | 'json' | 'none'`. Anthropic uses **tool-use** (the per-prompt JSON Schemas in `schemas/json-schemas.ts` become a forced `tool_choice` tool; the `tool_use` block is read back as the value). OpenAI-family/Qwen use JSON mode. `StructuredLlmService` attaches `req.responseSchema` only for `'tool'` providers; everyone still falls back to the Zod **repair loop**.
- [x] **Anthropic prompt caching** — system/rubric block sent with `cache_control: ephemeral` + the `anthropic-beta: prompt-caching-2024-07-31` header, so the reused rubric/context across a round isn't re-billed.
- [x] **Gemini provider** — `gemini.adapter.ts` (`generateContent`, `systemInstruction`, `responseMimeType: application/json`, `x-goog-api-key`), registered in `LlmModule`/`LlmService`; added to `provider-capabilities`, `DEFAULT_MODEL_CATALOG`, `seed.ts` `MODEL_CATALOG`, and the live `AI_MODEL_CATALOG` setting (selectable in the admin dropdown).
- [x] Verified: `tsc` clean, backend boots with all 5 adapters (0 DI errors), Qwen extract still 201 (no regression from removing `options.response_format`). Anthropic/Gemini paths need a real key to exercise end-to-end (not run out-of-band, per memory).
- [ ] (deferred) eval fixtures / test runner (none configured).

### Semantic validation (anti-hallucination) ✅
Structure-valid ≠ true. This layer verifies model output against the source/graph (deterministic,
no extra LLM call) and folds failures into the existing repair loop.
- [x] **Generic `validate` hook** on `StructuredLlmService.run` — runs after the Zod parse; `ok:false` (with attempts left) drives the same repair loop, and `metrics` are recorded under `PromptRun.meta.semantic` either way. Keeps the runner generic; the *meaning* lives in each caller's closure.
- [x] **`GraphValidationService`** (`src/services/graph-validation.service.ts`, no LLM) — `locateQuote` (exact → whitespace-tolerant regex with a real span → token-overlap fuzzy → none), `gradeBeliefs` (grounding rate + ungrounded names), `resolveBeliefRefs` (exact → normalized → Jaccard-fuzzy onto real node names).
- [x] **P0 grounding** (`extraction.service.ts`) — replaced the silent `indexOf` provenance with grounding: found quotes store `{grounded, match, span}`; an **ungrounded** quote downgrades the belief (`status→ASSUMED`, `confidence≤0.4`, `grounded:false`) and the repair loop re-asks for verbatim quotes. `Provenance` gained `grounded?`/`match?` (JSON column, no migration).
- [x] **P0 answer loop** (`answer.service.ts`) — only beliefs **grounded in the client reply** are promoted to `CONFIRMED`; ungrounded/unsourced ones stay soft. Stops a hallucinated belief from becoming a committed answer.
- [x] **P1 conflicts** (`conflict.service.ts`) — `beliefA`/`beliefB` resolved against real node names; conflicts referencing a non-existent belief are repaired then **dropped**; survivors normalized to canonical names. `meta.semantic.droppedConflicts`.
- [x] **P1 answer mapping** (`answer.service.ts`) — invented `questionId`s counted in `meta.semantic.invalidQuestionRefs` (repair only on a total miss; the persist step already drops unknown ids).
- [x] **P2 status↔confidence cap** (`pipeline-schemas.ts`) — declarative: `ASSUMED≤0.4`, `INFERRED≤0.7`, `STATED≤0.95`, so inflated confidence can't game the gate.
- [x] **P2 estimate ceiling** (`delivery.service.ts`) — a single task clamps at `MAX_TASK_DAYS=60` (low≤high swap was already there) so a runaway estimate can't distort the proposal price.
- [x] Verified live (Qwen): `extract` → `meta.semantic = {graded:16, grounded:16, groundingRate:1}`; 14 quotes matched via the whitespace-tolerant tier (those would have had **no span** under the old `indexOf`). Validator unit-checked: exact/normalized→real spans, fuzzy→no span, fabricated quote→`none` (downgrade), invented belief name→`unknown` (dropped).
- [ ] (deferred — P3) PRD/proposal faithfulness critic (extra LLM call), frontend "evidence health" indicator.

## Decision log

- **2026-06-17** — Delivery estimates were inflated ~3–5× because `generate-epic-plan` sized configuration work like greenfield custom dev and padded each task — then the proposal's 20% buffer double-counted that padding. Fixed at the **prompt level only** (`prompts/generate-epic-plan.md`): nominal senior-team effort, no per-task contingency (buffer is applied once downstream), and explicit configuration-vs-custom sizing (platform config ≈1–2d; multi-day reserved for genuine custom dev / integrations / migration). No code/schema change. Result on project 12: grand total 415–759d → **193–324d**, MVP 306–558d → **169–283d**, with task **count preserved** (124 vs 152) — i.e. we shrank per-task days, not decomposition. Deliberately NOT done: budget-capacity capping, an estimation-calibration LLM pass, or reducing task count.

- **2026-06-16** — Belief nodes modeled as a single polymorphic `BeliefNode` table (not per-type tables, not fine-grained `Claim`).
- **2026-06-16** — `GapAnalysis` JSON-blob model retired in favor of normalized Belief Graph tables; its rubric/question logic salvaged into Phase 3 (`SCORE_COVERAGE`).
- **2026-06-16** — Dev backend command now runs `prisma db push --accept-data-loss` so destructive schema syncs don't crash-loop the container on boot. Prod is unaffected (Dockerfile CMD uses `prisma migrate deploy`).
- **2026-06-16** — ⚠️ Data-loss note: applying the schema dropped the old `briefing` column. The 5 seeded Acme project briefings were restored from `seed.ts`; 2 ad-hoc system-account project briefings (`test`, `les`) were not recoverable. No real data of concern.
- **2026-06-16** — Prompts/LLM code kept provider-agnostic (no `model:` in prompt frontmatter; tolerant JSON parsing). The account's `AiModel` decides the provider; verified an extraction running on `qwen-max`, not Claude. See memory `prompts-are-provider-agnostic`.
- **2026-06-16** — Qwen caps `max_tokens` at 8192 → prompt `maxTokens` ≤ 8000 (provider-agnostic bound). PRD list fields can come back as a string not an array; normalized in `DefinitionService` + guarded with `asList()` in the frontend (a string in `v-for` rendered char-by-char). Apply the same defensive coercion to any future structured-output list fields.
- **2026-06-16** — `Conflict` modelled self-contained (stores belief names, not FK refs to nodes) so it renders after re-extraction churns node ids; conflicts are derived (re-detect replaces the set).
- **2026-06-16** — Qwen produces degenerate deeply-nested JSON (echoes keys like `"stories":"stories"`, or `-1`). `DeliveryService.normalizeEpics` rescues it (epic-level estimates → tasks), so plans still come out estimated though flatter. Finer epic/story/task granularity needs a stronger model. Always normalize multi-level structured output.
- **2026-06-16** — Reset is **auto-cascade**: re-running a step clears everything downstream (chosen over stale-flagging). The `ProjectRound` ledger and answered questions are append-only and survive auto-cascade; only an explicit `graph` reset wipes them. Sources (raw evidence) are always kept; token usage is never reset (billing/audit fact). Reset gated by a dedicated `RESET_PROJECT` permission.
- **2026-06-16** — Per-project token usage is computed by aggregating `prompt_runs` (subjectType/subjectId), not a denormalized counter on `Project` — accurate, no drift, free per-stage breakdown.
- **2026-06-16** — LLM responses validated with Zod (normalization is declarative) + a bounded **repair loop** instead of strict provider structured-output, because the active provider (Qwen) has no strict JSON-schema support; repair is provider-agnostic and is what actually runs. Content-bearing schemas reject emptiness so degenerate output retries rather than silently flattening (the old Qwen failure mode).
- **2026-06-16** — Strict structured output is layered on top of (not instead of) the repair loop, gated by `provider-capabilities.structuredOutput`: Anthropic = forced **tool-use** (JSON Schema as the tool's `input_schema`), OpenAI-family/Qwen = JSON mode, others = none. The Zod repair loop still runs for every provider, so a model that ignores or lacks structured output is still corrected. Anthropic also gets **prompt caching** (`cache_control` on the system block) to avoid re-billing the reused rubric within a round. Hand-authored JSON Schemas live in `schemas/json-schemas.ts` (separate from the Zod schemas) because Anthropic's `input_schema` is plain JSON Schema, not Zod.
- **2026-06-16** — Semantic (content) validation is layered on top of structural (Zod) validation via a generic `validate` hook on `StructuredLlmService`, not a separate pass: a content failure feeds the **same repair loop** as a schema failure, and metrics land in `PromptRun.meta.semantic`. The deterministic checks (`GraphValidationService`) use the immutable Source + existing graph as an oracle — no second LLM call. Ungrounded beliefs are **downgraded + flagged** (status→ASSUMED, confidence≤0.4, `provenance.grounded=false`), not dropped, so they stay visible/auditable but can't inflate the gate (user decision). Quote matching is tiered exact→whitespace-normalized(real span)→fuzzy(no span)→none; the normalized tier already recovers spans the old `indexOf` silently lost.
- **2026-06-16** — Added **Gemini** as a provider (`gemini.adapter.ts`, providers `gemini`/`google`). Registered everywhere a provider must be listed: capability table, `DEFAULT_MODEL_CATALOG`, `seed.ts` `MODEL_CATALOG`, and the live `AI_MODEL_CATALOG` system-account setting (the latter is seeded with `update: {}`, so adding a provider requires editing the DB row, not just re-seeding — done via a one-off script).
