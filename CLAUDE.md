# productino

> AI-assisted **discovery-to-delivery** tool for a software outsourcing / agency shop.
> This file is the product brief — reuse it to give any Claude session the full context.

## The one-liner

Turn a vague client brief into a scoped, costed, well-defined plan. Upload the
initial client briefing; the app builds a plan, finds the gaps, and asks the right
clarifying questions. You take those questions to the client, feed the answers back,
and the app produces a final product definition, then tasks and a roadmap.

## The core insight

This is **not** a "document generator" — ChatGPT can write a nice PRD today. The value is
the AI knowing **what it doesn't know yet**, and forcing the ambiguity out of the briefing
*before* committing to a (often fixed-price) outsourcing deal. In outsourcing, margin dies on
scope creep and misunderstood requirements. A tool that systematically surfaces gaps,
assumptions and risks early is the whole point.

Frame everything around one loop with **confidence gates**:

```
Briefing → Gap Analysis → Questions → Client Answers → (repeat until confident) → Definition → Tasks/Roadmap → Proposal/SOW
              ↑__________________________________________|
                        confidence score rises each round
```

## The pipeline (stages + what each produces)

1. **Intake.** Accept a messy mix: meeting transcripts, a Word doc, an email thread, voice
   notes, a Figma link, a competitor URL. Normalize all of it into one structured
   "understanding" object — not just raw text dumped into a prompt.

2. **Gap analysis (the heart of the product).** Run the briefing against a fixed
   **completeness rubric** — the taxonomy of what a well-defined software project needs:
   - Functional scope (features, user roles, core flows)
   - Non-functional (performance, scale, uptime, security, compliance — GDPR matters, EU)
   - Integrations & external systems
   - Data model & ownership / migration of existing data
   - Platforms & devices
   - Constraints: budget, deadline, fixed-vs-flexible, existing tech they're locked into
   - Stakeholders & decision-makers
   - Success metrics / definition of done
   - Assumptions and explicit out-of-scope

   For each category emit a **confidence / completeness score** and, where low, **targeted
   questions**. This gives a coverage map ("Compliance: 20% — unknown") and tells you *when
   you're done asking*. This measurable convergence is the differentiator.

3. **Questions for the client.** Don't dump 40 questions. Prioritize, group by impact,
   deduplicate, produce a clean **client-facing** doc (hide the internal scoring). For each
   question, propose an **assumed answer** ("We'll assume web-only unless told otherwise") —
   clients confirm assumptions far faster than they answer open questions.

4. **Answer ingestion & re-scoring.** Paste the client's replies back; merge them, raise the
   confidence scores, and either close the loop or generate a *smaller* second round. Each
   round visibly converges — this ratchet is what makes it feel like a tool, not a chatbot.

5. **Final product definition (PRD).** Once confidence clears a threshold, generate the spec:
   scope, user stories with acceptance criteria, non-functionals, explicit **assumptions &
   out-of-scope**, and a **risk register**. The assumptions / out-of-scope / risks sections
   are the contractual armor against "but I thought X was included".

6. **Tasks & roadmap.** Decompose into epics → stories → tasks. Use **ranged** estimates
   (`5–8 days`, not false-precision singles), dependencies, and phasing (MVP vs later).
   If past-project data is stored, calibrate estimates to *this team's* actual velocity.

7. **Proposal / SOW (high ROI bonus).** The same structured data emits a client-facing
   proposal / statement of work with priced phases. Likely where value is felt fastest.

## Domain model (sketch)

```
Client
  └─ Project
       ├─ Briefing (raw sources: files, transcripts, links)
       ├─ Understanding (structured, versioned)
       │    └─ CategoryScores[]   (scope, NFR, compliance, …)
       ├─ QuestionRound[]         (questions → client answers)
       ├─ ProductDefinition       (the PRD, versioned)
       ├─ Risk[] / Assumption[]
       ├─ Epic → Story → Task     (estimates, dependencies)
       └─ Proposal / SOW
   KnowledgeBase (cross-project: reusable patterns, past estimates, the shop's standard stack)
```

`KnowledgeBase` is a sleeper feature: after ~10 projects the tool "knows" how this shop
builds things, what it charges, and which questions always end up mattering — gets smarter
per project.

## Why this beats "just use ChatGPT"

1. The **rubric + confidence scoring** — turns vague chat into a measurable convergence.
2. **Versioned, structured artifacts** — one dataset drives PRD, tasks *and* proposal; no copy-paste drift.
3. **Assumption / risk surfacing** — directly protects margins.
4. **Cross-project memory** — estimates and questions calibrated to the team.
5. **Client-facing vs internal views** — clean question docs out, scoring kept private.

## Architecture notes (for when AI features get built)

- **LLM:** Claude. Opus for heavy reasoning (gap analysis, PRD synthesis); a cheaper/faster
  model for formatting. Use **structured outputs / tool-use** so each stage returns typed
  JSON (scores, questions, tasks), not prose to re-parse. Lean on **prompt caching** — the
  rubric + project context are reused across calls.
- **Don't over-engineer retrieval early.** A single briefing fits in context; skip a vector
  DB until the cross-project KnowledgeBase exists.
- **Export:** generate Markdown first; add Jira/Linear/Notion export once the core loop works.

## MVP cut (build this first)

The thinnest version that proves the value:
**Upload briefing → gap analysis with scores → prioritized questions with assumed-answers →
paste answers → generate PRD.**
Tasks, roadmap, proposals, integrations and the KnowledgeBase are all *additive* afterward.

---

## Current implementation (as built so far)

A monorepo under `code/`, orchestrated by Docker Compose + the `pd` helper script
(modeled on the mind-guard `mg` tooling). The AI pipeline above is **not built yet** — the
foundation is.

- **Backend** (`code/productino-backend`) — NestJS + Prisma + PostgreSQL. Single app module,
  flat folders: `entities/` (active-record, extend `BaseEntity`), `repository/` (generic
  `PrismaRepository<T,…>` + concrete repos), `services/`, and `http/` (`controller/`,
  `request/`, `response/`, `guards/`, `middleware/`, `validators/`, `decorators/`).
- **Auth & permissions** — JWT login; `AuthMiddleware` resolves the user from the bearer
  token, a global `PermissionsGuard` enforces `@RequirePermissions(...)`. Permissions are DB
  rows (`ADMIN`, `VIEW_ONLY`, `RUN_LLM`, `UPDATE_SETTINGS`); ADMIN bypasses all.
- **Models so far** — `User`, `Permission`, `Setting` (key/value store), `Project` (carries
  `briefing` + a `stage` enum: BRIEFING → GAP_ANALYSIS → AWAITING_CLIENT → DEFINITION →
  PLANNING → DELIVERY). `Project` is the worked CRUD example.
- **Frontend** (`code/productino-frontend`) — Nuxt 3 + Vue 3 + Tailwind. Dark, terminal-style
  theme (near-black bg, green `//` mono headers — inspired by bitsquare.ro). Login page with
  a Brief→Deliver animation; admin panel with CRUD grids (view/edit/delete + create) for
  Projects and Settings.
- **nginx** proxies `dev.production.io` (frontend) and `dev-api.production.io` (backend);
  Swagger at `/api/docs`. Run with `./pd start`. See `README.md` for ports, seeded users
  (`admin@productino.local / admin123`, `viewer@productino.local / viewer123`), and commands.

**Next step toward the product:** implement stage 2 (gap analysis) — a `RUN_LLM`-gated
service that scores a `Project.briefing` against the rubric and returns category scores +
clarifying questions via Claude tool-use.
