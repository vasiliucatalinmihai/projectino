import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectStage } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { Proposal, ProposalContent, ProposalPhase, User } from '../entities';
import {
  ProductDefinitionRepository,
  ProjectRepository,
  ProposalRepository,
  SettingRepository,
} from '../repository';
import { StructuredLlmService, SynthesizeProposalSchema } from '../llm';
import { ProjectService } from './project.service';
import { DeliveryService, DeliveryNode } from './delivery.service';

const PHASE_ORDER: Record<string, number> = { MVP: 0, 'PHASE 2': 1, LATER: 2 };

/**
 * Phase 8 — the priced proposal / SOW. Phases, days and costs are computed
 * deterministically from the delivery plan (day-rate + buffer from Settings) so
 * pricing is never hallucinated; the LLM only writes the client-facing prose.
 */
@Injectable()
export class ProposalService {
  constructor(
    private readonly projects: ProjectService,
    private readonly delivery: DeliveryService,
    private readonly definitions: ProductDefinitionRepository,
    private readonly proposals: ProposalRepository,
    private readonly settings: SettingRepository,
    private readonly structured: StructuredLlmService,
    private readonly projectRepo: ProjectRepository,
  ) {}

  async latest(projectId: number, user: User): Promise<Proposal | null> {
    await this.projects.findOne(projectId, user);
    return this.proposals.findLatestForProject(projectId);
  }

  async generate(projectId: number, user: User): Promise<Proposal> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const tree = await this.delivery.tree(projectId, user);
    if (!tree.epics.length) {
      throw new BadRequestException('Generate a delivery plan before the proposal');
    }
    const def = await this.definitions.findLatestForProject(projectId);
    const prd = (def?.content ?? {}) as Record<string, any>;

    const currency = await this.setting(project.accountId, 'default_currency', 'EUR');
    const dayRate = this.toNumber(await this.setting(project.accountId, 'day_rate', '600'), 600);
    const bufferPct = this.toNumber(
      await this.setting(project.accountId, 'estimation_buffer_pct', '20'),
      20,
    );

    const phases = this.computePhases(tree.epics, dayRate, bufferPct);
    const prose = await this.writeProse(project, this.toText(prd.summary), phases);

    // Merge LLM prose (by phase name) into the computed phases.
    const narrativeByPhaseName = new Map<string, string>(
      (prose.phases ?? []).map((phase: any) => [
        this.toText(phase?.name).toUpperCase(),
        this.toText(phase?.narrative),
      ]),
    );
    for (const phase of phases)
      phase.narrative = narrativeByPhaseName.get(phase.name.toUpperCase()) || '';

    const totalLowDays = phases.reduce((sum, phase) => sum + phase.lowDays, 0);
    const totalHighDays = phases.reduce((sum, phase) => sum + phase.highDays, 0);
    const totalLowCost = phases.reduce((sum, phase) => sum + phase.lowCost, 0);
    const totalHighCost = phases.reduce((sum, phase) => sum + phase.highCost, 0);

    const content: ProposalContent = {
      intro: this.toText(prose.intro),
      closing: this.toText(prose.closing),
      currency,
      dayRate,
      bufferPct,
      phases,
      assumptions: this.toStringList(prd.assumptions),
      outOfScope: this.toStringList(prd.out_of_scope),
      totalLowDays,
      totalHighDays,
      totalLowCost,
      totalHighCost,
    };

    const version = (await this.proposals.countForProject(projectId)) + 1;
    const proposal = await this.proposals.create({
      project: { connect: { id: projectId } },
      version,
      content,
      currency,
      dayRate,
      totalLowCost,
      totalHighCost,
    } as any);

