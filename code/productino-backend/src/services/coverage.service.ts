import { BadRequestException, Injectable } from '@nestjs/common';
import { CoverageStatus, QuestionStatus } from '@prisma/client';
import { PromptKey } from '../common/prompt-key';
import { RUBRIC, RUBRIC_PROMPT_LIST, WEIGHT_VALUE } from '../common/rubric';
import { BeliefNode, ProjectRound, User } from '../entities';
import {
  BeliefNodeRepository,
  CoverageAreaRepository,
  ProjectRoundRepository,
  QuestionRepository,
} from '../repository';
import { ScoreCoverageResult, ScoreCoverageSchema, StructuredLlmService } from '../llm';
import { ProjectService } from './project.service';
import { PipelineResetService } from './pipeline-reset.service';

/**
 * Phase 3 (the heart): score the belief graph against the rubric. The LLM judges
 * each rubric category's completeness and proposes questions (validated by
 * ScoreCoverageSchema); this service derives the per-area status, computes the
 * weighted project rollup (the gate), and snapshots a ProjectRound.
 */
@Injectable()
export class CoverageService {
  constructor(
    private readonly projects: ProjectService,
    private readonly nodes: BeliefNodeRepository,
    private readonly coverage: CoverageAreaRepository,
    private readonly questions: QuestionRepository,
    private readonly rounds: ProjectRoundRepository,
    private readonly structured: StructuredLlmService,
    private readonly reset: PipelineResetService,
  ) {}

  async run(projectId: number, user: User): Promise<ProjectRound> {
    const project = await this.projects.findOne(projectId, user); // enforces tenancy
    const nodes = await this.nodes.findAllForProject(projectId);
    if (!nodes.length) {
      throw new BadRequestException('Extract beliefs before scoring coverage');
    }

    const result = await this.structured.run({
      key: PromptKey.SCORE_COVERAGE,
      vars: { rubricList: RUBRIC_PROMPT_LIST, beliefsList: this.beliefsList(nodes) },
      schema: ScoreCoverageSchema,
      accountId: user.accountId,
      subject: { type: 'project', id: project.id },
      scoreOf: (value) => this.weightedRollup(value),
    });

    const nextIndex = (await this.rounds.findAllForProject(projectId)).length + 1;
    const areaByKey = new Map(
      result.areas.map((area) => [area.key.toLowerCase().trim(), area]),
    );

    // Upsert all 11 rubric categories (in order), deriving status from confidence.
    for (const area of RUBRIC) {
      const confidence = areaByKey.get(area.key)?.rollupConfidence ?? 0;
      const status = this.statusFor(confidence);
      await this.coverage.upsert(
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
    const rollup = this.weightedRollup(result);

    // Regenerate the question set, preserving anything already answered by a client.
    await this.questions.deleteMany({ projectId, status: { not: QuestionStatus.ANSWERED } });
    for (const question of result.questions) {
      await this.questions.create({
        project: { connect: { id: projectId } },
        coverageKey: question.coverageKey,
        text: question.text,
        assumedAnswer: question.assumedAnswer || null,
        impact: question.impact,
        status: QuestionStatus.OPEN,
        round: nextIndex,
      } as any);
    }

    const round = await this.rounds.create({
      project: { connect: { id: projectId } },
      index: nextIndex,
      rollupConfidence: rollup,
    } as any);

    // New coverage makes the PRD and everything built from it stale.
    await this.reset.afterScoring(projectId);

    return round;
  }

  // ── helpers ─────────────────────────────────────────────────────

  /** Weighted average of per-area confidence — the "defined enough?" gate value. */
  private weightedRollup(result: ScoreCoverageResult): number {
    const byKey = new Map(result.areas.map((area) => [area.key.toLowerCase().trim(), area.rollupConfidence]));
    let weightedSum = 0;
    let weightTotal = 0;
    for (const area of RUBRIC) {
      const confidence = byKey.get(area.key) ?? 0;
      const weight = WEIGHT_VALUE[area.weight];
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
  private beliefsList(nodes: BeliefNode[]): string {
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
    for (const area of RUBRIC) {
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
