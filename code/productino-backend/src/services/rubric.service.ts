import { Injectable } from '@nestjs/common';
import { Project } from '../entities';

/**
 * The discovery completeness rubric — the taxonomy of what a buildable software
 * project needs to be defined. This service is the single home for rubric logic:
 * it owns the built-in catalog and resolves the *effective* rubric for a project
 * (which catalog areas it enables, plus any weight/name/hint overrides).
 *
 * Shared across the pipeline: extraction tags each belief with a `coverageKey`
 * from the effective rubric, scoring rolls confidence up per area and weights the
 * project gate by it, and the PRD projection reports per-area coverage.
 */

export type RubricWeight = 'high' | 'medium' | 'low';

export interface RubricArea {
  key: string;
  name: string;
  weight: RubricWeight;
  /**
   * One-line guidance on what "covered" means for this area. Embedded in the
   * extraction and scoring prompts to sharpen categorization and judgement.
   */
  hint?: string;
}

/** Per-area override a project may apply on top of a catalog area. */
export interface RubricOverride {
  weight?: RubricWeight;
  name?: string;
  hint?: string;
}

/**
 * What a project stores in its `rubric` JSON column. `enabled` is the set of
 * catalog keys turned on; `overrides` tweaks individual areas. A null column
 * means "all catalog areas, catalog defaults".
 */
export interface ProjectRubricConfig {
  enabled: string[];
  overrides?: Record<string, RubricOverride>;
}

/** A custom rubric is capped to keep scoring prompts sane and cheap. */
export const MAX_RUBRIC_AREAS = 30;

@Injectable()
export class RubricService {
  /** The built-in catalog of available areas — the default when a project hasn't configured one. */
  private static readonly CATALOG: readonly RubricArea[] = [
    {
      key: 'functional_scope',
      name: 'Functional scope (features, core flows)',
      weight: 'high',
      hint: 'The features and end-to-end user journeys the system must support, and what each does.',
    },
    {
      key: 'user_roles',
      name: 'User roles & personas',
      weight: 'medium',
      hint: 'Who uses the system, and each role’s permissions and restrictions.',
    },
    {
      key: 'data',
      name: 'Data model & ownership / migration',
      weight: 'high',
      hint: 'Core entities and relationships, who owns the data, and any migration from existing systems (sources, volumes).',
    },
    {
      key: 'integrations',
      name: 'Integrations & external systems',
      weight: 'medium',
      hint: 'Third-party or internal systems to connect to, the direction of data flow, and the sync model.',
    },
    {
      key: 'non_functional',
      name: 'Non-functional (performance, scale, security)',
      weight: 'high',
      hint: 'Performance/latency targets, expected load, availability, and security requirements beyond features.',
    },
    {
      key: 'compliance',
      name: 'Compliance & data protection',
      weight: 'high',
      hint: 'GDPR / regional data rules, data residency, retention, consent, and any industry-specific regulation.',
    },
    {
      key: 'platforms',
      name: 'Platforms & devices',
      weight: 'medium',
      hint: 'Target platforms (web/mobile/desktop), supported browsers/devices, and the cloud/hosting environment.',
    },
    {
      key: 'localization',
      name: 'Localization & content',
      weight: 'medium',
      hint: 'Languages, currencies, regions, time zones, and any content or translation needs.',
    },
    {
      key: 'operations',
      name: 'Operations, hosting & support',
      weight: 'medium',
      hint: 'Hosting model and environments, deployment, monitoring, post-launch support/SLA, maintenance, and training.',
    },
    {
      key: 'acceptance',
      name: 'Acceptance, QA & sign-off',
      weight: 'medium',
      hint: 'How "done" is verified: the test/UAT process, number of revision rounds, and formal sign-off criteria.',
    },
    {
      key: 'constraints',
      name: 'Constraints (budget, timeline, locked tech)',
      weight: 'high',
      hint: 'Budget envelope, deadlines/milestones, fixed-vs-flexible scope, and mandated or forbidden technology.',
    },
    {
      key: 'stakeholders',
      name: 'Stakeholders & decision-makers',
      weight: 'low',
      hint: 'Who approves decisions and change requests, and the day-to-day points of contact.',
    },
    {
      key: 'success_metrics',
      name: 'Success metrics / business outcomes',
      weight: 'medium',
      hint: 'The measurable business outcomes that define success, beyond passing acceptance.',
    },
    {
      key: 'assumptions',
      name: 'Assumptions & explicit out-of-scope',
      weight: 'medium',
      hint: 'Stated assumptions and what is explicitly excluded — the contractual armor against scope creep.',
    },
  ];

  /** Relative weight of each area in the project rollup gate (a compliance gap hurts more). */
  private static readonly WEIGHT_VALUE: Record<RubricWeight, number> = { high: 3, medium: 2, low: 1 };

  private static readonly WEIGHTS: readonly RubricWeight[] = ['high', 'medium', 'low'];

  /** All available areas (a fresh copy so callers can't mutate the catalog). */
  catalog(): RubricArea[] {
    return RubricService.CATALOG.map((area) => ({ ...area }));
  }