    // The proposal is the terminal artifact — advance the project to PROPOSAL.
    await this.projectRepo.update(projectId, { stage: ProjectStage.PROPOSAL } as any);
    return proposal;
  }

  /** Client-facing markdown proposal. */
  async buildDoc(projectId: number, user: User): Promise<string> {
    await this.projects.findOne(projectId, user);
    const proposal = await this.proposals.findLatestForProject(projectId);
    if (!proposal) return '# Proposal\n\n_Not generated yet._\n';
    const content = proposal.content;
    const money = (amount: number) => `${content.currency} ${amount.toLocaleString('en-US')}`;
    const range = (low: number, high: number, unit: string) =>
      low === high ? `${low} ${unit}` : `${low}–${high} ${unit}`;

    const lines: string[] = ['# Proposal', ''];
    if (content.intro) lines.push(content.intro, '');
    lines.push('## Phases', '');
    for (const phase of content.phases) {
      lines.push(`### ${phase.name} — ${range(phase.lowDays, phase.highDays, 'days')}, ${money(phase.lowCost)}–${money(phase.highCost)}`);
      if (phase.narrative) lines.push(phase.narrative);
      for (const scopeItem of phase.scope) lines.push(`- ${scopeItem}`);
      lines.push('');
    }
    lines.push('## Investment', '');
    lines.push(
      `**Total: ${range(content.totalLowDays, content.totalHighDays, 'days')}, ${money(content.totalLowCost)}–${money(content.totalHighCost)}** ` +
        `(day rate ${money(content.dayRate)}, includes a ${content.bufferPct}% estimation buffer).`,
      '',
    );
    if (content.assumptions.length) {
      lines.push('## Assumptions', '');
      content.assumptions.forEach((assumption) => lines.push(`- ${assumption}`));
      lines.push('');
    }
    if (content.outOfScope.length) {
      lines.push('## Out of scope', '');
      content.outOfScope.forEach((outOfScopeItem) => lines.push(`- ${outOfScopeItem}`));
      lines.push('');
    }
    if (content.closing) lines.push('## Next steps', '', content.closing, '');
    return lines.join('\n').trim() + '\n';
  }

  // ── helpers ─────────────────────────────────────────────────────

  private computePhases(epics: DeliveryNode[], dayRate: number, bufferPct: number): ProposalPhase[] {
    const buckets = new Map<string, { lowDays: number; highDays: number; scope: Set<string> }>();
    for (const epic of epics) {
      for (const story of epic.children) {
        for (const task of story.children) {
          const name = (task.phase || 'MVP').trim() || 'MVP';
          const bucket = buckets.get(name) ?? { lowDays: 0, highDays: 0, scope: new Set<string>() };
          bucket.lowDays += task.estimateLow ?? 0;
          bucket.highDays += task.estimateHigh ?? task.estimateLow ?? 0;
          bucket.scope.add(story.title);
          buckets.set(name, bucket);
        }
      }
    }
    const withBuffer = (days: number) => Math.ceil(days * (1 + bufferPct / 100));
    return [...buckets.entries()]
      .map(([name, bucket]) => {
        const lowDays = withBuffer(bucket.lowDays);
        const highDays = withBuffer(bucket.highDays);
        return {
          name,
          scope: [...bucket.scope].slice(0, 8),
          lowDays,
          highDays,
          lowCost: lowDays * dayRate,
          highCost: highDays * dayRate,
        };
      })
      .sort((a, b) => (PHASE_ORDER[a.name.toUpperCase()] ?? 3) - (PHASE_ORDER[b.name.toUpperCase()] ?? 3));
  }

  private async writeProse(
    project: { name: string; client?: { name?: string } },
    summary: string,
    phases: ProposalPhase[],
  ): Promise<{ intro?: string; closing?: string; phases?: Array<{ name?: string; narrative?: string }> }> {
    const phasesList = phases
      .map((phase) => `${phase.name} — scope: ${phase.scope.join('; ') || '(general)'}`)
      .join('\n');
    try {
      // Prose is optional — a failed/invalid generation still yields a fully-priced proposal.
      return await this.structured.run({
        promptKey: PromptKey.SYNTHESIZE_PROPOSAL,
        vars: {
          projectName: project.name,
          clientName: project.client?.name ?? 'the client',
          summary,
          phasesList,
        },
        schema: SynthesizeProposalSchema,
        accountId: (project as any).accountId,
        subject: { type: 'project', id: (project as any).id },
      });
    } catch {
      return { intro: '', closing: '', phases: [] };
    }
  }

  private async setting(accountId: number, key: string, fallback: string): Promise<string> {
    const setting = await this.settings.findOne({ accountId, key } as any);
    return (setting as any)?.value ?? fallback;
  }

  private toNumber(value: string, fallback: number): number {
    const num = parseInt(value, 10);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  }

  private toStringList(value: any): string[] {
    if (Array.isArray(value)) return value.map((item) => this.toText(item)).filter(Boolean);
    const text = this.toText(value).trim();
    return text ? [text] : [];
  }

  private toText(value: any): string {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }
}
