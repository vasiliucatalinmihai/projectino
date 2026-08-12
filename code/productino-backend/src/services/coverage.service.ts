import { BadRequestException, Injectable } from '@nestjs/common';
import { CoverageStatus, PipelineRole, ProjectStage, QuestionStatus } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { PIPELINE_ROLE_DESCRIPTION, PIPELINE_ROLE_LABEL } from '../common/pipeline-role';
import { projectTypeLabel, resolveLanguage } from '../common/project-type';
import { BeliefNode, Project, ProjectRound, User } from '../entities';
import {
  BeliefNodeRepository,
  CoverageAreaRepository,
  ProjectRoundRepository,
  QuestionRepository,
} from '../repository';
import { ScoreCoverageResult, ScoreCoverageSchema, scoreCoverageValidator, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { PipelineOrchestratorService } from './pipeline-orchestrator.service';
import { RubricArea, RubricService } from './rubric.service';

const ROLES: PipelineRole[] = [PipelineRole.BUSINESS_ANALYST, PipelineRole.TECH_LEAD];

type ScoredArea = ScoreCoverageResult['areas'][number] & { owner: PipelineRole };
type AskedQuestion = ScoreCoverageResult['questions'][number] & { askedBy: PipelineRole };

@Injectable()
export class CoverageService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly beliefNodeRepository: BeliefNodeRepository,
    private readonly coverageAreaRepository: CoverageAreaRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly projectRoundRepository: ProjectRoundRepository,
    private readonly structuredLlmService: StructuredLlmService,
    private readonly orchestrator: PipelineOrchestratorService,
    private readonly rubricService: RubricService,
  ) {}

  async run(projectId: number, user: User): Promise<ProjectRound> {
    const project = await this.projectService.getProjectForUser(projectId, user); // enforces tenancy
    const nodes = await this.beliefNodeRepository.findAllForProject(projectId);
    if (!nodes.length) {
      throw new BadRequestException('Extract beliefs before scoring coverage');
    }

    const rubric = this.rubricService.forProject(project);
    const beliefsListText = this.beliefsList(nodes, rubric);

    // Business Analyst and Tech Lead each score and question only the rubric areas
    // they own — two focused calls instead of one generalist pass. Both see the
    // full belief list for context; only the rubric scope is filtered per role.
    const perRole = await Promise.all(
      ROLES.map((role) => this.scoreForRole(project, user, role, rubric, beliefsListText)),
    );
    const areas: ScoredArea[] = perRole.flatMap((r) => r.areas);
    const questions: AskedQuestion[] = perRole.flatMap((r) => r.questions);
    const result: ScoreCoverageResult = { areas, questions };

    const nextIndex = (await this.projectRoundRepository.findAllForProject(projectId)).length + 1;
    const areaByKey = new Map(areas.map((area) => [area.key.toLowerCase().trim(), area]));

    // Upsert every rubric category (in order), deriving status from confidence.
    for (const area of rubric) {
      const scored = areaByKey.get(area.key);
      const confidence = scored?.rollupConfidence ?? 0;
      const status = this.statusFor(confidence);
      const owner = scored?.owner ?? area.owner;
      await this.coverageAreaRepository.upsert(
        { projectId_key: { projectId, key: area.key } },
        {
          project: { connect: { id: projectId } },
          key: area.key,
          name: area.name,
          weight: area.weight,
          owner,
          rollupConfidence: confidence,
          status,
          round: nextIndex,
        } as any,
        { name: area.name, weight: area.weight, owner, rollupConfidence: confidence, status, round: nextIndex } as any,
      );
    }
    // Drop coverage rows for areas no longer in the (possibly customized) rubric.
    await this.coverageAreaRepository.deleteMany({ projectId, key: { notIn: rubric.map((area) => area.key) } } as any);

    const rollup = this.weightedRollup(result, rubric);

    // Regenerate the question set, preserving anything already answered by a client.
    await this.questionRepository.deleteMany({ projectId, status: { not: QuestionStatus.ANSWERED } });
    for (const question of questions) {
      await this.questionRepository.create({
        project: { connect: { id: projectId } },
        coverageKey: question.coverageKey,
        text: question.text,
        assumedAnswer: question.assumedAnswer || null,
        askedBy: question.askedBy,
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

    // Reflect the convergence loop in the stage: open questions → awaiting the
    // client's reply; none → back in gap analysis, ready to define. New coverage
    // makes the PRD and everything built from it stale, so this also cascades.
    const nextStage = questions.length > 0 ? ProjectStage.AWAITING_CLIENT : ProjectStage.GAP_ANALYSIS;
    await this.orchestrator.advance(projectId, nextStage, 'scoring');

    return round;
  }

  /** One role's focused pass over the rubric areas it owns. */
  private async scoreForRole(
    project: Project,
    user: User,
    role: PipelineRole,
    rubric: RubricArea[],
    beliefsListText: string,
  ): Promise<{ areas: ScoredArea[]; questions: AskedQuestion[] }> {
    const ownedAreas = rubric.filter((area) => area.owner === role);
    if (!ownedAreas.length) return { areas: [], questions: [] };
    const ownedKeys = ownedAreas.map((area) => area.key);
    const ownedSet = new Set(ownedKeys);

    const { output } = await this.structuredLlmService.runWithValidation({
      promptKey: PromptKey.SCORE_COVERAGE,
      vars: {
        role: PIPELINE_ROLE_LABEL[role],
        roleDescription: PIPELINE_ROLE_DESCRIPTION[role],
        projectType: projectTypeLabel(project),
        language: resolveLanguage(project),
        rubricList: this.rubricService.promptList(ownedAreas),
        beliefsList: beliefsListText,
      },
      schema: ScoreCoverageSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => this.weightedRollup(value, ownedAreas),
      semanticValidate: scoreCoverageValidator(ownedKeys),
    });

    // Discard any stray categories the model scored outside what it actually owns.
    return {
      areas: output.areas
        .filter((area) => ownedSet.has(area.key.toLowerCase().trim()))
        .map((area) => ({ ...area, owner: role })),
      questions: output.questions
        .filter((q) => ownedSet.has((q.coverageKey ?? '').toLowerCase().trim()))
        .map((q) => ({ ...q, askedBy: role })),
    };
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
