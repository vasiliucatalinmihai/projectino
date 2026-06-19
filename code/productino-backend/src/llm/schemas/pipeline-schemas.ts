import { z } from 'zod';

/**
 * Zod schemas for every prompt's output. Validation AND normalization live here
 * (declaratively), replacing the hand-rolled clamp/coerce/Set logic that used to
 * be scattered across the services. A schema parse failure feeds the repair loop
 * in StructuredLlmService.
 */

// -- helpers ----------------------------------------------------------

const toText = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Coerce to a trimmed string (never throws). */
const str = z.preprocess(toText, z.string());

/** Uppercase then match an enum, falling back to a default. */
const upperEnum = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess((v) => toText(v).toUpperCase(), z.enum(values).catch(fallback));

/** 0–1 confidence; tolerates a 0–100 scale and junk. */
const confidence01 = z.preprocess((v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  const scaled = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, Math.round(scaled * 100) / 100));
}, z.number());

/**
 * A rubric coverage key: a lowercased, trimmed slug, or null. Kept rubric-agnostic
 * (no fixed key set) since the effective rubric is now per-project — the prompt is
 * given the project's enabled keys, and any unknown key degrades to "uncategorized"
 * when beliefs are grouped downstream.
 */
const coverageKey = z.preprocess((v) => {
  const k = (typeof v === 'string' ? v : '').toLowerCase().trim();
  return k || null;
}, z.string().nullable());

/** Coerce to string[]; a single string is split on lines/bullets/semicolons or wrapped. */
const stringList = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map(toText).map((s) => s.trim()).filter(Boolean);
  const t = toText(v).trim();
  if (!t) return [];
  const parts = t
    .split(/\n+|[;•]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [t];
}, z.array(z.string()));

const intOrNull = z.preprocess((v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}, z.number().nullable());

const arr = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(item));

const NODE_TYPES = ['REQUIREMENT', 'ASSUMPTION', 'RISK', 'DECISION'] as const;
const STATUSES = ['STATED', 'INFERRED', 'ASSUMED', 'CONFIRMED', 'REJECTED', 'CONTRADICTED'] as const;

/**
 * A belief can't claim more certainty than its epistemic status allows — an
 * ASSUMED default at 0.95 is incoherent and would silently inflate the gate.
 * Mirrors the guidance in the extract-beliefs prompt. (CONFIRMED is set only by
 * the answer loop, never by extraction, so it isn't capped here.)
 */
const STATUS_CONFIDENCE_CAP: Record<string, number> = {
  ASSUMED: 0.4,
  INFERRED: 0.7,
  STATED: 0.95,
};
const KINDS = ['feature', 'goal', 'rule', 'nfr', 'integration', 'data', 'platform', 'stakeholder'] as const;
const IMPACTS = ['HIGH', 'MEDIUM', 'LOW'] as const;
const SEVERITIES = ['high', 'medium', 'low'] as const;

// -- extract-beliefs -----------------------------------------------------------

export const ExtractBeliefsSchema = z
  .object({
    beliefs: arr(
      z
        .object({
          nodeType: upperEnum(NODE_TYPES, 'REQUIREMENT'),
          kind: z.preprocess((v) => {
            const k = toText(v).toLowerCase().trim();
            return (KINDS as readonly string[]).includes(k) ? k : 'feature';
          }, z.enum(KINDS)),
          name: str,
          description: str,
          // The model must never assert CONFIRMED; downgrade to STATED.
          status: z.preprocess((v) => {
            const u = toText(v).toUpperCase();
            return u === 'CONFIRMED' ? 'STATED' : u;
          }, z.enum(STATUSES).catch('INFERRED')),
          confidence: confidence01,
          coverageKey,
          quote: str,
        })
        .loose(),
    ).catch([]),
  })
  .transform((o) => ({
    beliefs: o.beliefs
      .filter((b) => b.name.trim().length > 0)
      .map((b) => ({
        ...b,
        description: b.description.trim() || null,
        confidence: Math.min(b.confidence, STATUS_CONFIDENCE_CAP[b.status] ?? 1),
      })),
  }))
  // Empty usually means a degenerate response — reject so the repair loop retries.
  .refine((o) => o.beliefs.length > 0, { message: 'expected at least one belief' });
export type ExtractBeliefsResult = z.infer<typeof ExtractBeliefsSchema>;

// -- score-coverage -------------------------------------------------------------

export const ScoreCoverageSchema = z.object({
  areas: arr(
    z
      .object({ key: str, rollupConfidence: confidence01, summary: str })
      .loose(),
  ).catch([]),
  questions: arr(
    z
      .object({
        coverageKey,
        text: str,
        assumedAnswer: str,
        impact: upperEnum(IMPACTS, 'MEDIUM'),
      })
      .loose(),
  )
    .catch([])
    .transform((qs) => qs.filter((q) => q.text.trim().length > 0)),
}).refine((o) => o.areas.length > 0, { message: 'expected at least one coverage area' });
export type ScoreCoverageResult = z.infer<typeof ScoreCoverageSchema>;

// -- map-answers ----------------------------------------------------------------