  /** Numeric weight of a rubric weight band. */
  weightValue(weight: RubricWeight): number {
    return RubricService.WEIGHT_VALUE[weight] ?? 1;
  }

  /** Whether the project carries a custom rubric (vs. the built-in default). */
  isCustom(project: Project): boolean {
    return project?.rubric != null;
  }

  /** The effective rubric for a project: enabled catalog areas with overrides applied. */
  forProject(project: Project): RubricArea[] {
    return this.resolve(project?.rubric ?? null);
  }

  /**
   * Resolve a stored rubric config (or null) to the effective areas. Lenient by
   * design — unknown/garbage shapes and unknown enabled keys are ignored, and an
   * empty result falls back to the full catalog (the pipeline must always have
   * ≥1 area). Strict validation lives in `normalizeConfig` (used by the API).
   */
  resolve(stored: unknown): RubricArea[] {
    const config = this.coerceConfig(stored);
    if (!config) return this.catalog();

    const enabled = new Set(config.enabled);
    const overrides = config.overrides ?? {};
    const areas = RubricService.CATALOG.filter((area) => enabled.has(area.key)).map((area) => {
      const override = overrides[area.key];
      const merged: RubricArea = {
        key: area.key,
        name: override?.name?.trim() || area.name,
        weight: override?.weight ?? area.weight,
      };
      const hint = override?.hint?.trim() || area.hint;
      if (hint) merged.hint = hint;
      return merged;
    });
    return areas.length ? areas : this.catalog();
  }

  /** Render a rubric as the `- key — name: hint` bullet list embedded in prompts. */
  promptList(areas: RubricArea[]): string {
    return areas
      .map((area) => `- ${area.key} — ${area.name}${area.hint ? `: ${area.hint}` : ''}`)
      .join('\n');
  }

  /**
   * Validate + normalize a candidate config (a PUT body) into a clean
   * ProjectRubricConfig. Throws a plain Error on a structural problem (the HTTP
   * layer maps it to a 400). Enabled keys must exist in the catalog.
   */
  normalizeConfig(raw: unknown): ProjectRubricConfig {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('rubric config must be an object with an "enabled" array');
    }
    const input = raw as Record<string, unknown>;
    if (!Array.isArray(input.enabled)) throw new Error('"enabled" must be an array of area keys');
    if (input.enabled.length === 0) throw new Error('at least one area must be enabled');
    if (input.enabled.length > MAX_RUBRIC_AREAS) {
      throw new Error(`too many areas enabled (max ${MAX_RUBRIC_AREAS})`);
    }

    const catalogKeys = new Set(RubricService.CATALOG.map((area) => area.key));
    const seen = new Set<string>();
    const enabled = input.enabled.map((value) => {
      const key = String(value).toLowerCase().trim();
      if (!catalogKeys.has(key)) throw new Error(`unknown rubric area "${key}"`);
      if (seen.has(key)) throw new Error(`duplicate rubric area "${key}"`);
      seen.add(key);
      return key;
    });

    const overrides = this.normalizeOverrides(input.overrides, seen);
    const config: ProjectRubricConfig = { enabled };
    if (Object.keys(overrides).length) config.overrides = overrides;
    return config;
  }

  // ── helpers ─────────────────────────────────────────────────────

  /** Best-effort read of a stored value into a config shape (no throwing). */
  private coerceConfig(stored: unknown): ProjectRubricConfig | null {
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null;
    const value = stored as Record<string, unknown>;
    if (!Array.isArray(value.enabled)) return null;
    const enabled = value.enabled.map((key) => String(key).toLowerCase().trim()).filter(Boolean);
    if (!enabled.length) return null;
    const overrides =
      value.overrides && typeof value.overrides === 'object' && !Array.isArray(value.overrides)
        ? (value.overrides as Record<string, RubricOverride>)
        : undefined;
    return { enabled, overrides };
  }

  private normalizeOverrides(
    raw: unknown,
    enabledKeys: Set<string>,
  ): Record<string, RubricOverride> {
    if (raw == null) return {};
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('"overrides" must be an object keyed by area key');
    }
    const out: Record<string, RubricOverride> = {};
    for (const [rawKey, rawValue] of Object.entries(raw as Record<string, unknown>)) {
      const key = rawKey.toLowerCase().trim();
      if (!enabledKeys.has(key)) throw new Error(`override for "${key}" is not an enabled area`);
      if (!rawValue || typeof rawValue !== 'object') {
        throw new Error(`override for "${key}" must be an object`);
      }
      const value = rawValue as Record<string, unknown>;
      const override: RubricOverride = {};
      if (value.weight != null) {
        const weight = String(value.weight).toLowerCase().trim() as RubricWeight;
        if (!RubricService.WEIGHTS.includes(weight)) {
          throw new Error(`override for "${key}" has an invalid weight "${value.weight}"`);
        }
        override.weight = weight;
      }
      if (value.name != null) {
        const name = String(value.name).trim();
        if (name) override.name = name.slice(0, 120);
      }
      if (value.hint != null) {
        const hint = String(value.hint).trim();
        if (hint) override.hint = hint.slice(0, 300);
      }
      if (Object.keys(override).length) out[key] = override;
    }
    return out;
  }
}
