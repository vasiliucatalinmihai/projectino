/**
 * The fixed discovery completeness rubric — the taxonomy of what a buildable
 * software project needs to be defined. Shared across the pipeline: extraction
 * tags each belief with a `coverageKey` from this set (Phase 2), and scoring
 * rolls confidence up per area and weights the project gate by it (Phase 3).
 */
export interface RubricArea {
  key: string;
  name: string;
  weight: 'high' | 'medium' | 'low';
}

export const RUBRIC: RubricArea[] = [
  { key: 'functional_scope', name: 'Functional scope (features, flows)', weight: 'high' },
  { key: 'user_roles', name: 'User roles & personas', weight: 'medium' },
  { key: 'data', name: 'Data model & ownership / migration', weight: 'high' },
  { key: 'integrations', name: 'Integrations & external systems', weight: 'medium' },
  { key: 'non_functional', name: 'Non-functional (performance, scale, security)', weight: 'high' },
  { key: 'compliance', name: 'Compliance & data protection (GDPR)', weight: 'high' },
  { key: 'platforms', name: 'Platforms & devices', weight: 'medium' },
  { key: 'constraints', name: 'Constraints (budget, deadline, locked tech)', weight: 'high' },
  { key: 'stakeholders', name: 'Stakeholders & decision-makers', weight: 'low' },
  { key: 'success_metrics', name: 'Success metrics / definition of done', weight: 'medium' },
  { key: 'assumptions', name: 'Assumptions & explicit out-of-scope', weight: 'medium' },
];

export const RUBRIC_KEYS: string[] = RUBRIC.map((area) => area.key);

/** Relative weight of each area in the project rollup gate (a compliance gap hurts more). */
export const WEIGHT_VALUE: Record<RubricArea['weight'], number> = { high: 3, medium: 2, low: 1 };

/** A markdown bullet list of "key — name", for embedding in prompts. */
export const RUBRIC_PROMPT_LIST: string = RUBRIC.map((area) => `- ${area.key} — ${area.name}`).join('\n');
