import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ProjectStage, QuestionStatus } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { RUBRIC } from '../common/rubric';
import { BeliefNode, CoverageArea, ProductDefinition, Question, User } from '../entities';
import {
  BeliefNodeRepository,
  CoverageAreaRepository,
  ProductDefinitionRepository,
  ProjectRepository,
  ProjectRoundRepository,
  QuestionRepository,
} from '../repository';
import { StructuredLlmService, SynthesizePrdSchema } from '../llm';
import { ProjectService } from './project.service';
import { PipelineResetService } from './pipeline-reset.service';

/** Minimum weighted rollup (0–1) to generate a PRD without an explicit override. */
export const DEFINITION_GATE = 0.7;

export interface GenerateDefinitionInput {
  override?: boolean;
  overrideReason?: string;
}

/**
 * Phase 5: project the confident Belief Graph into a versioned PRD. Gated on the
 * latest round's rollup — below the gate, generation requires an explicit
 * override (recorded on the definition). Output validated by SynthesizePrdSchema.
 */
@Injectable()
export class DefinitionService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly nodes: BeliefNodeRepository,
    private readonly coverage: CoverageAreaRepository,
    private readonly questions: QuestionRepository,
    private readonly rounds: ProjectRoundRepository,
    private readonly definitions: ProductDefinitionRepository,
    private readonly structured: StructuredLlmService,
    private readonly reset: PipelineResetService,
  ) {}

  /** Latest PRD for a project (null if never generated). */
  async latest(projectId: number, user: User): Promise<ProductDefinition | null> {
    await this.projects.findOne(projectId, user);
    return this.definitions.findLatestForProject(projectId);
  }

  async generate(
    projectId: number,
    user: User,
    input: GenerateDefinitionInput = {},
  ): Promise<ProductDefinition> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy

    const allRounds = await this.rounds.findAllForProject(projectId);
    if (!allRounds.length) {
      throw new BadRequestException('Score coverage before generating a definition');
    }
    const rollupConfidence = allRounds[allRounds.length - 1].rollupConfidence;

    // The confidence gate: below it, require an explicit override.
    const belowGate = rollupConfidence < DEFINITION_GATE;
    if (belowGate && !input.override) {
      throw new UnprocessableEntityException({
        message:
          `Confidence ${Math.round(rollupConfidence * 100)}% is below the ` +
          `${Math.round(DEFINITION_GATE * 100)}% gate. Resolve more questions or override.`,
        gate: true,
        rollupConfidence,
        threshold: DEFINITION_GATE,
      });
    }

    const [nodes, areas, questions] = await Promise.all([
      this.nodes.findAllForProject(projectId),
      this.coverage.findAllForProject(projectId),
      this.questions.findAllForProject(projectId),
    ]);

    const content = await this.structured.run({
      key: PromptKey.SYNTHESIZE_PRD,
      vars: {
        coverageList: this.coverageList(areas),
        beliefsList: this.beliefsList(nodes),
        answeredList: this.answeredList(questions),
      },
      schema: SynthesizePrdSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: () => rollupConfidence,
    });

    const version = (await this.definitions.countForProject(projectId)) + 1;
    const saved = await this.definitions.create({
      project: { connect: { id: projectId } },
      version,
      content,
      confidenceAtGeneration: rollupConfidence,
      gateOverride: belowGate && !!input.override,
      overrideReason: belowGate && input.override ? (input.overrideReason ?? null) : null,
    } as any);

    // Move into DEFINITION (don't regress later stages).
    if (
      project.stage === ProjectStage.BRIEFING ||
      project.stage === ProjectStage.GAP_ANALYSIS ||
      project.stage === ProjectStage.AWAITING_CLIENT
    ) {
      await this.projectRepo.update(project.id, { stage: ProjectStage.DEFINITION } as any);
    }

    // A new PRD makes any existing delivery plan and proposal stale.
    await this.reset.afterDefinition(project.id);

    return saved;
  }

  // ── prompt-input builders ────────────────────────────────────────

  private coverageList(areas: CoverageArea[]): string {
    const areasByKey = new Map(areas.map((area) => [area.key, area]));
    return RUBRIC.map((rubricEntry) => {
      const area = areasByKey.get(rubricEntry.key);
      const pct = area ? Math.round(area.rollupConfidence * 100) : 0;
      return `- ${rubricEntry.name}: ${pct}% (${area?.status ?? 'UNDERDEFINED'})`;
    }).join('\n');
  }

  private beliefsList(nodes: BeliefNode[]): string {
    if (!nodes.length) return '(none)';
    const nodesByKey = new Map<string, BeliefNode[]>();
    for (const node of nodes) {
      const key = node.coverageKey ?? 'uncategorized';
      const group = nodesByKey.get(key) ?? [];
      group.push(node);
      nodesByKey.set(key, group);
    }
    const formatNode = (node: BeliefNode) =>
      `  - [${node.status} ${Math.round(node.confidence * 100)}%] ${node.kind}: ${node.name}` +
      (node.description ? ` — ${node.description}` : '');
    const lines: string[] = [];
    for (const area of RUBRIC) {
      const areaNodes = nodesByKey.get(area.key);
      if (!areaNodes?.length) continue;
      lines.push(`### ${area.name}`);
      lines.push(areaNodes.map(formatNode).join('\n'));
    }
    const uncategorizedNodes = nodesByKey.get('uncategorized');
    if (uncategorizedNodes?.length) {
      lines.push('### uncategorized');
      lines.push(uncategorizedNodes.map(formatNode).join('\n'));
    }
    return lines.join('\n');
  }

  private answeredList(questions: Question[]): string {
    const answered = questions.filter(
      (question) => question.status === QuestionStatus.ANSWERED && question.answerText,
    );
    if (!answered.length) return '(no client answers yet)';
    return answered
      .map((question) => `- Q: ${question.text}\n  A: ${question.answerText}`)
      .join('\n');
  }
}
