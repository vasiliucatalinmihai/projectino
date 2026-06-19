import { BadRequestException, Injectable } from '@nestjs/common';
import { CoverageStatus, ProjectStage, QuestionStatus } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { BeliefNode, ProjectRound, User } from '../entities';
import {
  BeliefNodeRepository,
  CoverageAreaRepository,
  ProjectRepository,
  ProjectRoundRepository,
  QuestionRepository,
} from '../repository';
import { ScoreCoverageResult, ScoreCoverageSchema, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { PipelineResetService } from './pipeline-reset.service';
import { RubricArea, RubricService } from './rubric.service';

@Injectable()
export class CoverageService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly beliefNodeRepository: BeliefNodeRepository,
    private readonly coverageAreaRepository: CoverageAreaRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly projectRoundRepository: ProjectRoundRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly structuredLlmService: StructuredLlmService,
    private readonly pipelineResetService: PipelineResetService,
    private readonly rubricService: RubricService,
  ) {}

  async run(projectId: number, user: User): Promise<ProjectRound> {
    const project = await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const nodes = await this.beliefNodeRepository.findAllForProject(projectId);
    if (!nodes.length) {
      throw new BadRequestException('Extract beliefs before scoring coverage');
    }

    const rubric = this.rubricService.forProject(project);

    const result = await this.structuredLlmService.run({
      promptKey: PromptKey.SCORE_COVERAGE,
      vars: { rubricList: this.rubricService.promptList(rubric), beliefsList: this.beliefsList(nodes, rubric) },
      schema: ScoreCoverageSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => this.weightedRollup(value, rubric),
    });

    const nextIndex = (await this.projectRoundRepository.findAllForProject(projectId)).length + 1;
    const areaByKey = new Map(
      result.areas.map((area) => [area.key.toLowerCase().trim(), area]),
    );

    // Upsert every rubric category (in order), deriving status from confidence.
    for (const area of rubric) {
      const confidence = areaByKey.get(area.key)?.rollupConfidence ?? 0;
      const status = this.statusFor(confidence);
      await this.coverageAreaRepository.upsert(
        { projectId_key: { projectId, key: area.key } },
        {
          project: { connect: { id: projectId } },
          key: area.key,
          name: area.name,
          weight: area.weight,
          rollupConfidence: confidence,
          status,
          round: nextIndex,
        } as any,
        { name: area.name, weight: area.weight, rollupConfidence: confidence, status, round: nextIndex } as any,
      );
    }
    // Drop coverage rows for areas no longer in the (possibly customized) rubric.
    await this.coverageAreaRepository.deleteMany({ projectId, key: { notIn: rubric.map((area) => area.key) } } as any);

    const rollup = this.weightedRollup(result, rubric);

    // Regenerate the question set, preserving anything already answered by a client.
    await this.questionRepository.deleteMany({ projectId, status: { not: QuestionStatus.ANSWERED } });
    for (const question of result.questions) {
      await this.questionRepository.create({
        project: { connect: { id: projectId } },
        coverageKey: question.coverageKey,
        text: question.text,
        assumedAnswer: question.assumedAnswer || null,
        impact: question.impact,
        status: QuestionStatus.OPEN,
        round: nextIndex,
      } as any);
    }

    const round = await this.projectRoundRepository.create({
      project: { connect: { id: projectId } },
      index: nextIndex,
      rollupConfidence: rollup,
    } as any);

    // New coverage makes the PRD and everything built from it stale.
    await this.pipelineResetService.afterScoring(projectId);

    // Reflect the convergence loop in the stage: open questions → awaiting the
    // client's reply; none → back in gap analysis, ready to define. (Re-scoring
    // cleared the PRD chain above, so regressing the stage here is correct.)
    const nextStage = result.questions.length > 0 ? ProjectStage.AWAITING_CLIENT : ProjectStage.GAP_ANALYSIS;
    await this.projectRepository.update(projectId, { stage: nextStage } as any);

    return round;
  }

  /** Weighted average of per-area confidence — the "defined enough?" gate value. */
  private weightedRollup(result: ScoreCoverageResult, rubric: RubricArea[]): number {
    const byKey = new Map(result.areas.map((area) => [area.key.toLowerCase().trim(), area.rollupConfidence]));
    let weightedSum = 0;
    let weightTotal = 0;
    for (const area of rubric) {
      const confidence = byKey.get(area.key) ?? 0;
      const weight = this.rubricService.weightValue(area.weight);
      weightedSum += confidence * weight;
      weightTotal += weight;
    }
    return weightTotal ? Math.round((weightedSum / weightTotal) * 100) / 100 : 0;
  }

  private statusFor(confidence: number): CoverageStatus {
    if (confidence < 0.25) return CoverageStatus.UNDERDEFINED;
    if (confidence < 0.5) return CoverageStatus.THIN;
    if (confidence < 0.75) return CoverageStatus.ADEQUATE;
    return CoverageStatus.SOLID;
  }

  /** Belief nodes rendered as a category-grouped list for the prompt. */
  private beliefsList(nodes: BeliefNode[], rubric: RubricArea[]): string {
    const nodesByCoverageKey = new Map<string, BeliefNode[]>();
    for (const node of nodes) {
      const key = node.coverageKey ?? 'uncategorized';
      const group = nodesByCoverageKey.get(key) ?? [];
      group.push(node);
      nodesByCoverageKey.set(key, group);
    }
    const formatNode = (node: BeliefNode) =>
      `  - [${node.status} ${Math.round(node.confidence * 100)}%] ${node.kind}: ${node.name}` +
      (node.description ? ` — ${node.description}` : '');

    const lines: string[] = [];
    for (const area of rubric) {
      lines.push(`### ${area.key} — ${area.name}`);
      const areaNodes = nodesByCoverageKey.get(area.key) ?? [];
      lines.push(areaNodes.length ? areaNodes.map(formatNode).join('\n') : '  none');
    }
    const uncategorizedNodes = nodesByCoverageKey.get('uncategorized') ?? [];
    if (uncategorizedNodes.length) {
      lines.push('### uncategorized');
      lines.push(uncategorizedNodes.map(formatNode).join('\n'));
    }
    return lines.join('\n');
  }
}
