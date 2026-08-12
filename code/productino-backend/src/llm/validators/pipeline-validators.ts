import {
  DetectConflictsResult,
  EstimateEpicResult,
  ExtractBeliefsResult,
  MapAnswersResult,
  ScoreCoverageResult,
  SynthesizePrdResult,
  TechDesignResult,
} from '../schemas/pipeline-schemas';

/** Pure, deterministic per-step quality checks (Phase 2) — no LLM call, run every round. */
export interface Verdict {
  pass: boolean;
  critique: string;
}

const join = (issues: string[]): Verdict =>
  issues.length ? { pass: false, critique: issues.join(' ') } : { pass: true, critique: '' };

// -- extract-beliefs --------------------------------------------------------------

export function extractBeliefsValidator(value: ExtractBeliefsResult): Verdict {
  const issues: string[] = [];
  if (value.beliefs.length < 3) issues.push('Extract at least 3 belief nodes total.');
  for (const b of value.beliefs) {
    if (b.status === 'STATED' && !b.quote?.trim()) {
      issues.push(`"${b.name}" is STATED but has no supporting quote — quote it verbatim or mark it INFERRED/ASSUMED.`);
    }
    if (b.status === 'INFERRED' && b.confidence > 0.7) {
      issues.push(`"${b.name}" is INFERRED with confidence ${b.confidence} — cap inferred confidence at 0.7.`);
    }
    if (b.nodeType === 'ASSUMPTION' && b.confidence > 0.5) {
      issues.push(`"${b.name}" is an ASSUMPTION with confidence ${b.confidence} — cap assumption confidence at 0.5.`);
    }
    if (!b.description?.trim()) {
      issues.push(`"${b.name}" has no description — describe its functionality, inputs, UI (if any) and data source.`);
    }
  }
  return join(issues.slice(0, 8));
}

// -- score-coverage (called once per role, against that role's rubric subset) -----

export function scoreCoverageValidator(rubricKeys: string[]) {
  return (value: ScoreCoverageResult): Verdict => {
    const issues: string[] = [];
    const areaKeys = new Set(value.areas.map((a) => a.key.toLowerCase().trim()));
    const missing = rubricKeys.filter((k) => !areaKeys.has(k));
    if (missing.length) issues.push(`Missing coverage areas: ${missing.join(', ')}.`);

    const questionsByArea = new Map<string, number>();
    for (const q of value.questions) {
      const key = (q.coverageKey ?? '').toLowerCase().trim();
      questionsByArea.set(key, (questionsByArea.get(key) ?? 0) + 1);
    }
    const thinNoQuestion = value.areas.filter(
      (a) => a.rollupConfidence < 0.4 && !(questionsByArea.get(a.key.toLowerCase().trim()) ?? 0),
    );
    if (thinNoQuestion.length) {
      issues.push(`Areas below 40% confidence need at least one question: ${thinNoQuestion.map((a) => a.key).join(', ')}.`);
    }
    const noDefault = value.questions.filter((q) => !q.assumedAnswer?.trim());
    if (noDefault.length) issues.push(`${noDefault.length} question(s) are missing an assumedAnswer default.`);

    const seen = new Set<string>();
    let duplicates = 0;
    for (const q of value.questions) {
      const norm = q.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(norm)) duplicates++;
      seen.add(norm);
    }
    if (duplicates) issues.push(`${duplicates} question(s) duplicate another question's wording — dedupe them.`);

    return join(issues);
  };
}

// -- map-answers --------------------------------------------------------------------

export function mapAnswersValidator(openQuestionIds: number[]) {
  const valid = new Set(openQuestionIds);
  return (value: MapAnswersResult): Verdict => {
    const issues: string[] = [];
    const bogus = value.mapped.filter((m) => !valid.has(m.questionId));
    if (bogus.length) issues.push(`${bogus.length} mapped answer(s) reference a question id that isn't open.`);
    if (valid.size > 0 && value.mapped.length === 0 && !value.notes?.trim()) {
      issues.push('No answers were mapped and no note explains why — map what you can, or explain the gap in notes.');
    }
    return join(issues);
  };
}

// -- detect-conflicts -----------------------------------------------------------------

export function detectConflictsValidator(value: DetectConflictsResult): Verdict {
  const issues: string[] = [];
  for (const c of value.conflicts) {
    if (!c.beliefA?.trim() || !c.beliefB?.trim()) issues.push('A conflict is missing one of its two beliefs.');
    if (c.beliefA?.trim() === c.beliefB?.trim()) issues.push('A conflict names the same belief twice.');
    if (!c.detail?.trim()) issues.push('A conflict has no explanatory detail.');
  }
  return join(issues.slice(0, 6));
}

// -- synthesize-prd -------------------------------------------------------------------

export interface SynthesizePrdValidatorContext {
  hasRiskBeliefs: boolean;
  requireUiSpec: boolean;
}

export function synthesizePrdValidator(ctx: SynthesizePrdValidatorContext) {
  return (value: SynthesizePrdResult): Verdict => {
    const issues: string[] = [];
    if (!value.out_of_scope.length) issues.push('Out-of-scope section is empty — state what is explicitly excluded.');
    if (ctx.hasRiskBeliefs && !value.risks.length) {
      issues.push('The graph has identified risks, but the risk register is empty.');
    }
    if (value.summary.trim().length < 40) issues.push('Summary is too thin to be useful — expand it.');
    if (ctx.requireUiSpec) {
      const uiSpec = (value as any).ui_spec;
      if (!uiSpec?.screens?.length) {
        issues.push('ui_spec.screens is empty — describe every screen the product needs, not just written scope.');
      }
    }
    return join(issues);
  };
}

// -- estimate-epic ----------------------------------------------------------------------

export function estimateEpicValidator(value: EstimateEpicResult): Verdict {
  const issues: string[] = [];
  let totalHigh = 0;
  for (const e of value.estimates) {
    if (!e.estimateLow || e.estimateLow <= 0) issues.push(`Task index ${e.index} has no positive low estimate.`);
    if (e.estimateHigh == null || e.estimateHigh < (e.estimateLow ?? 0)) {
      issues.push(`Task index ${e.index}'s high estimate is missing or below its low estimate.`);
    }
    if (e.estimateLow != null && e.estimateLow === e.estimateHigh) {
      issues.push(`Task index ${e.index} has identical low/high — give a real range.`);
    }
    totalHigh += e.estimateHigh ?? 0;
  }
  if (totalHigh > 30) {
    issues.push(`Epic totals ${totalHigh} days at the high end (>30) — this is likely a decomposition problem, split it.`);
  }
  return join(issues.slice(0, 8));
}

// -- design-architecture (Tech Lead) -----------------------------------------------------

export function techDesignValidator(value: TechDesignResult): Verdict {
  const issues: string[] = [];
  const fields: Array<[string, { choice?: string; rationale?: string } | undefined]> = [
    ['frontend', value.frontend],
    ['backend', value.backend],
    ['database', value.database],
    ['apiStyle', value.apiStyle],
    ['infra', value.infra],
  ];
  for (const [name, field] of fields) {
    if (!field?.choice?.trim()) issues.push(`${name}.choice is empty.`);
    if (!field?.rationale || field.rationale.trim().length < 15) {
      issues.push(`${name}.rationale is missing or too thin — explain why, tied to the actual requirements.`);
    }
  }
  return join(issues.slice(0, 8));
}
