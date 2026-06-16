# productino

> AI-assisted **discovery-to-delivery** engine for a software outsourcing / agency shop.
> This file is the product brief + roadmap — give it to any Claude session for full context.

## The one-liner

Turn a vague client briefing into a scoped, costed, defensible product definition. Drop in
the brief (a big text blob or a meeting transcript); the app builds a structured picture of
the project, scores how well-defined it is, surfaces what's missing, and produces the exact
questions to ask the client. Feed the answers back; it converges. Once it's confident enough,
it emits the PRD, the tasks/roadmap, and the proposal.

## The core insight

This is **not** a document generator — ChatGPT writes a nice PRD today. The value is the AI
**knowing what it doesn't know yet**, and forcing ambiguity out of the briefing *before* the
agency commits to a (often fixed-price) deal. In outsourcing, margin dies on scope creep and
misunderstood requirements. A tool that systematically surfaces gaps, soft assumptions, and
risks early — and *measures* when you've asked enough — is the whole point.

The product is a **convergence engine**, framed as one loop with a confidence gate:

```
   ┌──────────────── new info can re-enter at ANY stage ────────────────┐
   ↓                                                                     │
Brief → Extract beliefs → Score coverage → (gate: defined enough?) ─no─→ Curate questions
         (status +          (per category +        │ yes                  (rank, dedupe,
          provenance)        rollup score)         ↓                       + proposed default)
                                          Definition → Estimate → Proposal
                                                                     ↑
                                       client answers (free text) ───┘
                                       re-extract → re-score → coverage VISIBLY rises
```

The **gate** (when to stop asking) and the **back-edge** (each round measurably converges)
are what make this a tool, not a chatbot.

---

## The model: a Belief Graph (the source of truth)

The project is **one graph**. But unlike a plain knowledge graph, every node carries an
**epistemic envelope** — *how we know it, how sure we are, and from where* — and the graph
computes a **convergence score**. PRDs, question docs, task lists, and proposals are merely
**views** projected from it; no copy-paste drift.

### Layers (by epistemic role, not a flat list of node types)

```
EVIDENCE         immutable — "what was actually said"
  Source ──< Span                      brief / transcript / email → quoted fragments

UNDERSTANDING    the belief graph — the heart, where convergence happens
  Requirement (kind: goal|feature|rule|nfr|integration-need|data|platform|stakeholder)
  Assumption · Question · Decision · Risk · Conflict
      every node: provenance→Span[], status, confidence, round
  CoverageArea  (rubric category → rollup score)   ← the convergence engine

DELIVERY         DERIVED — only built once Understanding clears the gate
  Epic → Story → Task · Estimate · Dependency · Roadmap
      each links UP to the Requirement(s) that justify it

PRESENTATION     pure views (projections, never authored directly)
  PRD · Client Question Doc · Architecture sketch · Proposal / SOW
```

### The three upgrades that make it a scoping tool (not just an ontology)

1. **Provenance** — every node links to the Span(s) in the source that produced it. Answers
   "*why do we believe this?*" — the defense in a fixed-price scope dispute.
2. **Epistemic status** — `stated | inferred | assumed | confirmed | rejected | contradicted`.
   A transcript's *"we'd probably want…"* becomes an `inferred`, low-confidence belief — never
   silently promoted to a committed feature.
3. **Coverage + gate** — each `CoverageArea` rolls up a confidence score; the project-level
   rollup is the "defined enough?" gate. This is the measurable convergence that is the
   differentiator.

### Node envelope (every Understanding node wears this)

```json
{
  "id": "req-subscriptions",
  "kind": "feature",
  "name": "Subscriptions",
  "description": "Recurring monthly billing",
  "status": "inferred",          // stated|inferred|assumed|confirmed|rejected|contradicted
  "confidence": 0.55,            // 0..1
  "provenance": [
    { "sourceId": "transcript-1", "span": [1840, 1902],
      "quote": "we'll probably need people to pay every month" }
  ],
  "round": 1,                    // which question round this entered/last changed
  "coverageArea": "billing"
}
```

`"probably need"` → `status: inferred`, `confidence: 0.55`. The whole product flows from
keeping soft beliefs visibly soft until the client confirms them.

### CoverageArea (the convergence engine)

```json
{
  "id": "area-compliance",
  "name": "Compliance & Data Protection",
  "weight": "high",              // a compliance gap hurts margin more than a nice-to-have
  "rollupConfidence": 0.2,       // weighted over its requirements/assumptions
  "status": "underdefined",      // underdefined | thin | adequate | solid
  "openQuestions": ["q-gdpr-residency", "q-pii-retention"]
}
```