export const MapAnswersSchema = z
  .object({
    mapped: arr(
      z
        .object({
          questionId: z.preprocess((v) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.round(n) : -1;
          }, z.number()),
          answer: str,
        })
        .loose(),
    ).catch([]),
    notes: str,
  })
  .transform((o) => ({
    mapped: o.mapped.filter((m) => m.questionId > 0 && m.answer.trim().length > 0),
    notes: o.notes,
  }));
export type MapAnswersResult = z.infer<typeof MapAnswersSchema>;

// -- synthesize-prd --------------------------------------------------------------

export const SynthesizePrdSchema = z
  .object({
    summary: str,
    in_scope: stringList,
    out_of_scope: stringList,
    non_functional: stringList,
    assumptions: stringList,
    user_stories: arr(
      z.object({ role: str, story: str, acceptance_criteria: stringList }).loose(),
    )
      .catch([])
      .transform((us) => us.filter((u) => u.story.trim().length > 0)),
    risks: arr(
      z
        .object({
          description: str,
          severity: upperEnum(['HIGH', 'MEDIUM', 'LOW'], 'MEDIUM'),
          mitigation: str,
        })
        .loose(),
    )
      .catch([])
      .transform((rs) =>
        rs
          .filter((r) => r.description.trim().length > 0)
          .map((r) => ({ ...r, severity: r.severity.toLowerCase() as (typeof SEVERITIES)[number] })),
      ),
  })
  .refine((o) => o.summary.trim().length > 0, { message: 'summary is required' });
export type SynthesizePrdResult = z.infer<typeof SynthesizePrdSchema>;

// -- detect-conflicts ------------------------------------------------------------

export const DetectConflictsSchema = z
  .object({
    conflicts: arr(
      z.object({ beliefA: str, beliefB: str, summary: str, detail: str }).loose(),
    ).catch([]),
  })
  .transform((o) => ({
    conflicts: o.conflicts
      .filter((c) => c.beliefA.trim() && c.beliefB.trim() && c.detail.trim())
      .map((c) => ({ ...c, summary: c.summary.trim() || 'Conflict' })),
  }));
export type DetectConflictsResult = z.infer<typeof DetectConflictsSchema>;

// -- generate-epics --------------------------------------------------------------

export const GenerateEpicsSchema = z
  .object({
    epics: arr(z.object({ title: str, description: str }).loose()).catch([]),
  })
  .transform((o) => ({ epics: o.epics.filter((e) => e.title.trim().length > 0) }))
  .refine((o) => o.epics.length > 0, { message: 'expected at least one epic' });
export type GenerateEpicsResult = z.infer<typeof GenerateEpicsSchema>;

// -- generate-epic-plan (decomposition only — no estimates; tolerant of weak nesting) --

const RawTask = z.object({ title: str, description: str, phase: str }).loose();

export const GenerateEpicPlanSchema = z
  // Both optional: a well-formed reply nests tasks under stories and omits a
  // top-level `tasks` key (zod v4 treats a bare z.unknown() as a required key).
  .object({ stories: z.unknown().optional(), tasks: z.unknown().optional() })
  .loose()
  .transform((o) => {
    let stories: any[] = Array.isArray(o.stories) ? o.stories : [];
    // Some models put tasks directly under the epic with no stories.
    if (!stories.length && Array.isArray(o.tasks)) stories = [{ title: 'General', tasks: o.tasks }];
    const normStories = stories.map((s: any) => {
      let tasks: any[] = Array.isArray(s?.tasks) ? s.tasks : [];
      // A bare "story" with a title but no tasks is really a single leaf task.
      if (!tasks.length && toText(s?.title).trim()) tasks = [s];
      return {
        title: toText(s?.title),
        description: toText(s?.description),
        tasks: tasks.map((t) => RawTask.parse(t)),
      };
    });
    return { stories: normStories };
  })
  // Require real tasks so a degenerate/empty plan triggers a repair retry.
  .refine((o) => o.stories.some((s) => s.tasks.length > 0), {
    message: 'expected at least one story with tasks',
  });
export type GenerateEpicPlanResult = z.infer<typeof GenerateEpicPlanSchema>;

// -- estimate-epic (per-task ranges, keyed back by index) --------------------------

export const EstimateEpicSchema = z
  .object({
    estimates: arr(
      z
        .object({
          index: z.preprocess((v) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.round(n) : -1;
          }, z.number()),
          estimateLow: intOrNull,
          estimateHigh: intOrNull,
        })
        .loose(),
    ).catch([]),
  })
  .transform((o) => ({ estimates: o.estimates.filter((e) => e.index >= 0) }))
  // Empty usually means a degenerate response — reject so the repair loop retries.
  .refine((o) => o.estimates.length > 0, { message: 'expected at least one estimate' });
export type EstimateEpicResult = z.infer<typeof EstimateEpicSchema>;

// -- synthesize-proposal (prose only) ----─────────────────────────────────────────

export const SynthesizeProposalSchema = z.object({
  intro: str,
  closing: str,
  phases: arr(z.object({ name: str, narrative: str }).loose()).catch([]),
});
export type SynthesizeProposalResult = z.infer<typeof SynthesizeProposalSchema>;
