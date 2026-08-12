import { Injectable } from '@nestjs/common';
import { PipelineRole, ProjectType } from '@prisma/client';
import { Project } from '../entities';

export type RubricWeight = 'high' | 'medium' | 'low';

export interface RubricArea {
  key: string;
  name: string;
  weight: RubricWeight;
  /** Which persona owns this area during gap analysis — drives the role-split coverage call. */
  owner: PipelineRole;
  hint?: string;
}

export interface RubricOverride {
  weight?: RubricWeight;
  name?: string;
  hint?: string;
  owner?: PipelineRole;
}

export interface ProjectRubricConfig {
  enabled: string[];
  overrides?: Record<string, RubricOverride>;
}

/** keep scoring prompts sane and cheap. */
export const MAX_RUBRIC_AREAS = 30;

@Injectable()
export class RubricService {
  private static readonly CATALOG: readonly RubricArea[] = [
    {
      key: 'functional_scope',
      name: 'Functional scope (features, core flows)',
      weight: 'high',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'In-scope capabilities, MVP vs later scope, main user journeys, edge cases, and the exact outcome each flow must produce.',
    },
    {
      key: 'business_rules',
      name: 'Business rules & domain logic',
      weight: 'high',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Rules that drive decisions: eligibility, calculations, pricing, quotas, approvals, validation rules, thresholds, exceptions, and who can override them.',
    },
    {
      key: 'workflows_states',
      name: 'Workflow states & lifecycle',
      weight: 'high',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Object lifecycles, statuses, allowed transitions, triggers, notifications, handoffs, cancellation/retry paths, and what happens when a flow fails.',
    },
    {
      key: 'user_roles',
      name: 'User roles & personas',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Who uses the system, each role or persona goal, permission boundaries, approval powers, visibility restrictions, and account/tenant separation.',
    },
    {
      key: 'data',
      name: 'Data model & ownership / migration',
      weight: 'high',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Core entities, relationships, required fields, data ownership, source of truth, import/export needs, migration sources, volumes, quality issues, and retention.',
    },
    {
      key: 'integrations',
      name: 'Integrations & external systems',
      weight: 'medium',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Third-party/internal systems, auth method, APIs/webhooks/files, data direction, sync frequency, failure handling, rate limits, sandbox access, and ownership.',
    },
    {
      key: 'admin_backoffice',
      name: 'Admin & back-office tooling',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Internal admin screens, moderation/support workflows, manual corrections, impersonation, audit views, bulk actions, operational controls, and escalation paths.',
    },
    {
      key: 'reporting_analytics',
      name: 'Reporting, analytics & exports',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Dashboards, KPIs, event tracking, report filters, export formats, scheduled reports, analytics ownership, and any audit or management reporting needs.',
    },
    {
      key: 'non_functional',
      name: 'Non-functional (performance, scale, security)',
      weight: 'high',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Performance and latency targets, expected users/traffic/data volume, availability, resilience, backup/recovery, security controls, audit logging, and access hardening.',
    },
    {
      key: 'compliance',
      name: 'Compliance & data protection',
      weight: 'high',
      owner: PipelineRole.TECH_LEAD,
      hint: 'GDPR/regional rules, consent, retention/deletion, data residency, DPA needs, sensitive data classes, auditability, and any industry-specific regulation.',
    },
    {
      key: 'platforms',
      name: 'Platforms & devices',
      weight: 'medium',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Target platforms, device classes, supported browsers/OS versions, responsive breakpoints, accessibility baseline, app-store needs, and hosting/cloud constraints.',
    },
    {
      key: 'localization',
      name: 'Localization & content',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Languages, currencies, regions, time zones, locale-specific formats, translation ownership, content inventory, CMS needs, and content migration.',
    },
    {
      key: 'ux_design',
      name: 'UX, design system & accessibility',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Available wireframes/designs, design-system expectations, responsive behavior, accessibility target, copy/media ownership, brand constraints, and review rounds.',
    },
    {
      key: 'operations',
      name: 'Operations, hosting & support',
      weight: 'medium',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Environments, deployment/release process, monitoring/alerting, incident ownership, post-launch support/SLA, maintenance, documentation, training, and handover.',
    },
    {
      key: 'acceptance',
      name: 'Acceptance, QA & sign-off',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Definition of done, test/UAT process, required test data, browser/device matrix, bug severity rules, revision rounds, sign-off owner, and release approval criteria.',
    },
    {
      key: 'constraints',
      name: 'Constraints (budget, timeline, locked tech)',
      weight: 'high',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Budget envelope, deadlines, milestones, launch dependencies, fixed vs flexible scope, mandated/forbidden technology, vendor constraints, and team availability.',
    },
    {
      key: 'stakeholders',
      name: 'Stakeholders & decision-makers',
      weight: 'low',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Decision-maker, product owner, subject-matter experts, legal/security reviewers, day-to-day contacts, approval path, and expected response times.',
    },
    {
      key: 'success_metrics',
      name: 'Success metrics / business outcomes',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Business outcomes, measurable KPIs, baseline/current pain, target improvement, reporting cadence, and what would make the project commercially worthwhile.',
    },
    {
      key: 'commercial_change_control',
      name: 'Commercial boundaries & change control',
      weight: 'high',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Pricing model, payment milestones, included deliverables, client responsibilities, dependency ownership, change-request process, warranty/support boundary, and scope guardrails.',
    },
    {
      key: 'assumptions',
      name: 'Assumptions & explicit out-of-scope',
      weight: 'medium',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Stated assumptions, proposed defaults, exclusions, deferred features, open risks accepted by the client, and items that require a separate estimate or phase.',
    },
    {
      key: 'erp_modules_integration',
      name: 'ERP modules & business-process scope',
      weight: 'high',
      owner: PipelineRole.BUSINESS_ANALYST,
      hint: 'Which ERP modules are in scope (finance, inventory, HR, ...), the business processes each must support, and how they hand off to one another.',
    },
    {
      key: 'mobile_platform_specifics',
      name: 'Mobile platform specifics',
      weight: 'medium',
      owner: PipelineRole.TECH_LEAD,
      hint: 'Target platforms (iOS/Android/cross-platform), offline behavior, push notifications, device permissions, and app-store review requirements.',
    },
  ];