The fixed **rubric** = the taxonomy of what a buildable software project needs:
functional scope · user roles & personas · core flows · non-functionals (perf, scale,
security, **GDPR/EU compliance**) · integrations & external systems · data model & ownership
/ migration · platforms & devices · constraints (budget, deadline, fixed-vs-flexible, locked
tech) · stakeholders & decision-makers · success metrics / definition of done · explicit
assumptions & out-of-scope.

### Conflict is first-class (graphs hide contradictions unless you model them)

```json
{
  "id": "conflict-tenancy",
  "between": ["assumption-single-tenant", "req-org-switching"],
  "description": "Single-tenant assumed, but org-switching requirement implies multi-tenant",
  "status": "open"               // open | resolved
}
```

---

## The flows (each maps to a stage + an LLM boundary)

The `Project.stage` enum drives the spine:
`BRIEFING → GAP_ANALYSIS → AWAITING_CLIENT → DEFINITION → PLANNING → DELIVERY`
(with the back-edge GAP_ANALYSIS ⇄ AWAITING_CLIENT carrying the convergence loop).

**1. Ingest (BRIEFING).** Store the raw source immutably. One LLM **extraction** call turns
it into Understanding nodes — *with status + confidence + provenance spans*. Not a summary; a
typed, traceable belief set. Output is versioned (round 1).
→ *LLM boundary:* source → nodes[] (tool-use, typed JSON). Cheaper model; it's extraction.

**2. Gap analysis (GAP_ANALYSIS) — the heart.** Score the graph against the rubric: per
`CoverageArea` confidence + evidence + gaps; each gap emits a candidate Question with a
**proposed default answer**. Compute the weighted project rollup → the gate.
→ *LLM boundary:* nodes + rubric → CoverageArea scores + Questions (Opus, tool-use). Cache the
rubric + project context. **This is the screen that sells the product: a coverage map.**

**3. Curate questions → client doc (AWAITING_CLIENT).** Don't dump 40 questions. Rank by
**impact × uncertainty**, group, dedupe; consultant edits/includes/excludes (human-in-loop).
Each question ships its **assumed answer** ("we'll assume web-only unless told otherwise").
Export a clean **client-facing** doc; internal scores stay hidden.

**4. Ingest answers, re-converge (back to GAP_ANALYSIS).** Consultant pastes the client's
free-text reply. LLM **maps answers onto open questions** (out of order, partial, answering
things nobody asked — all normal), folds them into Understanding round *n+1*, re-scores. Show
the **delta** ("Compliance 20% → 75%"). Below threshold → generate a *smaller* round; at/above
→ unlock DEFINITION. Consultant can override the gate (recorded as "proceeding at 78%").

**5. Definition / PRD (DEFINITION).** Project the confident graph into the spec: scope, user
stories + acceptance criteria, NFRs, and — the contractual armor — **explicit assumptions,
out-of-scope, and a risk register**, each traceable to its source span. Versioned, editable,
then locked.

**6. Estimate & plan (PLANNING).** Project Definition → Epic→Story→Task with **ranged**
estimates (`5–8d`, never false-precision singles), dependencies, MVP-vs-later phasing. Later:
calibrate to *this shop's* velocity via cross-project memory.

**7. Proposal / SOW (branches off DEFINITION).** Same dataset → priced, phased client
proposal that reuses assumptions/out-of-scope verbatim. Highest felt value; build after the
loop works.

### Change-impact analysis (the payoff of a graph)

```
New requirement / changed answer → locate node → traverse edges →
  affected Requirements → affected Stories → affected Tasks → triggered Risks →
  estimated scope delta → updated roadmap
```

A flat-document tool can never do this; the belief graph does it by traversal.

---

## Cross-cutting (bake in from day one)

- **Traceability** — every score, question, and PRD line links back to its source span. Cheap
  at extraction, invaluable in disputes.
- **Versioning / rounds** — Understanding is append-and-revert friendly; convergence is
  measured per round so you can always show "what your answers changed."
- **Client outside the system** — in MVP the client never logs in: client-facing artifacts
  are *exports*, answer ingestion is a *paste*. Keeps the build small and matches reality.
- **Client-facing vs internal** — questions/scores have a curation + redaction step; internal
  confidence is never exported.

## LLM architecture

