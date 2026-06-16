# productino — Development Track

> Living progress tracker for the **Belief Graph** build. Update the status markers as work
> lands so any session knows exactly where we are. See `CLAUDE.md` for the product thesis and
> the Belief Graph model.

**Status legend:** ✅ done · 🚧 in progress · ⬜ not started · ⏸ blocked

---

## 📍 Current position

- **Phase:** Phase 1 ✅ complete (verified end-to-end). Next up: Phase 2 — Extraction.
- **Branch:** `prompt-manager`
- **Last updated:** 2026-06-16
- **Next action:** Add `prompts/extract-beliefs.md` + `PromptKey.EXTRACT_BELIEFS` and an
  `ExtractionService` that turns a `Source` into `BeliefNode`s (POST `/projects/:id/extract`).
- **Run things in Docker via `./pd` / `docker compose` (node_modules live in the backend
  container). Dev DB syncs with `prisma db push --accept-data-loss` on backend boot.**
- **Graph endpoint:** `GET /api/projects/:id/graph`. Frontend project detail page renders it.

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

### Phase 2 — Extraction (Ingest → beliefs) ⬜
- [ ] `prompts/extract-beliefs.md` + `PromptKey.EXTRACT_BELIEFS`
- [ ] `ExtractionService` (mirrors old gap-analysis service: render → `LlmService.run` → parse → persist) → `BeliefNode`s with status / confidence / provenance / round
- [ ] `POST /projects/:id/extract` (`RUN_LLM`); log via `PromptManager.recordOutcome`

### Phase 3 — Coverage scoring + questions ⬜
*Gap analysis, reborn normalized — the hero screen's data.*
- [ ] `prompts/score-coverage.md` + `PromptKey.SCORE_COVERAGE`
- [ ] `CoverageService`: nodes + rubric → `CoverageArea` rollups + `Question`s (assumed answers, impact) + weighted **project rollup = the gate**
- [ ] Snapshot a `ProjectRound`
- [ ] `POST /projects/:id/score`

### Phase 4 — The convergence loop ⬜
- [ ] Question curation (include / exclude / edit) endpoints
- [ ] Client-doc markdown export (internal scores hidden)
- [ ] `prompts/map-answers.md` + `PromptKey.MAP_ANSWERS`: paste free-text answers → map to open questions → new round of nodes → re-score
- [ ] Delta vs previous `ProjectRound`

### Phase 5 — Definition / PRD ⬜
- [ ] `prompts/synthesize-prd.md` + `PromptKey.SYNTHESIZE_PRD`
- [ ] `ProductDefinition` (versioned): scope, stories + acceptance criteria, NFRs, assumptions / out-of-scope / risk register
- [ ] Gate check before `DEFINITION`; gate override recorded with rationale

### Phase 6 — Hardening ⬜
- [ ] First-class `Conflict` (+ detection); `Risk` / `Decision` node types in use
- [ ] Provenance UI support ("why do we believe this?" → jump to source span)
- [ ] Gate-override rationale surfaced

### Phase 7+ — Delivery & beyond ⬜
- [ ] Delivery layer: `Epic → Story → Task`, ranged estimates, dependencies, change-impact traversal
- [ ] Proposal / SOW projection
- [ ] Cross-project KnowledgeBase (retrieval introduced here)

---

## Decision log

- **2026-06-16** — Belief nodes modeled as a single polymorphic `BeliefNode` table (not per-type tables, not fine-grained `Claim`).
- **2026-06-16** — `GapAnalysis` JSON-blob model retired in favor of normalized Belief Graph tables; its rubric/question logic salvaged into Phase 3 (`SCORE_COVERAGE`).
- **2026-06-16** — Dev backend command now runs `prisma db push --accept-data-loss` so destructive schema syncs don't crash-loop the container on boot. Prod is unaffected (Dockerfile CMD uses `prisma migrate deploy`).
- **2026-06-16** — ⚠️ Data-loss note: applying the schema dropped the old `briefing` column. The 5 seeded Acme project briefings were restored from `seed.ts`; 2 ad-hoc system-account project briefings (`test`, `les`) were not recoverable. No real data of concern.