  /**
   * Areas enabled by default for a project type — the universal catalog plus any
   * type-specific areas. Only ever adds on top of the base set; never removes one,
   * to avoid guessing a type doesn't need something. Applied once at project
   * creation as the initial `Project.rubric`; still fully editable afterward via
   * the existing per-project override UI.
   */
  private static readonly TYPE_EXTRA_AREAS: Partial<Record<ProjectType, string[]>> = {
    [ProjectType.MOBILE]: ['mobile_platform_specifics'],
    [ProjectType.CONSULTING_ERP]: ['erp_modules_integration'],
    [ProjectType.ERP_IMPLEMENTATION]: ['erp_modules_integration'],
  };

  private static readonly BASE_AREA_KEYS: readonly string[] = RubricService.CATALOG.filter(
    (area) => !['erp_modules_integration', 'mobile_platform_specifics'].includes(area.key),
  ).map((area) => area.key);

  private static readonly WEIGHT_VALUE: Record<RubricWeight, number> = { high: 3, medium: 2, low: 1 };
  private static readonly WEIGHTS: readonly RubricWeight[] = ['high', 'medium', 'low'];

  catalog(): RubricArea[] {
    return RubricService.CATALOG.map((area) => ({ ...area }));
  }

  weightValue(weight: RubricWeight): number {
    return RubricService.WEIGHT_VALUE[weight] ?? 1;
  }

  isCustom(project: Project): boolean {
    return project?.rubric != null;
  }

  forProject(project: Project): RubricArea[] {
    return this.resolve(project?.rubric ?? null);
  }

  resolve(stored: unknown): RubricArea[] {
    const config = this.guessConfig(stored);
    if (!config) return this.catalog();

    const enabled = new Set(config.enabled);
    const overrides = config.overrides ?? {};
    const areas = RubricService.CATALOG.filter((area) => enabled.has(area.key)).map((area) => {
      const override = overrides[area.key];
      const merged: RubricArea = {
        key: area.key,
        name: override?.name?.trim() || area.name,
        weight: override?.weight ?? area.weight,
        owner: override?.owner ?? area.owner,
      };
      const hint = override?.hint?.trim() || area.hint;
      if (hint) merged.hint = hint;
      return merged;
    });
    return areas.length ? areas : this.catalog();
  }

  /** Default rubric config for a freshly created project of this type. */
  presetForType(type: ProjectType): ProjectRubricConfig {
    const extra = RubricService.TYPE_EXTRA_AREAS[type] ?? [];
    return { enabled: [...RubricService.BASE_AREA_KEYS, ...extra] };
  }

  promptList(areas: RubricArea[]): string {
    return areas
      .map((area) => `- ${area.key} — ${area.name}${area.hint ? `: ${area.hint}` : ''}`)
      .join('\n');
  }

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

  private guessConfig(stored: unknown): ProjectRubricConfig | null {
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
      if (value.owner != null) {
        const owner = String(value.owner).toUpperCase().trim();
        if (!Object.values(PipelineRole).includes(owner as PipelineRole)) {
          throw new Error(`override for "${key}" has an invalid owner "${value.owner}"`);
        }
        override.owner = owner as PipelineRole;
      }
      if (Object.keys(override).length) out[key] = override;
    }
    return out;
  }
}