- **Claude.** Opus for heavy reasoning (extraction-with-judgment, gap scoring, PRD synthesis);
  a cheaper/faster model for formatting/redaction. Every stage uses **structured outputs /
  tool-use** → typed JSON (nodes, scores, questions, tasks), never prose to re-parse.
- **Prompt caching** — the rubric + project context are reused across every call in a round.
- **No premature retrieval** — a single briefing fits in context; skip a vector DB until the
  cross-project **KnowledgeBase** (reusable patterns, past estimates, the shop's stack) exists.
- **Single-writer rounds, multi-lens reads** — instead of many agents concurrently mutating the
  graph, specialized *read-only lenses* (compliance, estimation, conflict-detector) **propose**
  changes; one merge step applies them with provenance. Conflicts stay first-class, not races.

---

## Roadmap (phased)

### Phase 0 — Foundation (largely built)
NestJS + Prisma + Postgres; entities/repository/services/http layers; JWT auth + permissions
(`ADMIN`, `VIEW_ONLY`, `RUN_LLM`, `UPDATE_SETTINGS`); `Project` CRUD with the `stage` enum;
Nuxt 3 frontend (dark terminal theme), admin grids; nginx + `pd` helper; Swagger.

### Phase 1 — MVP: the convergence loop (the differentiator)
The thinnest thing that proves the value. **Ingest → extract beliefs → score coverage →
curated questions w/ defaults → paste answers → re-converge → PRD.**
- Belief Graph schema: `Source`/`Span`, Understanding nodes (envelope: status, confidence,
  provenance, round), `CoverageArea`, `Question`, `Assumption`.
- 3 LLM calls (tool-use): **extract**, **score+question**, **synthesize PRD**. Prompt-cached
  rubric. `RUN_LLM`-gated.
- UI: coverage map (the hero screen), question curation + client-doc export, answer paste +
  visible delta, PRD view.
- Re-entry + versioning from the start.

### Phase 2 — Definition hardening
First-class `Risk`, `Decision`, `Conflict` nodes + conflict detection; assumptions/out-of-scope/
risk register as structured PRD sections; gate override with recorded rationale; full
provenance UI ("why do we believe this?" → jump to source span).

### Phase 3 — Delivery layer
DELIVERY projection: Epic→Story→Task, ranged estimates, dependencies, MVP-vs-later phasing;
change-impact traversal view.

### Phase 4 — Proposal / SOW
Priced, phased client proposal projected from Definition; reuses assumptions/out-of-scope
verbatim. Likely the fastest-felt value.

### Phase 5 — Cross-project KnowledgeBase
Reusable patterns, calibrated estimates to *this team's* velocity, "questions that always end
up mattering." Introduce retrieval here, not before. Gets smarter per project.

### Phase 6 — Richer intake & export
File/transcript/Figma/URL ingestion beyond paste; Jira/Linear/Notion export.

---

## Why this beats "just use ChatGPT"

1. **Rubric + coverage scoring + a gate** — measurable convergence, not vibes.
2. **Provenance + epistemic status** — soft beliefs stay soft; every claim is traceable.
3. **One belief graph, many views** — PRD, tasks, and proposal can't drift apart.
4. **Assumption / risk / conflict surfacing** — directly protects margin.
5. **Change-impact by traversal** — impossible for a flat-document tool.
6. **Cross-project memory** — estimates and questions calibrated to the team.

## Principle

> The Belief Graph is the source of truth — and it records not just *what* the project is, but
> *how sure we are* and *why*. PRDs, stories, tasks, estimates, roadmaps, and proposals are
> all **views** over it. The product's job is to raise confidence, round by round, until the
> graph is defined enough to safely commit to a price.

## Current implementation (keep updated as built)

Monorepo under `code/`, orchestrated by Docker Compose + the `pd` helper. Backend
(`code/productino-backend`): NestJS + Prisma + Postgres, flat folders — `entities/`
(active-record, extend `BaseEntity`), `repository/` (`PrismaRepository<T,…>` + concrete repos),
`services/`, `http/` (`controller/`, `request/`, `response/`, `guards/`, `middleware/`,
`validators/`, `decorators/`). Frontend (`code/productino-frontend`): Nuxt 3 + Vue 3 +
Tailwind, dark terminal theme. nginx proxies `dev.production.io` / `dev-api.production.io`;
Swagger at `/api/docs`. Run `./pd start`. Seeded users in `README.md`
(`admin@productino.local / admin123`, `viewer@productino.local / viewer123`).

> The gap-analysis pipeline (Phase 1) is in progress on the `prompt-manager` branch. Update
> this section as the Belief Graph schema and the 3 LLM calls land.
